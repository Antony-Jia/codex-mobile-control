import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AgentSlot, ClientCommand, ControllerSnapshot, Effort, EventEnvelope, ModelOption, PermissionMode, ServerEvent } from "@codex-micro/protocol";
import { PROTOCOL_VERSION } from "@codex-micro/protocol";
import { assignSlot, createSnapshot, reduceController, selectSlot, syncSlot } from "@codex-micro/domain";
import type { CodexClient } from "./codex-client.js";
import type { Storage } from "./storage.js";
import { isApprovalMethod, normalizeApproval, normalizeLatestThreadHistory, normalizeNotification, normalizeThreads } from "./normalizer.js";

const permissionSettings = (mode: PermissionMode | undefined, cwd: string) => {
  const sandboxPolicy = mode === "full"
    ? { type: "dangerFullAccess" as const }
    : { type: "workspaceWrite" as const, writableRoots: [path.resolve(cwd)], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false };
  return {
    approvalPolicy: mode === "full" ? "never" as const : "on-request" as const,
    approvalsReviewer: mode === "auto" ? "auto_review" as const : "user" as const,
    sandbox: mode === "full" ? "danger-full-access" as const : "workspace-write" as const,
    sandboxPolicy,
  };
};

export class Controller extends EventEmitter {
  readonly epoch = randomUUID();
  private seq = 0;
  private state: ControllerSnapshot;
  private readonly loadedThreads = new Set<string>();

  constructor(private readonly codex: CodexClient, private readonly storage: Storage, private readonly defaultCwd: string, private readonly eventLimit: number) {
    super();
    this.state = createSnapshot();
    const slots = storage.loadSlots();
    if (slots.length) {
      this.state.slots = this.state.slots.map((slot) => slots.find((stored) => stored.slotId === slot.slotId) ?? slot);
      const selected = this.state.slots.filter((slot) => slot.selected).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      this.state = selectSlot(this.state, selected?.slotId ?? null);
    }
    // Server-initiated approval request IDs only belong to the current
    // app-server transport. They cannot be resumed after either process
    // restarts, even though mobile clients may reconnect to this controller.
    storage.clearApprovals();
    codex.on("ready", () => { this.loadedThreads.clear(); this.publish({ type: "connection.health", codex: "ready" }); void Promise.all([this.refreshThreads(), this.refreshModels()]); });
    codex.on("exit", () => {
      this.clearApprovals();
      this.publish({ type: "connection.health", codex: "restarting" });
    });
    codex.on("notification", (message) => {
      const event = normalizeNotification(message);
      if (!event) return;
      this.publish(event);
      if (event.type === "turn.completed") {
        this.clearApprovals((approval) => approval.threadId === event.threadId && (!event.turnId || !approval.turnId || approval.turnId === event.turnId));
        void this.refreshThreads(); void this.refreshThreadHistory(event.threadId);
      }
    });
    codex.on("serverRequest", (message) => {
      if (!isApprovalMethod(message.method)) { codex.respond(message.id, { decision: "decline" }); return; }
      const approval = normalizeApproval(message); storage.saveApproval(approval, message); this.publish({ type: "approval.requested", approval });
    });
  }

  snapshot() { return structuredClone(this.state); }
  currentSeq() { return this.seq; }

  publish(event: ServerEvent) {
    this.state = reduceController(this.state, event);
    const envelope: EventEnvelope = { protocolVersion: PROTOCOL_VERSION, serverEpoch: this.epoch, seq: ++this.seq, sentAt: Date.now(), event };
    this.storage.saveEnvelope(envelope); if (this.seq % 100 === 0) this.storage.trimEvents(this.eventLimit);
    this.emit("event", envelope);
    return envelope;
  }

  async refreshThreads() {
    const result = await this.codex.request("thread/list", { limit: 100, sortKey: "updated_at" });
    const threads = normalizeThreads(result).sort((a, b) => b.updatedAt - a.updatedAt);
    this.publish({ type: "threads.updated", threads });

    // The task dial represents the latest ten conversations, rather than a
    // permanently pinned six-slot list. Keep the selected conversation in
    // view even when it falls just outside the latest ten.
    const selectedSlot = this.state.slots.find((slot) => slot.selected);
    const selectedThreadId = selectedSlot?.threadId ?? null;
    const recentThreads = threads.slice(0, 10);
    if (selectedThreadId && !recentThreads.some((thread) => thread.id === selectedThreadId)) {
      const selectedThread = threads.find((thread) => thread.id === selectedThreadId);
      if (selectedThread) {
        if (recentThreads.length === 10) recentThreads.pop();
        recentThreads.push(selectedThread);
      }
    }

    const previousSlots = this.state.slots;
    const previousByThread = new Map(previousSlots.filter((slot) => slot.threadId).map((slot) => [slot.threadId!, slot]));
    const nextSlots = previousSlots.map((slot, index) => {
      const thread = recentThreads[index] ?? null;
      let next = thread
        ? previousByThread.has(thread.id)
          ? { ...syncSlot(previousByThread.get(thread.id)!, thread), slotId: slot.slotId }
          : assignSlot(slot, thread)
        : assignSlot(slot, null);
      next = { ...next, selected: selectedThreadId ? thread?.id === selectedThreadId : slot.slotId === selectedSlot?.slotId };
      return next;
    });

    let changed = false;
    for (let index = 0; index < nextSlots.length; index += 1) {
      const current = previousSlots[index];
      const next = nextSlots[index];
      if (current && next && JSON.stringify(current) !== JSON.stringify(next)) {
        this.replaceSlot(next);
        changed = true;
      }
    }
    return { threads, slotsAssigned: changed };
  }

  async refreshModels() {
    const result = await this.codex.request("model/list", { limit: 100, includeHidden: false }) as { data?: any[] };
    const efforts = new Set<unknown>(["low", "medium", "high", "xhigh"]);
    const models: ModelOption[] = (result.data ?? []).filter((item) => item && !item.hidden).map((item) => ({
      id: String(item.id ?? item.model),
      model: String(item.model ?? item.id),
      displayName: String(item.displayName ?? item.model ?? item.id),
      description: String(item.description ?? ""),
      isDefault: Boolean(item.isDefault),
      defaultEffort: efforts.has(item.defaultReasoningEffort) ? item.defaultReasoningEffort as Effort : "medium",
      supportedEfforts: (item.supportedReasoningEfforts ?? []).map((option: any) => option.reasoningEffort).filter((value: unknown): value is Effort => efforts.has(value)),
    }));
    this.publish({ type: "models.updated", models });
    return models;
  }

  async refreshThreadHistory(threadId: string) {
    const result = await this.codex.request("thread/read", { threadId, includeTurns: true });
    const text = normalizeLatestThreadHistory(result);
    this.publish({ type: "thread.history.updated", threadId, text });
    return { threadId, text };
  }

  async command(command: ClientCommand): Promise<unknown> {
    switch (command.type) {
      case "thread.list": return this.refreshThreads();
      case "thread.history": return this.refreshThreadHistory(command.threadId);
      case "model.list": return this.refreshModels();
      case "thread.create": {
        const cwd = command.cwd?.trim() || this.defaultCwd;
        const permissions = permissionSettings(command.permissionMode, cwd);
        const result = await this.codex.request("thread/start", { cwd, approvalPolicy: permissions.approvalPolicy, approvalsReviewer: permissions.approvalsReviewer, sandbox: permissions.sandbox }) as any;
        await this.refreshThreads();
        if (command.slotId) {
          const threadId = String(result?.thread?.id ?? result?.id ?? "");
          const duplicate = this.state.slots.find((item) => item.threadId === threadId && item.slotId !== command.slotId);
          if (duplicate) this.replaceSlot(assignSlot(duplicate, null));
          const slot = this.state.slots.find((item) => item.slotId === command.slotId);
          const thread = this.state.threads.find((item) => item.id === threadId)
            ?? normalizeThreads({ data: [result?.thread ?? result] }).find((item) => item.id === threadId);
          if (!slot || !thread) throw new Error("Codex 已创建会话，但未能将它分配到快捷位，请刷新后手动选择");
          this.replaceSlot(assignSlot(slot, thread));
          this.state = selectSlot(this.state, slot.slotId);
          for (const item of this.state.slots) this.storage.saveSlot(item);
          for (const item of this.state.slots) this.publish({ type: "slot.updated", slot: item });
        }
        return result;
      }
      case "thread.fork": { const result = await this.codex.request("thread/fork", { threadId: command.threadId }); await this.refreshThreads(); return result; }
      case "slot.assign": {
        const slot = this.state.slots.find((s) => s.slotId === command.slotId); if (!slot) throw new Error("Slot not found");
        const thread = command.threadId ? this.state.threads.find((t) => t.id === command.threadId) ?? null : null;
        if (command.threadId && !thread) throw new Error("Thread not found"); this.replaceSlot(assignSlot(slot, thread)); return null;
      }
      case "slot.select": {
        this.state = selectSlot(this.state, command.slotId); for (const slot of this.state.slots) this.storage.saveSlot(slot);
        for (const slot of this.state.slots) this.publish({ type: "slot.updated", slot }); return null;
      }
      case "turn.start": {
        const cached = this.storage.idempotentResult(command.idempotencyKey); if (cached !== undefined) return cached;
        await this.ensureThreadLoaded(command.threadId);
        const model = command.model ?? this.state.models.find((item) => item.isDefault)?.model ?? this.state.models[0]?.model;
        if (command.planMode && !model) throw new Error("Codex 模型列表尚未就绪，请刷新后重试");
        const collaborationMode = command.planMode ? { mode: "plan", settings: { model: model!, reasoning_effort: command.effort ?? null, developer_instructions: null } } : undefined;
        const cwd = this.state.threads.find((thread) => thread.id === command.threadId)?.cwd ?? this.defaultCwd;
        const permissions = permissionSettings(command.permissionMode, cwd);
        const result = await this.codex.request("turn/start", { threadId: command.threadId, input: [{ type: "text", text: command.text, text_elements: [] }], model, effort: command.effort, collaborationMode, approvalPolicy: permissions.approvalPolicy, approvalsReviewer: permissions.approvalsReviewer, sandboxPolicy: permissions.sandboxPolicy });
        this.storage.saveIdempotentResult(command.idempotencyKey, result); return result;
      }
      case "turn.steer": return this.codex.request("turn/steer", { threadId: command.threadId, expectedTurnId: command.turnId, input: [{ type: "text", text: command.text, text_elements: [] }] });
      case "turn.interrupt": return this.codex.request("turn/interrupt", { threadId: command.threadId, turnId: command.turnId });
      case "approval.respond": {
        const raw = this.storage.loadRawApproval(command.approvalRequestId) as any;
        // JSON-RPC request id 0 is valid. Only null/undefined means the
        // request is absent; a truthiness check makes the first approval on
        // some app-server connections impossible to answer.
        if (raw?.id === undefined || raw?.id === null) {
          this.storage.deleteApproval(command.approvalRequestId);
          this.publish({ type: "approval.resolved", approvalRequestId: command.approvalRequestId });
          throw new Error("该确认请求已失效，可能已在其他客户端处理或 Codex 已重新启动，请等待新的确认请求");
        }
        this.codex.respond(raw.id, { decision: command.decision }); this.storage.deleteApproval(command.approvalRequestId); this.publish({ type: "approval.resolved", approvalRequestId: command.approvalRequestId }); return null;
      }
      case "desktop.openThread": {
        const { spawn } = await import("node:child_process"); const uri = `codex://threads/${encodeURIComponent(command.threadId)}`;
        const child = process.platform === "win32"
          ? spawn("cmd.exe", ["/c", "start", "", uri], { detached: true, windowsHide: true })
          : spawn(process.platform === "darwin" ? "open" : "xdg-open", [uri], { detached: true });
        await new Promise<void>((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
        child.unref(); await new Promise((resolve) => setTimeout(resolve, 450)); return { opened: true };
      }
      case "auth": return null;
    }
  }

  private async ensureThreadLoaded(threadId: string) {
    if (this.loadedThreads.has(threadId)) return;
    await this.codex.request("thread/resume", { threadId, excludeTurns: true });
    this.loadedThreads.add(threadId);
  }

  private clearApprovals(predicate: (approval: ControllerSnapshot["approvals"][number]) => boolean = () => true) {
    const approvals = this.state.approvals.filter(predicate);
    for (const approval of approvals) {
      this.storage.deleteApproval(approval.id);
      this.publish({ type: "approval.resolved", approvalRequestId: approval.id });
    }
  }

  private replaceSlot(slot: AgentSlot) { this.state.slots = this.state.slots.map((s) => s.slotId === slot.slotId ? slot : s); this.storage.saveSlot(slot); this.publish({ type: "slot.updated", slot }); }
}

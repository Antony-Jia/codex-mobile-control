import type { ApprovalRequest, ServerEvent, ThreadSummary } from "@codex-micro/protocol";

const text = (value: unknown) => typeof value === "string" ? value : "";
const millis = (value: unknown) => typeof value === "number" ? (value < 10_000_000_000 ? value * 1000 : value) : Date.now();

export function normalizeThreads(result: any): ThreadSummary[] {
  const rows = result?.data ?? result?.threads ?? [];
  return rows.map((thread: any) => ({
    id: String(thread.id),
    title: text(thread.title) || text(thread.name) || text(thread.preview) || "Untitled thread",
    cwd: typeof thread.cwd === "string" ? thread.cwd : null,
    updatedAt: millis(thread.updatedAt ?? thread.updated_at ?? thread.createdAt),
  }));
}

export function normalizeLatestThreadHistory(result: any): string {
  const turns = Array.isArray(result?.thread?.turns) ? result.thread.turns : [];
  for (let turnIndex = turns.length - 1; turnIndex >= 0; turnIndex--) {
    const items = Array.isArray(turns[turnIndex]?.items) ? turns[turnIndex].items : [];
    const user = items.filter((item: any) => item?.type === "userMessage").flatMap((item: any) => Array.isArray(item.content) ? item.content : []).filter((part: any) => part?.type === "text" && typeof part.text === "string").map((part: any) => part.text.trim()).filter(Boolean).join("\n");
    const agentItems = items.filter((item: any) => item?.type === "agentMessage" && typeof item.text === "string" && item.text.trim());
    const preferred = [...agentItems].reverse().find((item: any) => item.phase === "final_answer") ?? agentItems.at(-1);
    const agent = preferred?.text?.trim() ?? "";
    if (user || agent) return [user && `你：\n${user}`, agent && `Codex：\n${agent}`].filter(Boolean).join("\n\n");
  }
  return "";
}

export function normalizeNotification(message: any): ServerEvent | null {
  const p = message.params ?? {};
  const threadId = String(p.threadId ?? p.thread_id ?? p.thread?.id ?? "");
  const turnId = String(p.turnId ?? p.turn_id ?? p.turn?.id ?? "");
  switch (message.method) {
    case "turn/started": return { type: "turn.started", threadId, turnId };
    case "turn/completed": return { type: "turn.completed", threadId, turnId: turnId || null, status: p.turn?.status ?? p.status ?? "completed" };
    case "item/agentMessage/delta": return { type: "message.delta", threadId, itemId: String(p.itemId ?? p.item_id ?? "agent"), text: text(p.delta) };
    case "item/completed": {
      if (p.item?.type === "agentMessage") return { type: "message.completed", threadId, itemId: String(p.item.id), text: text(p.item.text) };
      return null;
    }
    case "turn/diff/updated": return { type: "diff.updated", threadId, diff: text(p.diff) };
    default: return null;
  }
}

export function normalizeApproval(message: any): ApprovalRequest {
  const p = message.params ?? {};
  const command = Array.isArray(p.command) ? p.command.join(" ") : text(p.command) || text(p.commandLine);
  return {
    id: String(message.id),
    threadId: String(p.threadId ?? p.thread_id ?? ""),
    turnId: p.turnId ?? p.turn_id ?? null,
    kind: String(message.method),
    title: message.method.includes("file") || message.method.includes("patch") ? "Approve file changes" : "Approve command",
    command: command || null,
    cwd: p.cwd ?? null,
    reason: p.reason ?? p.justification ?? null,
    createdAt: Date.now(),
  };
}

export const isApprovalMethod = (method: string) => /requestApproval|request_approval/i.test(method);

import type { AgentSlot, ControllerSnapshot, ServerEvent, ThreadSummary } from "@codex-micro/protocol";

export const createSlots = (): AgentSlot[] => Array.from({ length: 10 }, (_, index) => ({
  slotId: index + 1,
  threadId: null,
  title: null,
  projectName: null,
  state: "unassigned",
  selected: false,
  updatedAt: Date.now(),
}));

export const createSnapshot = (): ControllerSnapshot => ({
  slots: createSlots(), threads: [], approvals: [], selectedSlotId: null,
  activeTurns: {}, outputs: {}, previousOutputs: {}, threadHistories: {}, diffs: {}, models: [], codexHealth: "restarting",
});

const projectName = (cwd: string | null) => cwd?.split(/[\\/]/).filter(Boolean).at(-1) ?? null;

export function assignSlot(slot: AgentSlot, thread: ThreadSummary | null): AgentSlot {
  return {
    ...slot,
    threadId: thread?.id ?? null,
    title: thread?.title ?? null,
    projectName: projectName(thread?.cwd ?? null),
    state: thread ? "idle" : "unassigned",
    updatedAt: thread?.updatedAt ?? Date.now(),
  };
}

export function syncSlot(slot: AgentSlot, thread: ThreadSummary): AgentSlot {
  return {
    ...slot,
    title: thread.title,
    projectName: projectName(thread.cwd),
    updatedAt: Math.max(slot.updatedAt, thread.updatedAt),
  };
}

export function reduceController(state: ControllerSnapshot, event: ServerEvent): ControllerSnapshot {
  if (event.type === "snapshot") return { ...event.state, previousOutputs: event.state.previousOutputs ?? {}, threadHistories: event.state.threadHistories ?? {} };
  if (event.type === "threads.updated") return { ...state, threads: event.threads };
  if (event.type === "thread.history.updated") return { ...state, threadHistories: { ...(state.threadHistories ?? {}), [event.threadId]: event.text } };
  if (event.type === "models.updated") return { ...state, models: event.models };
  if (event.type === "connection.health") return { ...state, codexHealth: event.codex };
  if (event.type === "slot.updated") {
    const slots = state.slots.map((slot) => {
      if (slot.slotId === event.slot.slotId) return event.slot;
      return event.slot.selected ? { ...slot, selected: false } : slot;
    });
    return { ...state, slots, selectedSlotId: slots.find((slot) => slot.selected)?.slotId ?? null };
  }
  if (event.type === "message.delta" || event.type === "message.completed") {
    const current = state.outputs[event.threadId] ?? "";
    return { ...state, outputs: { ...state.outputs, [event.threadId]: event.type === "message.delta" ? current + event.text : (event.text || current) } };
  }
  if (event.type === "diff.updated") return { ...state, diffs: { ...state.diffs, [event.threadId]: event.diff } };
  if (event.type === "approval.requested") {
    return { ...state, approvals: [...state.approvals.filter((a) => a.id !== event.approval.id), event.approval], slots: state.slots.map((s) => s.threadId === event.approval.threadId ? { ...s, state: "needs_input", updatedAt: Date.now() } : s) };
  }
  if (event.type === "approval.resolved") {
    const resolved = state.approvals.find((approval) => approval.id === event.approvalRequestId);
    const approvals = state.approvals.filter((approval) => approval.id !== event.approvalRequestId);
    if (!resolved) return { ...state, approvals };
    const stillWaiting = approvals.some((approval) => approval.threadId === resolved.threadId);
    return {
      ...state,
      approvals,
      slots: state.slots.map((slot) => slot.threadId === resolved.threadId
        ? { ...slot, state: stillWaiting ? "needs_input" : state.activeTurns[resolved.threadId] ? "running" : "idle", updatedAt: Date.now() }
        : slot),
    };
  }
  if (event.type === "turn.started") {
    const currentOutput = state.outputs[event.threadId] ?? "";
    const previousOutputs = state.previousOutputs ?? {};
    return {
      ...state,
      activeTurns: { ...state.activeTurns, [event.threadId]: event.turnId },
      outputs: { ...state.outputs, [event.threadId]: "" },
      previousOutputs: currentOutput
        ? { ...previousOutputs, [event.threadId]: currentOutput }
        : previousOutputs,
      slots: state.slots.map((s) => s.threadId === event.threadId ? { ...s, state: "running", updatedAt: Date.now() } : s),
    };
  }
  if (event.type === "turn.completed") {
    const activeTurns = { ...state.activeTurns }; delete activeTurns[event.threadId];
    return { ...state, activeTurns, slots: state.slots.map((s) => s.threadId === event.threadId ? { ...s, state: s.selected ? "idle" : event.status === "completed" ? "completed_unread" : "error", updatedAt: Date.now() } : s) };
  }
  return state;
}

export function selectSlot(state: ControllerSnapshot, slotId: number | null): ControllerSnapshot {
  return { ...state, selectedSlotId: slotId, slots: state.slots.map((s) => ({ ...s, selected: s.slotId === slotId, state: s.slotId === slotId && s.state === "completed_unread" ? "idle" : s.state })) };
}

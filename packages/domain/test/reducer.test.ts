import { describe, expect, it } from "vitest";
import { assignSlot, createSnapshot, reduceController, selectSlot, syncSlot } from "../src/index.js";

describe("controller reducer", () => {
  it("tracks unread completion and clears it on selection", () => {
    let state = createSnapshot();
    const thread = { id: "t1", title: "Work", cwd: "D:\\Code\\demo", updatedAt: 1 };
    state.slots[0] = assignSlot(state.slots[0]!, thread);
    state = reduceController(state, { type: "turn.started", threadId: "t1", turnId: "turn1" });
    state = reduceController(state, { type: "turn.completed", threadId: "t1", turnId: "turn1", status: "completed" });
    expect(state.slots[0]?.state).toBe("completed_unread");
    state = selectSlot(state, 1);
    expect(state.slots[0]?.state).toBe("idle");
  });

  it("keeps the previous completed response when a new turn starts", () => {
    let state = createSnapshot();
    state = reduceController(state, { type: "message.completed", threadId: "t1", itemId: "m1", text: "上一回合的最终信息" });
    state = reduceController(state, { type: "turn.started", threadId: "t1", turnId: "turn2" });
    expect(state.outputs.t1).toBe("");
    expect(state.previousOutputs.t1).toBe("上一回合的最终信息");
  });

  it("stores persisted thread history returned by Codex", () => {
    const state = reduceController(createSnapshot(), { type: "thread.history.updated", threadId: "t1", text: "历史最后一段" });
    expect(state.threadHistories.t1).toBe("历史最后一段");
  });

  it("marks approval as needs input", () => {
    let state = createSnapshot();
    state.slots[0] = assignSlot(state.slots[0]!, { id: "t1", title: "Work", cwd: null, updatedAt: 1 });
    state = reduceController(state, { type: "approval.requested", approval: { id: "a1", threadId: "t1", turnId: null, kind: "command", title: "Approve", command: "npm test", cwd: null, reason: null, createdAt: 1 } });
    expect(state.slots[0]?.state).toBe("needs_input");
    expect(state.approvals).toHaveLength(1);
  });

  it("returns a slot to the active turn after its approval is resolved", () => {
    let state = createSnapshot();
    state.slots[0] = assignSlot(state.slots[0]!, { id: "t1", title: "Work", cwd: null, updatedAt: 1 });
    state = reduceController(state, { type: "turn.started", threadId: "t1", turnId: "turn1" });
    state = reduceController(state, { type: "approval.requested", approval: { id: "0", threadId: "t1", turnId: "turn1", kind: "command", title: "Approve", command: "npm test", cwd: null, reason: null, createdAt: 1 } });
    state = reduceController(state, { type: "approval.resolved", approvalRequestId: "0" });

    expect(state.approvals).toEqual([]);
    expect(state.slots[0]?.state).toBe("running");
  });

  it("keeps selection exclusive and allows clearing it", () => {
    let state = selectSlot(createSnapshot(), 1);
    state = selectSlot(state, 2);
    expect(state.slots.filter((slot) => slot.selected).map((slot) => slot.slotId)).toEqual([2]);
    state = selectSlot(state, null);
    expect(state.selectedSlotId).toBeNull();
    expect(state.slots.some((slot) => slot.selected)).toBe(false);
  });

  it("clears stale selections when a selected slot update arrives", () => {
    let state = selectSlot(createSnapshot(), 1);
    state = reduceController(state, { type: "slot.updated", slot: { ...state.slots[1]!, selected: true } });
    expect(state.selectedSlotId).toBe(2);
    expect(state.slots.filter((slot) => slot.selected).map((slot) => slot.slotId)).toEqual([2]);
  });

  it("refreshes thread metadata without losing the slot runtime state", () => {
    const slot = { ...assignSlot(createSnapshot().slots[0]!, { id: "t1", title: "Old", cwd: "D:/Old", updatedAt: 1 }), state: "running" as const };
    const updated = syncSlot(slot, { id: "t1", title: "New title", cwd: "D:/Code/new-project", updatedAt: 20 });
    expect(updated).toMatchObject({ title: "New title", projectName: "new-project", state: "running", updatedAt: 20 });
  });
});

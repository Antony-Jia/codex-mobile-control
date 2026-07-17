import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { Controller } from "../src/controller.js";

describe("mobile command adapter", () => {
  const storage = () => ({
    loadSlots: () => [], loadApprovals: () => [], saveEnvelope: vi.fn(), trimEvents: vi.fn(),
    saveSlot: vi.fn(), idempotentResult: () => undefined, saveIdempotentResult: vi.fn(),
  });

  it("resumes a persisted thread and sends current app-server input fields", async () => {
    const codex = Object.assign(new EventEmitter(), {
      request: vi.fn(async (method: string) => method === "turn/start" ? { turn: { id: "turn-1" } } : {}),
      respond: vi.fn(),
    });
    const controller = new Controller(codex as any, storage() as any, "D:/Code", 100);

    await controller.command({ type: "turn.start", requestId: "r1", idempotencyKey: "i1", threadId: "thread-1", text: "hello", model: "gpt-test", effort: "high", planMode: true });

    expect(codex.request).toHaveBeenNthCalledWith(1, "thread/resume", { threadId: "thread-1", excludeTurns: true });
    expect(codex.request).toHaveBeenNthCalledWith(2, "turn/start", expect.objectContaining({
      threadId: "thread-1", model: "gpt-test", effort: "high",
      input: [{ type: "text", text: "hello", text_elements: [] }],
      collaborationMode: { mode: "plan", settings: { model: "gpt-test", reasoning_effort: "high", developer_instructions: null } },
    }));
  });

  it("creates a real Codex thread and assigns it to the requested shortcut", async () => {
    const thread = { id: "thread-new", title: "Untitled thread", cwd: "D:/Code/demo", updatedAt: 50 };
    const codex = Object.assign(new EventEmitter(), {
      request: vi.fn(async (method: string) => method === "thread/start" ? { thread } : method === "thread/list" ? { data: [thread] } : {}),
      respond: vi.fn(),
    });
    const controller = new Controller(codex as any, storage() as any, "D:/Code", 100);

    await controller.command({ type: "thread.create", requestId: "create-1", cwd: "D:/Code/demo", slotId: 2 });

    expect(controller.snapshot().selectedSlotId).toBe(2);
    expect(controller.snapshot().slots[1]).toMatchObject({ threadId: "thread-new", title: "Untitled thread", projectName: "demo", selected: true });
  });

  it("refreshes metadata for an already assigned shortcut", async () => {
    const saved = { slotId: 1, threadId: "t1", title: "Old", projectName: "old", state: "running", selected: true, updatedAt: 1 };
    const backing = { ...storage(), loadSlots: () => [saved] };
    const codex = Object.assign(new EventEmitter(), {
      request: vi.fn(async () => ({ data: [{ id: "t1", title: "Updated", cwd: "D:/Code/new", updatedAt: 1_700_000_000_000 }] })),
      respond: vi.fn(),
    });
    const controller = new Controller(codex as any, backing as any, "D:/Code", 100);

    await controller.refreshThreads();

    expect(controller.snapshot().slots[0]).toMatchObject({ title: "Updated", projectName: "new", state: "running", selected: true, updatedAt: 1_700_000_000_000 });
  });

  it("keeps the ten most recent conversations in task-dial order", async () => {
    const threads = Array.from({ length: 12 }, (_, index) => ({
      id: `thread-${index + 1}`,
      title: `Thread ${index + 1}`,
      cwd: "D:/Code/demo",
      updatedAt: index + 1,
    })).reverse();
    const codex = Object.assign(new EventEmitter(), {
      request: vi.fn(async (method: string) => method === "thread/list" ? { data: threads } : {}),
      respond: vi.fn(),
    });
    const controller = new Controller(codex as any, storage() as any, "D:/Code", 100);

    await controller.refreshThreads();

    expect(controller.snapshot().slots.slice(0, 10).map((slot) => slot.threadId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `thread-${12 - index}`),
    );
    expect(controller.snapshot().slots.slice(10).every((slot) => slot.threadId === null)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeApproval, normalizeLatestThreadHistory, normalizeNotification, normalizeThreads } from "../src/normalizer.js";

describe("Codex protocol adapter", () => {
  it("normalizes thread list", () => expect(normalizeThreads({ data: [{ id: "1", name: "Demo", cwd: "D:/Code", updatedAt: 100 }] })[0]?.title).toBe("Demo"));
  it("normalizes deltas", () => expect(normalizeNotification({ method: "item/agentMessage/delta", params: { threadId: "t", itemId: "i", delta: "hi" } })).toMatchObject({ type: "message.delta", text: "hi" }));
  it("does not leak raw approvals", () => expect(normalizeApproval({ id: 4, method: "item/commandExecution/requestApproval", params: { threadId: "t", command: ["npm", "test"] } })).toMatchObject({ id: "4", command: "npm test" }));
  it("extracts the latest persisted exchange", () => expect(normalizeLatestThreadHistory({ thread: { turns: [{ items: [{ type: "userMessage", content: [{ type: "text", text: "旧问题" }] }, { type: "agentMessage", text: "旧回答", phase: "final_answer" }] }, { items: [{ type: "userMessage", content: [{ type: "text", text: "最新问题" }] }, { type: "agentMessage", text: "处理中", phase: "commentary" }, { type: "agentMessage", text: "最新回答", phase: "final_answer" }] }] } })).toBe("你：\n最新问题\n\nCodex：\n最新回答"));
});

import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;

export const effortSchema = z.enum(["low", "medium", "high", "xhigh"]);
export type Effort = z.infer<typeof effortSchema>;

export const permissionModeSchema = z.enum(["ask", "auto", "full"]);
export type PermissionMode = z.infer<typeof permissionModeSchema>;

export type ModelOption = {
  id: string;
  model: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  defaultEffort: Effort;
  supportedEfforts: Effort[];
};

export const slotStateSchema = z.enum([
  "unassigned", "idle", "running", "needs_input", "completed_unread", "error",
]);
export type AgentSlotState = z.infer<typeof slotStateSchema>;

export const agentSlotSchema = z.object({
  slotId: z.number().int().min(1).max(10),
  threadId: z.string().nullable(),
  title: z.string().nullable(),
  projectName: z.string().nullable(),
  state: slotStateSchema,
  selected: z.boolean(),
  updatedAt: z.number(),
});
export type AgentSlot = z.infer<typeof agentSlotSchema>;

export const threadSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  cwd: z.string().nullable(),
  updatedAt: z.number(),
});
export type ThreadSummary = z.infer<typeof threadSummarySchema>;

export const approvalSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  turnId: z.string().nullable(),
  kind: z.string(),
  title: z.string(),
  command: z.string().nullable(),
  cwd: z.string().nullable(),
  reason: z.string().nullable(),
  createdAt: z.number(),
});
export type ApprovalRequest = z.infer<typeof approvalSchema>;

export const clientCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("auth"), deviceId: z.string().min(1), accessToken: z.string().min(1), lastSeq: z.number().int().nonnegative() }),
  z.object({ type: z.literal("thread.list"), requestId: z.string() }),
  z.object({ type: z.literal("thread.history"), requestId: z.string(), threadId: z.string() }),
  z.object({ type: z.literal("model.list"), requestId: z.string() }),
  z.object({ type: z.literal("thread.create"), requestId: z.string(), cwd: z.string().optional(), slotId: z.number().int().min(1).max(10).optional(), permissionMode: permissionModeSchema.optional() }),
  z.object({ type: z.literal("thread.fork"), requestId: z.string(), threadId: z.string() }),
  z.object({ type: z.literal("slot.assign"), requestId: z.string(), slotId: z.number().int().min(1).max(10), threadId: z.string().nullable() }),
  z.object({ type: z.literal("slot.select"), requestId: z.string(), slotId: z.number().int().min(1).max(10).nullable() }),
  z.object({ type: z.literal("turn.start"), requestId: z.string(), idempotencyKey: z.string(), threadId: z.string(), text: z.string().min(1), model: z.string().optional(), effort: effortSchema.optional(), planMode: z.boolean().optional(), permissionMode: permissionModeSchema.optional() }),
  z.object({ type: z.literal("turn.steer"), requestId: z.string(), threadId: z.string(), turnId: z.string(), text: z.string().min(1) }),
  z.object({ type: z.literal("turn.interrupt"), requestId: z.string(), threadId: z.string(), turnId: z.string() }),
  z.object({ type: z.literal("approval.respond"), requestId: z.string(), approvalRequestId: z.string(), decision: z.enum(["accept", "acceptForSession", "decline", "cancel"]) }),
  z.object({ type: z.literal("desktop.openThread"), requestId: z.string(), threadId: z.string() }),
]);
export type ClientCommand = z.infer<typeof clientCommandSchema>;

export type ControllerSnapshot = {
  slots: AgentSlot[];
  threads: ThreadSummary[];
  approvals: ApprovalRequest[];
  selectedSlotId: number | null;
  activeTurns: Record<string, string>;
  outputs: Record<string, string>;
  previousOutputs: Record<string, string>;
  threadHistories: Record<string, string>;
  diffs: Record<string, string>;
  models: ModelOption[];
  codexHealth: "ready" | "restarting" | "error";
};

export type ServerEvent =
  | { type: "snapshot"; state: ControllerSnapshot }
  | { type: "threads.updated"; threads: ThreadSummary[] }
  | { type: "thread.history.updated"; threadId: string; text: string }
  | { type: "models.updated"; models: ModelOption[] }
  | { type: "slot.updated"; slot: AgentSlot }
  | { type: "turn.started"; threadId: string; turnId: string }
  | { type: "turn.completed"; threadId: string; turnId: string | null; status: string }
  | { type: "message.delta"; threadId: string; itemId: string; text: string }
  | { type: "message.completed"; threadId: string; itemId: string; text: string }
  | { type: "diff.updated"; threadId: string; diff: string }
  | { type: "approval.requested"; approval: ApprovalRequest }
  | { type: "approval.resolved"; approvalRequestId: string }
  | { type: "connection.health"; codex: "ready" | "restarting" | "error" }
  | { type: "command.result"; requestId: string; ok: boolean; data?: unknown; error?: string };

export type EventEnvelope<T = ServerEvent> = {
  protocolVersion: typeof PROTOCOL_VERSION;
  serverEpoch: string;
  seq: number;
  sentAt: number;
  event: T;
};

export const pairingRequestSchema = z.object({ deviceId: z.string().min(1), pairingCode: z.string().regex(/^\d{3}-\d{3}$/) });
export type PairingRequest = z.infer<typeof pairingRequestSchema>;

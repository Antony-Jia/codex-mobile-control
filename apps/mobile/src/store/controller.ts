import { create } from "zustand";
import { createSnapshot, reduceController, selectSlot as selectSlotState } from "@codex-micro/domain";
import type { ClientCommand, ControllerSnapshot, Effort, EventEnvelope } from "@codex-micro/protocol";
import { clearConnection, loadConnection, saveConnection, type Connection } from "../lib/persistence";

type Store = {
  state: ControllerSnapshot;
  connection: Connection | null;
  status: "loading" | "disconnected" | "connecting" | "connected" | "error";
  error: string | null;
  effort: Effort;
  model: string | null;
  socket: WebSocket | null;
  pendingRequests: Record<string, ClientCommand["type"]>;
  commandError: string | null;
  boot: () => Promise<void>;
  pair: (host: string, pairingCode: string) => Promise<void>;
  connect: () => void;
  disconnect: () => Promise<void>;
  send: (command: ClientCommand) => void;
  selectSlot: (slotId: number) => void;
  setEffort: (effort: Effort) => void;
  setModel: (model: string) => void;
  clearCommandError: () => void;
};

const normalizeHost = (host: string) => host.trim().replace(/\/$/, "");
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const useController = create<Store>((set, get) => ({
  state: createSnapshot(), connection: null, status: "loading", error: null, effort: "medium", model: null, socket: null, pendingRequests: {}, commandError: null,
  boot: async () => { const connection = await loadConnection(); set({ connection, status: connection ? "connecting" : "disconnected" }); if (connection) get().connect(); },
  pair: async (rawHost, pairingCode) => {
    const host = normalizeHost(rawHost); const deviceId = `android-${Math.random().toString(36).slice(2, 12)}`;
    const response = await fetch(`${host}/pair`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId, pairingCode }) });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? `Pairing failed (${response.status})`);
    const payload = await response.json(); const connection = { host, deviceId, accessToken: payload.accessToken, lastSeq: 0, serverEpoch: payload.serverEpoch };
    await saveConnection(connection); set({ connection, status: "connecting", error: null }); get().connect();
  },
  connect: () => {
    const connection = get().connection; if (!connection) return;
    const current = get().socket;
    if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) return;
    const wsUrl = connection.host.replace(/^http/, "ws") + "/micro"; const socket = new WebSocket(wsUrl); set({ socket, status: "connecting", error: null });
    socket.onopen = () => socket.send(JSON.stringify({ type: "auth", deviceId: connection.deviceId, accessToken: connection.accessToken, lastSeq: connection.lastSeq }));
    socket.onmessage = async (message) => {
      if (get().socket !== socket) return;
      const payload = JSON.parse(String(message.data)) as EventEnvelope | { error?: string };
      if (!("event" in payload) || !payload.event) { if ("error" in payload && payload.error) set({ commandError: payload.error }); return; }
      const envelope = payload;
      const pendingType = envelope.event.type === "command.result"
        ? get().pendingRequests[envelope.event.requestId]
        : undefined;
      let next = reduceController(get().state, envelope.event);
      // The companion publishes a thread.history.updated event before the
      // command result, but keeping the result as a second source of truth
      // makes history resilient to reconnects or a missed intermediate event.
      if (envelope.event.type === "command.result" && envelope.event.ok && pendingType === "thread.history") {
        const data = envelope.event.data;
        if (data && typeof data === "object" && "threadId" in data && "text" in data
          && typeof data.threadId === "string" && typeof data.text === "string") {
          next = reduceController(next, { type: "thread.history.updated", threadId: data.threadId, text: data.text });
        }
      }
      const updated = { ...connection, lastSeq: envelope.seq, serverEpoch: envelope.serverEpoch };
      const selectedModel = get().model ?? next.models.find((item) => item.isDefault)?.model ?? next.models[0]?.model ?? null;
      const selected = next.models.find((item) => item.model === selectedModel);
      const effort = selected && !selected.supportedEfforts.includes(get().effort) ? selected.defaultEffort : get().effort;
      const pendingRequests = { ...get().pendingRequests };
      let commandError = get().commandError;
      if (envelope.event.type === "command.result") { delete pendingRequests[envelope.event.requestId]; commandError = envelope.event.ok ? null : envelope.event.error ?? "命令执行失败"; }
      set({ state: next, connection: updated, status: "connected", model: selectedModel, effort, pendingRequests, commandError }); await saveConnection(updated);
    };
    socket.onerror = () => { if (get().socket === socket) set({ status: "error", error: "Cannot connect to Companion" }); };
    socket.onclose = () => { if (get().socket !== socket) return; set({ status: "disconnected", socket: null }); setTimeout(() => get().connection && !get().socket && get().connect(), 2500); };
  },
  disconnect: async () => { const current = get().connection; const socket = get().socket; set({ connection: null, socket: null, status: "disconnected", state: createSnapshot(), pendingRequests: {} }); socket?.close(); await clearConnection(current?.deviceId); },
  send: (command) => {
    const socket = get().socket; if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("Companion is not connected");
    if ("requestId" in command) set({ pendingRequests: { ...get().pendingRequests, [command.requestId]: command.type }, commandError: null });
    socket.send(JSON.stringify(command));
  },
  selectSlot: (slotId) => {
    set({ state: selectSlotState(get().state, slotId), commandError: null });
    get().send({ type: "slot.select", requestId: id(), slotId });
  },
  setEffort: (effort) => set({ effort }),
  setModel: (model) => {
    const option = get().state.models.find((item) => item.model === model);
    set({ model, effort: option && !option.supportedEfforts.includes(get().effort) ? option.defaultEffort : get().effort });
  },
  clearCommandError: () => set({ commandError: null }),
}));

export const commandId = id;

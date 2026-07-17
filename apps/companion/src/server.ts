import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { randomInt, timingSafeEqual } from "node:crypto";
import { clientCommandSchema, pairingRequestSchema, PROTOCOL_VERSION, type EventEnvelope } from "@codex-micro/protocol";
import type { Controller } from "./controller.js";
import type { Storage } from "./storage.js";

export async function createServer(controller: Controller, storage: Storage, pairingCode: string) {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true }); await app.register(websocket);

  app.get("/health", async () => ({ ok: true, protocolVersion: PROTOCOL_VERSION, serverEpoch: controller.epoch, codex: controller.snapshot().codexHealth }));
  app.post("/pair", async (request, reply) => {
    const parsed = pairingRequestSchema.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: "Invalid pairing request" });
    const expected = Buffer.from(pairingCode); const actual = Buffer.from(parsed.data.pairingCode);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return reply.code(403).send({ error: "Invalid or expired pairing code" });
    return { accessToken: storage.issueToken(parsed.data.deviceId), serverEpoch: controller.epoch, protocolVersion: PROTOCOL_VERSION };
  });
  app.get("/devices", async () => ({ devices: storage.listDevices() }));
  app.delete<{ Params: { deviceId: string } }>("/devices/:deviceId", async (request) => { storage.revokeDevice(request.params.deviceId); return { ok: true }; });

  app.get("/micro", { websocket: true }, (socket) => {
    let authenticated = false;
    const listener = (envelope: EventEnvelope) => { if (authenticated && socket.readyState === socket.OPEN) socket.send(JSON.stringify(envelope)); };
    controller.on("event", listener);
    const timer = setTimeout(() => socket.close(4401, "Authentication timeout"), 10_000);
    socket.on("message", async (raw: { toString(): string }) => {
      let payload: unknown; try { payload = JSON.parse(raw.toString()); } catch { socket.send(JSON.stringify({ error: "Invalid JSON" })); return; }
      const parsed = clientCommandSchema.safeParse(payload); if (!parsed.success) { socket.send(JSON.stringify({ error: "Invalid command", details: parsed.error.issues })); return; }
      const command = parsed.data;
      if (!authenticated) {
        if (command.type !== "auth" || !storage.validateToken(command.deviceId, command.accessToken)) { socket.close(4403, "Invalid credentials"); return; }
        authenticated = true; clearTimeout(timer);
        const currentSeq = controller.currentSeq();
        const replay = command.lastSeq > 0 && command.lastSeq < currentSeq
          ? storage.eventsAfter(command.lastSeq, controller.epoch)
          : [];
        if (replay.length > 0 && replay.length === currentSeq - command.lastSeq) {
          for (const envelope of replay) socket.send(JSON.stringify(envelope));
        } else {
          socket.send(JSON.stringify({ protocolVersion: PROTOCOL_VERSION, serverEpoch: controller.epoch, seq: currentSeq, sentAt: Date.now(), event: { type: "snapshot", state: controller.snapshot() } }));
        }
        return;
      }
      if (command.type === "auth") return;
      const requestId = "requestId" in command ? command.requestId : undefined;
      app.log.info({ command: command.type, requestId }, "mobile command");
      try { const data = await controller.command(command); if (requestId) controller.publish({ type: "command.result", requestId, ok: true, data }); }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        app.log.error({ command: command.type, requestId, error: message }, "mobile command failed");
        if (requestId) controller.publish({ type: "command.result", requestId, ok: false, error: message });
      }
    });
    socket.on("close", () => { clearTimeout(timer); controller.off("event", listener); });
  });
  return app;
}

export const generatePairingCode = () => `${randomInt(100, 1000)}-${randomInt(100, 1000)}`;

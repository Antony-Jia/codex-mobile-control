import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AgentSlot, ApprovalRequest, EventEnvelope, ServerEvent } from "@codex-micro/protocol";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export class Storage {
  private readonly db: DatabaseSync;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new DatabaseSync(path.join(dataDir, "companion.sqlite"));
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS devices(device_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, created_at INTEGER NOT NULL, revoked_at INTEGER);
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY, epoch TEXT NOT NULL, sent_at INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS slots(slot_id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS approvals(id TEXT PRIMARY KEY, payload TEXT NOT NULL, raw_request TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS idempotency(key TEXT PRIMARY KEY, result TEXT NOT NULL, created_at INTEGER NOT NULL);
    `);
  }

  issueToken(deviceId: string) {
    const token = randomBytes(32).toString("base64url");
    this.db.prepare("INSERT INTO devices(device_id, token_hash, created_at, revoked_at) VALUES(?,?,?,NULL) ON CONFLICT(device_id) DO UPDATE SET token_hash=excluded.token_hash, created_at=excluded.created_at, revoked_at=NULL").run(deviceId, hash(token), Date.now());
    return token;
  }

  validateToken(deviceId: string, token: string) {
    const row = this.db.prepare("SELECT token_hash FROM devices WHERE device_id=? AND revoked_at IS NULL").get(deviceId) as { token_hash: string } | undefined;
    return Boolean(row && row.token_hash === hash(token));
  }

  listDevices() { return this.db.prepare("SELECT device_id AS deviceId, created_at AS createdAt, revoked_at AS revokedAt FROM devices ORDER BY created_at DESC").all(); }
  revokeDevice(deviceId: string) { this.db.prepare("UPDATE devices SET revoked_at=? WHERE device_id=?").run(Date.now(), deviceId); }

  saveEnvelope(envelope: EventEnvelope) {
    this.db.prepare("INSERT OR REPLACE INTO events(seq,epoch,sent_at,payload) VALUES(?,?,?,?)").run(envelope.seq, envelope.serverEpoch, envelope.sentAt, JSON.stringify(envelope));
  }
  eventsAfter(seq: number, epoch: string): EventEnvelope[] {
    return (this.db.prepare("SELECT payload FROM events WHERE seq>? AND epoch=? ORDER BY seq").all(seq, epoch) as { payload: string }[]).map((row) => JSON.parse(row.payload));
  }
  trimEvents(limit: number) { this.db.prepare("DELETE FROM events WHERE seq <= (SELECT COALESCE(MAX(seq),0)-? FROM events)").run(limit); }

  loadSlots(): AgentSlot[] { return (this.db.prepare("SELECT payload FROM slots ORDER BY slot_id").all() as { payload: string }[]).map((r) => JSON.parse(r.payload)); }
  saveSlot(slot: AgentSlot) { this.db.prepare("INSERT OR REPLACE INTO slots(slot_id,payload) VALUES(?,?)").run(slot.slotId, JSON.stringify(slot)); }

  saveApproval(approval: ApprovalRequest, rawRequest: unknown) { this.db.prepare("INSERT OR REPLACE INTO approvals(id,payload,raw_request) VALUES(?,?,?)").run(approval.id, JSON.stringify(approval), JSON.stringify(rawRequest)); }
  deleteApproval(id: string) { this.db.prepare("DELETE FROM approvals WHERE id=?").run(id); }
  clearApprovals() { this.db.prepare("DELETE FROM approvals").run(); }
  loadApprovals(): ApprovalRequest[] { return (this.db.prepare("SELECT payload FROM approvals").all() as { payload: string }[]).map((r) => JSON.parse(r.payload)); }
  loadRawApproval(id: string): unknown { const row = this.db.prepare("SELECT raw_request FROM approvals WHERE id=?").get(id) as { raw_request: string } | undefined; return row ? JSON.parse(row.raw_request) : null; }

  idempotentResult(key: string): unknown | undefined { const row = this.db.prepare("SELECT result FROM idempotency WHERE key=?").get(key) as { result: string } | undefined; return row ? JSON.parse(row.result) : undefined; }
  saveIdempotentResult(key: string, result: unknown) { this.db.prepare("INSERT OR REPLACE INTO idempotency(key,result,created_at) VALUES(?,?,?)").run(key, JSON.stringify(result), Date.now()); }
}

import { EventEmitter } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";

type RpcMessage = { id?: number | string; method?: string; params?: any; result?: any; error?: any };

export class CodexClient extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private requestId = 1;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private stopping = false;

  constructor(private readonly bin: string) { super(); }

  async start() {
    this.stopping = false;
    this.child = spawn(this.bin, ["app-server", "--listen", "stdio://"], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, env: process.env });
    const lines = readline.createInterface({ input: this.child.stdout });
    lines.on("line", (line) => { try { this.onMessage(JSON.parse(line)); } catch { this.emit("log", `Invalid app-server line: ${line}`); } });
    this.child.stderr.on("data", (data) => this.emit("log", String(data).trim()));
    this.child.on("exit", (code) => { this.child = null; this.rejectPending(new Error(`Codex app-server exited with code ${code}`)); this.emit("exit", code); if (!this.stopping) setTimeout(() => void this.restart(), 1500); });
    await this.request("initialize", { clientInfo: { name: "codex_micro_companion", title: "Codex Micro Companion", version: "0.1.0" }, capabilities: { experimentalApi: true } });
    this.notify("initialized", {});
    this.emit("ready");
  }

  private async restart() { try { await this.start(); } catch (error) { this.emit("error", error); if (!this.stopping) setTimeout(() => void this.restart(), 3000); } }
  stop() { this.stopping = true; this.child?.kill(); }

  request(method: string, params: unknown): Promise<any> {
    if (!this.child) return Promise.reject(new Error("Codex app-server is not running"));
    const id = this.requestId++;
    this.child.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  notify(method: string, params: unknown) { if (!this.child) throw new Error("Codex app-server is not running"); this.child.stdin.write(`${JSON.stringify({ method, params })}\n`); }
  respond(id: string | number, result: unknown) { if (!this.child) throw new Error("Codex app-server is not running"); this.child.stdin.write(`${JSON.stringify({ id, result })}\n`); }

  private onMessage(message: RpcMessage) {
    if (message.id !== undefined && !message.method) {
      const key = typeof message.id === "number" ? message.id : Number(message.id);
      const pending = this.pending.get(key); if (!pending) return;
      this.pending.delete(key);
      if (message.error) pending.reject(new Error(message.error.message ?? JSON.stringify(message.error))); else pending.resolve(message.result);
      return;
    }
    if (message.method && message.id !== undefined) this.emit("serverRequest", message);
    else if (message.method) this.emit("notification", message);
  }
  private rejectPending(error: Error) { for (const p of this.pending.values()) p.reject(error); this.pending.clear(); }
}

import qrcode from "qrcode-terminal";
import { config } from "./config.js";
import { Storage } from "./storage.js";
import { CodexClient } from "./codex-client.js";
import { Controller } from "./controller.js";
import { createServer, generatePairingCode } from "./server.js";

const storage = new Storage(config.dataDir);
const codex = new CodexClient(config.codexBin);
const controller = new Controller(codex, storage, config.defaultCwd, config.eventLimit);
const pairingCode = generatePairingCode();
const server = await createServer(controller, storage, pairingCode);
await server.listen({ host: config.host, port: config.port });

const payload = JSON.stringify({ version: 1, host: `http://${config.publicHost}:${config.port}`, pairingCode, expiresAt: Date.now() + 30 * 60_000 });
console.log(`\nPairing code: ${pairingCode}\nServer: http://${config.publicHost}:${config.port}\n`);
qrcode.generate(payload, { small: true });
codex.on("log", (line) => line && server.log.info({ source: "codex" }, line));
codex.on("error", (error) => server.log.error(error));
await codex.start();

const shutdown = async () => { codex.stop(); await server.close(); process.exit(0); };
process.on("SIGINT", () => void shutdown()); process.on("SIGTERM", () => void shutdown());

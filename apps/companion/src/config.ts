import path from "node:path";

const int = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  host: process.env.MICRO_HOST ?? "0.0.0.0",
  port: int(process.env.MICRO_PORT, 8787),
  publicHost: process.env.MICRO_PUBLIC_HOST ?? "127.0.0.1",
  codexBin: process.env.CODEX_BIN ?? (process.platform === "win32" ? "codex.exe" : "codex"),
  dataDir: path.resolve(process.env.MICRO_DATA_DIR ?? "data"),
  eventLimit: int(process.env.MICRO_EVENT_LIMIT, 5000),
  defaultCwd: process.env.MICRO_DEFAULT_CWD ?? process.cwd(),
};

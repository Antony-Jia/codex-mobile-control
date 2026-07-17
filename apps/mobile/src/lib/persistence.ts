import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";

const dbPromise = SQLite.openDatabaseAsync("codex-micro.sqlite");
const tokenKey = (deviceId: string) => `token.${deviceId}`;

export type Connection = { host: string; deviceId: string; accessToken: string; lastSeq: number; serverEpoch?: string };

export async function initializePersistence() {
  const db = await dbPromise;
  await db.execAsync("CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)");
}

export async function loadConnection(): Promise<Connection | null> {
  await initializePersistence();
  const db = await dbPromise;
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key='connection'");
  if (!row) return null;
  const publicData = JSON.parse(row.value) as Omit<Connection, "accessToken">;
  const accessToken = await SecureStore.getItemAsync(tokenKey(publicData.deviceId));
  return accessToken ? { ...publicData, accessToken } : null;
}

export async function saveConnection(connection: Connection) {
  await initializePersistence();
  await SecureStore.setItemAsync(tokenKey(connection.deviceId), connection.accessToken);
  const { accessToken: _, ...publicData } = connection;
  const db = await dbPromise;
  await db.runAsync("INSERT OR REPLACE INTO kv(key,value) VALUES('connection',?)", JSON.stringify(publicData));
}

export async function clearConnection(deviceId?: string) {
  const db = await dbPromise; await db.runAsync("DELETE FROM kv WHERE key='connection'");
  if (deviceId) await SecureStore.deleteItemAsync(tokenKey(deviceId));
}

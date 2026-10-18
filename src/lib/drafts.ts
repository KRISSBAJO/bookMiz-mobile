import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const queues = new Map<string, Promise<unknown>>();
const keyFor = (key: string) =>
  `bm_draft_${key.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
const get = (key: string) =>
  Platform.OS === "web"
    ? Promise.resolve(globalThis.sessionStorage?.getItem(key) ?? null)
    : SecureStore.getItemAsync(key);
const put = (key: string, value: string) =>
  Platform.OS === "web"
    ? Promise.resolve(globalThis.sessionStorage?.setItem(key, value))
    : SecureStore.setItemAsync(key, value);
const remove = (key: string) =>
  Platform.OS === "web"
    ? Promise.resolve(globalThis.sessionStorage?.removeItem(key))
    : SecureStore.deleteItemAsync(key);
type Index = { version: string; count: number };
function parseIndex(raw: string | null): Index | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (
    typeof parsed.version !== "string" ||
    !/^[a-z0-9]+$/.test(parsed.version) ||
    !Number.isInteger(parsed.count) ||
    parsed.count < 1 ||
    parsed.count > 300
  )
    throw new Error("Invalid saved draft.");
  return parsed;
}
export async function readDraft<T>(key: string): Promise<T | null> {
  const base = keyFor(key);
  await queues.get(base)?.catch(() => {});
  const index = parseIndex(await get(base));
  if (!index) return null;
  const chunks = await Promise.all(
    Array.from({ length: index.count }, (_, i) =>
      get(`${base}_${index.version}_${i}`),
    ),
  );
  if (chunks.some((chunk) => chunk === null))
    throw new Error("Saved draft is incomplete.");
  return JSON.parse(chunks.join("")) as T;
}
export function writeDraft(key: string, value: unknown | null): Promise<void> {
  const base = keyFor(key);
  const pending = (queues.get(base) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const previous = parseIndex(await get(base));
      if (value === null) await remove(base);
      else {
        const json = JSON.stringify(value);
        // Small chunks remain below SecureStore's item limit even with non-ASCII text.
        const characters = Array.from(json);
        const chunks = Array.from(
          { length: Math.ceil(characters.length / 180) },
          (_, i) => characters.slice(i * 180, (i + 1) * 180).join(""),
        );
        if (!chunks.length || chunks.length > 300)
          throw new Error("Draft is too large to save on this device.");
        const version =
          Date.now().toString(36) + Math.random().toString(36).slice(2);
        for (const [i, chunk] of chunks.entries())
          await put(`${base}_${version}_${i}`, chunk);
        await put(base, JSON.stringify({ version, count: chunks.length }));
      }
      if (previous)
        await Promise.all(
          Array.from({ length: previous.count }, (_, i) =>
            remove(`${base}_${previous.version}_${i}`),
          ),
        );
    });
  queues.set(base, pending);
  void pending
    .finally(() => {
      if (queues.get(base) === pending) queues.delete(base);
    })
    .catch(() => {});
  return pending;
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  ts = require("typescript");
function fixture() {
  const storage = new Map(),
    output = {};
  const secure = {
    getItemAsync: async (key) => storage.get(key) ?? null,
    setItemAsync: async (key, value) => {
      assert.ok(Buffer.byteLength(value, "utf8") < 2048);
      storage.set(key, Buffer.from(value, "utf8").toString("utf8"));
    },
    deleteItemAsync: async (key) => {
      storage.delete(key);
    },
  };
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/drafts.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  new Function("exports", "require", code)(output, (name) =>
    name === "react-native" ? { Platform: { OS: "ios" } } : secure,
  );
  return { api: output, storage };
}
test("encrypted draft chunks round-trip long Unicode content without exceeding item limits", async () => {
  const { api } = fixture();
  const data = { description: "hair ✂️ 😀 你好 ".repeat(500) };
  await api.writeDraft("user-a_request", data);
  assert.deepEqual(await api.readDraft("user-a_request"), data);
  assert.equal(await api.readDraft("user-b_request"), null);
});
test("queued saves and clear never resurrect a completed draft and remove old chunks", async () => {
  const { api, storage } = fixture();
  const jobs = [
    api.writeDraft("a", { value: "old" }),
    api.writeDraft("a", { value: "new" }),
    api.writeDraft("a", null),
  ];
  await Promise.all(jobs);
  assert.equal(await api.readDraft("a"), null);
  assert.equal(storage.size, 0);
  await api.writeDraft("a", { value: "replacement" });
  assert.deepEqual(await api.readDraft("a"), { value: "replacement" });
});

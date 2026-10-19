import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  ts = require("typescript");
function fixture(platform = "ios") {
  const saved = new Map(),
    calls = [];
  let accessToken = "account-a-token",
    granted = false,
    prompted = 0,
    tokenWait = null;
  const dependencies = {
    "expo-secure-store": {
      getItemAsync: async (key) => saved.get(key) || null,
      setItemAsync: async (key, value) => saved.set(key, value),
      deleteItemAsync: async (key) => saved.delete(key),
    },
    "react-native": { Platform: { OS: platform } },
    "@/src/lib/api/client": {
      getAuthTokens: () => (accessToken ? { accessToken } : null),
    },
    "expo-notifications": {
      AndroidImportance: { DEFAULT: 3 },
      setNotificationChannelAsync: async (...args) =>
        calls.push(["channel", ...args]),
      getPermissionsAsync: async () => ({ granted }),
      requestPermissionsAsync: async () => {
        prompted++;
        return { granted };
      },
      getExpoPushTokenAsync: async () => {
        if (tokenWait) await tokenWait;
        return { data: "ExponentPushToken[fixture]" };
      },
    },
    "@/src/lib/api/notifications": {
      registerPushDevice: async (...args) => calls.push(["register", ...args]),
      unregisterPushDevice: async (...args) =>
        calls.push(["unregister", ...args]),
    },
  };
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/mobile-push.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const api = {};
  new Function("require", "exports", code)((name) => {
    if (!(name in dependencies)) throw Error(name);
    return dependencies[name];
  }, api);
  return {
    api,
    calls,
    saved,
    setPermission: (value) => {
      granted = value;
    },
    setAccess: (value) => {
      accessToken = value;
    },
    wait: (value) => {
      tokenWait = value;
    },
    get prompts() {
      return prompted;
    },
  };
}
test("denied push permission never registers a device; enabling binds it to the current account", async () => {
  const f = fixture();
  await assert.rejects(f.api.enablePush("a"), /not permitted/);
  assert.equal(f.calls.length, 0);
  f.setPermission(true);
  await f.api.enablePush("a");
  assert.deepEqual(f.calls[0], [
    "register",
    "ExponentPushToken[fixture]",
    "ios",
    "account-a-token",
  ]);
  assert.equal((await f.api.getPushRegistration()).userId, "a");
  await f.api.disablePush("b");
  assert.equal(f.calls.length, 1);
  assert.equal(f.saved.size, 1);
  await f.api.disablePush("a", "old-account-a-token");
  assert.deepEqual(f.calls[1], [
    "unregister",
    "ExponentPushToken[fixture]",
    "ios",
    "old-account-a-token",
  ]);
  assert.equal(f.saved.size, 0);
});

test("Android creates its notification channel before requesting a token and registers its platform", async () => {
  const f = fixture("android");
  f.setPermission(true);
  await f.api.enablePush("a");
  assert.equal(f.calls[0][0], "channel");
  assert.equal(f.calls[0][1], "default");
  assert.equal(f.calls[1][0], "register");
  assert.equal(f.calls[1][2], "android");
  assert.equal((await f.api.getPushRegistration()).platform, "android");
});

test("resuming from the permission prompt does not cancel an explicit enable", async () => {
  const f = fixture("android");
  f.setPermission(true);
  let release;
  f.wait(new Promise((resolve) => { release = resolve; }));
  const enabling = f.api.enablePush("a");
  await new Promise((resolve) => setTimeout(resolve, 0));
  await f.api.refreshPushRegistration("a");
  release();
  await enabling;
  assert.equal((await f.api.getPushRegistration()).userId, "a");
  assert.equal(f.calls.filter((call) => call[0] === "register").length, 1);
});
test("a permission revocation unregisters without reprompting and an account switch cancels a late token", async () => {
  const f = fixture();
  f.setPermission(true);
  await f.api.enablePush("a");
  f.setPermission(false);
  await f.api.refreshPushRegistration("a");
  assert.equal(f.prompts, 0);
  assert.equal(f.saved.size, 0);
  f.setPermission(true);
  let release;
  f.wait(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const pending = f.api.enablePush("a");
  await new Promise((resolve) => setTimeout(resolve, 0));
  f.setAccess("account-b-token");
  release();
  await assert.rejects(pending, /session changed/);
  assert.equal(f.saved.size, 0);
  assert.equal(f.calls.filter((call) => call[0] === "register").length, 1);
});

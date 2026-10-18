import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const code = ts.transpileModule(
  readFileSync(new URL("../src/lib/api/client.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function fixture() {
  let resolveRefresh, rejectRefresh, started;
  let refreshCalls = 0;
  const start = new Promise((resolve) => {
    started = resolve;
  });
  const refresh = new Promise((resolve, reject) => {
    resolveRefresh = resolve;
    rejectRefresh = reject;
  });
  class ApiRequestError extends Error {
    constructor(message, options = {}) {
      super(message);
      Object.assign(this, options);
    }
  }
  const api = {};
  const requestWithTimeout = async (url, init, parse) => {
    if (url.endsWith("/refresh")) {
      refreshCalls++;
      started();
      return refresh;
    }
    const fresh = init.headers.get("Authorization") === "Bearer fresh";
    return parse(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: fresh ? 200 : 401,
      }),
    );
  };
  new Function("require", "exports", "__DEV__", code)(
    (name) =>
      name.endsWith("mobile-env")
        ? { mobileEnv: { identityApiUrl: "https://fixture.invalid" } }
        : name.endsWith("fetch-with-timeout")
          ? { requestWithTimeout }
          : { ApiRequestError },
    api,
    false,
  );
  return {
    api,
    start,
    resolveRefresh,
    rejectRefresh,
    ApiRequestError,
    refreshCalls: () => refreshCalls,
  };
}
const old = { accessToken: "old", refreshToken: "old-refresh" };
const fresh = {
  session: { accessToken: "fresh", refreshToken: "fresh-refresh" },
};

test("a refresh finishing after logout cannot restore tokens or retry the request", async () => {
  const f = fixture();
  await f.api.setAuthTokens(old);
  const pending = f.api.requestJson("https://fixture.invalid/private", {
    auth: true,
  });
  const rejected = assert.rejects(pending, /session changed/);
  await f.start;
  await f.api.clearAuthTokens();
  f.resolveRefresh(fresh);
  await rejected;
  assert.equal(f.api.getAuthTokens(), null);
});
test("an old refresh cannot replace a newly signed-in account", async () => {
  const f = fixture();
  await f.api.setAuthTokens(old);
  const pending = f.api.requestJson("https://fixture.invalid/private", {
    auth: true,
  });
  const rejected = assert.rejects(pending, /session changed/);
  await f.start;
  const next = { accessToken: "other-user", refreshToken: "other-refresh" };
  await f.api.setAuthTokens(next);
  f.resolveRefresh(fresh);
  await rejected;
  assert.deepEqual(f.api.getAuthTokens(), next);
});
test("concurrent unauthorized requests share one refresh and retry successfully", async () => {
  const f = fixture();
  await f.api.setAuthTokens(old);
  const a = f.api.requestJson("https://fixture.invalid/a", { auth: true });
  const b = f.api.requestJson("https://fixture.invalid/b", { auth: true });
  await f.start;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.refreshCalls(), 1);
  f.resolveRefresh(fresh);
  assert.deepEqual(await Promise.all([a, b]), [{ ok: true }, { ok: true }]);
});
test("an old failed refresh does not sign out a new account", async () => {
  const f = fixture();
  await f.api.setAuthTokens(old);
  let failures = 0;
  f.api.setAuthFailureHandler(() => {
    failures++;
  });
  const pending = f.api.requestJson("https://fixture.invalid/private", {
    auth: true,
  });
  const rejected = assert.rejects(pending, /expired/);
  await f.start;
  const next = { accessToken: "other-user", refreshToken: "other-refresh" };
  await f.api.setAuthTokens(next);
  f.rejectRefresh(new f.ApiRequestError("expired", { statusCode: 401 }));
  await rejected;
  assert.equal(failures, 0);
  assert.deepEqual(f.api.getAuthTokens(), next);
});

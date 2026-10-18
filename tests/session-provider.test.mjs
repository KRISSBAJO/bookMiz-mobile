import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  ts = require("typescript"),
  React = require("react");
const { act, create } = require("react-test-renderer");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const auth = {
  user: {
    id: "customer",
    email: "fixture@example.invalid",
    firstName: "Test",
    lastName: "Customer",
    roles: ["CUSTOMER"],
    userType: "CUSTOMER",
  },
  session: { accessToken: "fixture", refreshToken: "fixture-refresh" },
};
function fixture(overrides = {}) {
  let tokens = null,
    current;
  class ApiRequestError extends Error {
    constructor(message, options = {}) {
      super(message);
      Object.assign(this, options);
    }
  }
  const dependencies = {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "@/src/lib/api/types": { ApiRequestError },
    "@/src/lib/mobile-push": { disablePush: async () => {} },
    "@/src/lib/api/auth": {
      getCurrentAuth: async () => auth,
      getProfileSettings: async () => ({
        firstName: "Test",
        lastName: "Customer",
      }),
      loginMobile: async () => auth,
      logoutMobile: async () => {},
      ...overrides,
    },
    "@/src/lib/api/client": {
      getAuthTokens: () => tokens,
      setAuthTokens: async (value) => {
        tokens = value;
      },
      clearAuthTokens: async () => {
        tokens = null;
      },
      setAuthFailureHandler() {},
      setAuthTokenChangeHandler() {},
    },
    "@/src/lib/api/storage": {
      loadStoredTokens: async () => null,
      clearStoredTokens: async () => {},
      saveStoredTokens: async () => {},
    },
  };
  const code = ts.transpileModule(
    readFileSync(
      new URL("../src/store/session-context.tsx", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const output = {};
  new Function("require", "exports", code)((name) => {
    if (dependencies[name]) return dependencies[name];
    throw Error(name);
  }, output);
  function Probe() {
    current = output.useSession();
    return null;
  }
  return {
    mount: () =>
      create(
        React.createElement(
          output.SessionProvider,
          null,
          React.createElement(Probe),
        ),
      ),
    session: () => current,
    tokens: () => tokens,
  };
}
test("late sign-in responses cannot sign a user back in after logout", async () => {
  const response = deferred(),
    f = fixture({ loginMobile: () => response.promise });
  let tree, pending;
  await act(async () => {
    tree = f.mount();
  });
  await act(async () => {
    pending = f.session().signIn({
      email: "fixture@example.invalid",
      password: "fixture-password",
    });
    pending.catch(() => {});
  });
  await act(async () => {
    await f.session().signOut();
  });
  await act(async () => {
    response.resolve(auth);
    await assert.rejects(pending, /cancelled/);
  });
  assert.equal(f.session().isSignedIn, false);
  assert.equal(f.tokens(), null);
  await act(async () => tree.unmount());
});
test("late profile hydration cannot restore the signed-in UI after logout", async () => {
  const profile = deferred(),
    f = fixture({ getProfileSettings: () => profile.promise });
  let tree, pending;
  await act(async () => {
    tree = f.mount();
  });
  await act(async () => {
    pending = f.session().applyAuthResponse(auth);
  });
  await act(async () => {
    await f.session().signOut();
  });
  await act(async () => {
    profile.resolve({ firstName: "Test", lastName: "Customer" });
    await pending;
  });
  assert.equal(f.session().user, null);
  assert.equal(f.tokens(), null);
  await act(async () => tree.unmount());
});
test("local logout clears the account before a stalled logout API completes", async () => {
  const server = deferred(),
    f = fixture({ logoutMobile: () => server.promise });
  let tree, pending;
  await act(async () => {
    tree = f.mount();
  });
  await act(async () => {
    await f.session().applyAuthResponse(auth);
  });
  assert.equal(f.session().isSignedIn, true);
  await act(async () => {
    pending = f.session().signOut();
  });
  assert.equal(f.session().isSignedIn, false);
  assert.equal(f.tokens(), null);
  await act(async () => {
    server.resolve({});
    await pending;
  });
  await act(async () => tree.unmount());
});

for (const operation of ["updateProfile", "updateNotificationPreferences"]) {
  test(`a late ${operation} result cannot restore profile data after logout`, async () => {
    const response = deferred(),
      f = fixture({
        updateProfileSettings: () => response.promise,
        updateNotificationPreferences: () => response.promise,
      });
    let tree, pending;
    await act(async () => {
      tree = f.mount();
    });
    await act(async () => {
      await f.session().applyAuthResponse(auth);
    });
    await act(async () => {
      pending = f.session()[operation]({});
      pending.catch(() => {});
    });
    await act(async () => {
      await f.session().signOut();
    });
    await act(async () => {
      response.resolve({ firstName: "Previous account", lastName: "Fixture" });
      await assert.rejects(pending, /session changed/);
    });
    assert.equal(f.session().profile, null);
    assert.equal(f.session().user, null);
    await act(async () => tree.unmount());
  });
}

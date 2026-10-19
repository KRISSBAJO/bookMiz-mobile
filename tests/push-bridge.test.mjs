import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  ts = require("typescript"),
  React = require("react");
const { act, create } = require("react-test-renderer");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
for (const platform of ["ios", "android"])
  test(`${platform}: notification taps open the owned inbox, foreground refreshes it and listeners are removed`, async () => {
    const id = "7de11f54-3a69-4963-b39d-9142b8b6651b",
      paths = [],
      events = [],
      refreshed = [],
      removed = [];
    let tapped,
      received,
      resumed,
      handler,
      cleared = 0;
    const response = (value) => ({
      notification: {
        request: { content: { data: { notificationId: value } } },
      },
    });
    const router = { push: (value) => paths.push(value) },
      session = { user: { id: "fixture-customer" } };
    const deps = {
      react: React,
      "react/jsx-runtime": require("react/jsx-runtime"),
      "react-native": {
        Platform: { OS: platform },
        DeviceEventEmitter: { emit: (event) => events.push(event) },
        AppState: {
          addEventListener: (_, listener) => {
            resumed = listener;
            return { remove: () => removed.push("appstate") };
          },
        },
      },
      "expo-router": { useRouter: () => router },
      "@/src/store/session-context": { useSession: () => session },
      "@/src/lib/mobile-push": {
        refreshPushRegistration: async (user) => refreshed.push(user),
      },
      "expo-notifications": {
        setNotificationHandler: (value) => {
          handler = value;
        },
        addNotificationResponseReceivedListener: (listener) => {
          tapped = listener;
          return { remove: () => removed.push("tap") };
        },
        addNotificationReceivedListener: (listener) => {
          received = listener;
          return { remove: () => removed.push("received") };
        },
        getLastNotificationResponseAsync: async () => response(id),
        clearLastNotificationResponseAsync: async () => {
          cleared++;
        },
      },
    };
    const output = {},
      code = ts.transpileModule(
        readFileSync(
          new URL(
            "../src/components/PushNotificationBridge.tsx",
            import.meta.url,
          ),
          "utf8",
        ),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            jsx: ts.JsxEmit.ReactJSX,
          },
        },
      ).outputText;
    new Function("require", "exports", code)((name) => {
      if (!(name in deps)) throw Error(name);
      return deps[name];
    }, output);
    let tree;
    await act(async () => {
      tree = create(React.createElement(output.PushNotificationBridge));
    });
    assert.equal(cleared, 1);
    assert.deepEqual(paths[0], {
      pathname: "/(tabs)/inbox",
      params: { notificationId: id },
    });
    tapped(response("https://attacker.invalid"));
    tapped(response("------------------------------------"));
    assert.equal(paths.length, 1);
    tapped(response(id));
    assert.equal(paths.length, 2);
    received();
    assert.deepEqual(events, ["bookmiz-inbox-updated"]);
    resumed("active");
    assert.deepEqual(refreshed, ["fixture-customer", "fixture-customer"]);
    assert.equal((await handler.handleNotification()).shouldShowBanner, true);
    await act(async () => tree.unmount());
    assert.deepEqual(removed.sort(), ["appstate", "received", "tap"]);
  });

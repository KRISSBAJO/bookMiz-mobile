import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  ts = require("typescript"),
  React = require("react");
const { act, create } = require("react-test-renderer");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function fixture(options = {}) {
  const calls = [];
  const updates = {
    isEnabled: true,
    useUpdates: () => ({ isUpdatePending: false }),
    checkForUpdateAsync: async () => {
      calls.push("check");
      return { isAvailable: false, isRollBackToEmbedded: false };
    },
    fetchUpdateAsync: async () => {
      calls.push("fetch");
      return { isNew: true, isRollBackToEmbedded: false };
    },
    reloadAsync: async () => {
      calls.push("reload");
    },
    ...options.updates,
  };
  const deps = {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "react-native": {
      Platform: { OS: options.platform || "ios" },
      Text: "Text",
      View: "View",
      StyleSheet: { create: (x) => x },
    },
    "expo-constants": {
      __esModule: true,
      default: { nativeAppVersion: "1.0.0", nativeBuildVersion: "4" },
    },
    "expo-updates": updates,
    "@/src/components/auth/AuthButton": {
      AuthButton: (props) => React.createElement("Button", props),
    },
    "@/src/theme/tokens": { tokens: { colors: {}, font: {} } },
  };
  const output = {},
    code = ts.transpileModule(
      readFileSync(
        new URL("../src/components/AppUpdatesPanel.tsx", import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText;
  new Function("require", "exports", "__DEV__", code)(
    (name) => {
      if (!(name in deps)) throw Error(name);
      return deps[name];
    },
    output,
    options.development ?? false,
  );
  return {
    calls,
    render: () => create(React.createElement(output.AppUpdatesPanel)),
  };
}
const text = (tree) =>
  tree.root
    .findAllByType("Text")
    .flatMap((node) =>
      node.children.filter((child) => typeof child === "string"),
    )
    .join(" ");
const button = (tree) => tree.root.findByType("Button");
test("no compatible update reports its scope and never downloads or restarts", async () => {
  const f = fixture();
  let tree;
  await act(async () => {
    tree = f.render();
  });
  assert.match(text(tree), /Build 4/);
  await act(async () => {
    await button(tree).props.onPress();
  });
  assert.deepEqual(f.calls, ["check"]);
  assert.match(text(tree), /latest update available for this version/);
  await act(async () => tree.unmount());
});
for (const rollback of [false, true])
  test(`a ${rollback ? "rollback" : "new update"} downloads but restarts only after an explicit press`, async () => {
    let downloads = 0,
      restarts = 0;
    const f = fixture({
      updates: {
        checkForUpdateAsync: async () => ({
          isAvailable: !rollback,
          isRollBackToEmbedded: rollback,
        }),
        fetchUpdateAsync: async () => {
          downloads++;
          return { isNew: !rollback, isRollBackToEmbedded: rollback };
        },
        reloadAsync: async () => {
          restarts++;
        },
      },
    });
    let tree;
    await act(async () => {
      tree = f.render();
    });
    await act(async () => {
      await button(tree).props.onPress();
    });
    assert.equal(downloads, 1);
    assert.equal(restarts, 0);
    assert.equal(button(tree).props.label, "Restart to update");
    await act(async () => {
      await button(tree).props.onPress();
    });
    assert.equal(restarts, 1);
    await act(async () => tree.unmount());
  });
test("offline checks allow retry and a failed restart preserves the downloaded update", async () => {
  let failed = true;
  const f = fixture({
    updates: {
      checkForUpdateAsync: async () => {
        if (failed) throw Error("offline");
        return { isAvailable: true, isRollBackToEmbedded: false };
      },
      reloadAsync: async () => {
        throw Error("restart failed");
      },
    },
  });
  let tree;
  await act(async () => {
    tree = f.render();
  });
  await act(async () => {
    await button(tree).props.onPress();
  });
  assert.match(text(tree), /connection and try again/);
  assert.equal(button(tree).props.disabled, false);
  failed = false;
  await act(async () => {
    await button(tree).props.onPress();
  });
  await act(async () => {
    await button(tree).props.onPress();
  });
  assert.match(text(tree), /update is saved/);
  assert.equal(button(tree).props.label, "Restart to update");
  assert.equal(button(tree).props.disabled, false);
  await act(async () => tree.unmount());
});
test("an empty download is not treated as ready and a previously downloaded update can restart", async () => {
  const f = fixture({
    updates: {
      checkForUpdateAsync: async () => ({
        isAvailable: true,
        isRollBackToEmbedded: false,
      }),
      fetchUpdateAsync: async () => ({
        isNew: false,
        isRollBackToEmbedded: false,
      }),
    },
  });
  let tree;
  await act(async () => {
    tree = f.render();
  });
  await act(async () => {
    await button(tree).props.onPress();
  });
  assert.equal(button(tree).props.label, "Check for updates");
  assert.match(text(tree), /No new update was downloaded/);
  await act(async () => tree.unmount());
  const pending = fixture({
    updates: { useUpdates: () => ({ isUpdatePending: true }) },
  });
  await act(async () => {
    tree = pending.render();
  });
  assert.equal(button(tree).props.label, "Restart to update");
  await act(async () => {
    await button(tree).props.onPress();
  });
  assert.deepEqual(pending.calls, ["reload"]);
  await act(async () => tree.unmount());
});
test("repeated presses share the in-flight check and development or web previews make no OTA requests", async () => {
  let release,
    checks = 0;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  const f = fixture({
    updates: {
      checkForUpdateAsync: async () => {
        checks++;
        await waiting;
        return { isAvailable: false, isRollBackToEmbedded: false };
      },
    },
  });
  let tree, pending;
  await act(async () => {
    tree = f.render();
  });
  await act(async () => {
    const press = button(tree).props.onPress;
    pending = press();
    await press();
  });
  assert.equal(checks, 1);
  assert.equal(button(tree).props.disabled, true);
  await act(async () => {
    release();
    await pending;
  });
  await act(async () => tree.unmount());
  for (const options of [
    { development: true },
    { platform: "web" },
    { updates: { isEnabled: false } },
  ]) {
    const disabled = fixture(options);
    await act(async () => {
      tree = disabled.render();
    });
    assert.equal(button(tree).props.disabled, true);
    await act(async () => {
      await button(tree).props.onPress();
    });
    assert.deepEqual(disabled.calls, []);
    await act(async () => tree.unmount());
  }
});

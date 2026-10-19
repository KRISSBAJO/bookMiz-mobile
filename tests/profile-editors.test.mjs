import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url), ts = require("typescript"), React = require("react");
const { act, create } = require("react-test-renderer");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function load(path, deps) {
  const result = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "exports", code)((key) => { if (!(key in deps)) throw Error(key); return deps[key]; }, result);
  return result;
}
const common = {
  react: React, "react/jsx-runtime": require("react/jsx-runtime"),
  "react-native": { View: "View", Text: "Text", TextInput: "Input", Pressable: "Pressable", ActivityIndicator: "Spinner", Modal: ({ visible, children }) => visible ? React.createElement("Modal", null, children) : null, KeyboardAvoidingView: "Keyboard", Image: "Image", Platform: { OS: "android" }, StyleSheet: { create: (x) => x, hairlineWidth: 1 }, FlatList: ({ data, renderItem, ListEmptyComponent }) => React.createElement("List", null, data.length ? data.map((item) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent) },
  "@expo/vector-icons": { FontAwesome6: "Icon" },
  "react-native-safe-area-context": { SafeAreaView: "SafeArea" },
  "@/src/theme/tokens": { tokens: { colors: {}, font: {} } },
  "@/src/lib/mobile-env": { mobileEnv: { identityApiUrl: "https://identity.example.invalid/api" } },
  "@/src/lib/api/error-display": { getFriendlyApiError: (e) => e.message },
  "@/src/components/ProfileAvatar": { ProfileAvatar: "Avatar" },
};
const countries = [
  { id: "us", code: "US", name: "United States", states: [{ id: "il", code: "IL", name: "Illinois", cities: [{ id: "chi", name: "Chicago", latitude: 41, longitude: -87 }] }] },
  { id: "ng", code: "NG", name: "Nigeria", states: [{ id: "la", code: "LA", name: "Lagos", cities: [{ id: "ikeja", name: "Ikeja", latitude: 0, longitude: 0 }] }] },
];
const press = async (tree, label) => act(async () => { tree.root.findByProps({ accessibilityLabel: label }).props.onPress(); });
test('location choices reset dependent fields, prevent cross-country cities, and retain canonical coordinates', async () => {
  const geo = load("../src/lib/api/geography.ts", { "@/src/lib/api/client": {}, "@/src/lib/mobile-env": common["@/src/lib/mobile-env"] });
  const changes = [];
  const { ProfileLocationPicker } = load("../src/components/ProfileLocationPicker.tsx", { ...common, "@/src/lib/api/geography": { ...geo, listSupportedGeography: async () => countries } });
  function Harness() {
    const [value, setValue] = React.useState({ countryCode: "US", stateCode: "IL", city: "Chicago", homeLatitude: 41, homeLongitude: -87 });
    return React.createElement(ProfileLocationPicker, { value, onChange: (next, valid) => { changes.push({ next, valid }); setValue(next); } });
  }
  let tree; await act(async () => { tree = create(React.createElement(Harness)); });
  await press(tree, "Country: United States"); await press(tree, "Select Nigeria");
  assert.deepEqual(changes.at(-1), { next: { countryCode: "NG", stateCode: "", city: "", homeLatitude: null, homeLongitude: null }, valid: false });
  assert.equal(tree.root.findByProps({ accessibilityLabel: "City: Choose" }).props.disabled, true);
  await press(tree, "State or region: Choose");
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: "Select Illinois" }).length, 0);
  await press(tree, "Select Lagos"); await press(tree, "City: Choose");
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Search city" }).props.onChangeText("missing"));
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: "Select Ikeja" }).length, 0);
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Search city" }).props.onChangeText("ike"));
  await press(tree, "Select Ikeja");
  assert.equal(changes.at(-1).valid, true); assert.equal(changes.at(-1).next.homeLatitude, 0);
  await act(async () => tree.unmount());
});

test('photo cancellation and oversized selection do not upload; successful replacement refreshes and cleans the cached image', async () => {
  let selection = { canceled: true }, calls = [], deletes = 0;
  class File { constructor(uri) { this.uri = uri; this.exists = true; this.size = 100; } async base64() { return 'cGhvdG8='; } delete() { deletes++; } }
  const { ProfilePhotoEditor } = load("../src/components/ProfilePhotoEditor.tsx", { ...common,
    "expo-document-picker": { getDocumentAsync: async () => selection }, "expo-file-system": { File, Paths: { cache: { uri: 'file:///cache/' } } },
    "@/src/lib/api/auth": { uploadProfilePhoto: async (value) => { calls.push(value); }, removeProfilePhoto: async () => calls.push('remove') },
  });
  let tree; await act(async () => { tree = create(React.createElement(ProfilePhotoEditor, { userId: 'fixture', fullName: 'Test User', email: 'test@example.invalid', initials: 'TU', onSaved: async () => calls.push('refresh') })); });
  await press(tree, 'Add profile photo'); assert.equal(calls.length, 0);
  selection = { assets: [{ uri: 'file:///cache/image.png', size: 4 * 1024 * 1024 }] };
  await press(tree, 'Add profile photo'); assert.equal(calls.length, 0); assert.equal(deletes, 1);
  selection = { assets: [{ uri: 'file:///cache/image.png', size: 100 }] };
  await press(tree, 'Add profile photo'); assert.deepEqual(calls, ['cGhvdG8=', 'refresh']); assert.equal(deletes, 2);
  await act(async () => tree.unmount());
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript'), React = require('react'), { act, create } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fixture(api = {}, overrides = {}) {
  const workspace = { id: 'p', organizationId: 'org', displayName: 'Test Studio', timezone: 'America/Chicago', currencyCode: 'USD', deliveryModes: ['IN_PERSON'] };
  const business = { organizationId: 'org', workspace, canManage: true, ...overrides };
  const native = { View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', Modal: 'Modal', Image: 'Image', Switch: 'Switch', ActivityIndicator: 'Loading', KeyboardAvoidingView: 'KeyboardAvoidingView', ScrollView: 'ScrollView', StyleSheet: { create: x => x, hairlineWidth: 1 }, Platform: { OS: 'android' }, Linking: { openURL: async () => {} }, useWindowDimensions: () => ({ width: 320, height: 640 }) };
  const mocks = { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, 'expo-router': { useFocusEffect: callback => React.useEffect(callback, [callback]), useRouter: () => ({ push() {}, replace() {} }), useLocalSearchParams: () => ({}) }, '@expo/vector-icons': { FontAwesome6: 'Icon' }, '@react-native-community/datetimepicker': { default: 'DatePicker' }, 'expo-document-picker': { getDocumentAsync: async () => ({ canceled: true }) }, 'expo-file-system': { File: class {}, Paths: { cache: { uri: 'cache/' } } } };
  const cache = new Map();
  function load(relative) {
    let filename = path.resolve(root, relative);
    if (!path.extname(filename)) filename += filename.includes('context') || filename.includes('components') || filename.includes('screens') ? '.tsx' : '.ts';
    const canonical = filename.replaceAll('\\', '/');
    if (canonical.endsWith('business-context.tsx')) return { useBusiness: () => business, BusinessSelector: 'BusinessSelector' };
    if (canonical.endsWith('session-context.tsx')) return { useSession: () => ({ user: { id: 'user' } }) };
    if (canonical.endsWith('api/business.ts')) return api;
    if (canonical.endsWith('components/Screen.tsx')) return { Screen: props => React.createElement('Screen', props, props.children) };
    if (canonical.endsWith('api/error-display.ts')) return { getFriendlyApiError: (e, fallback) => e?.message || fallback };
    if (cache.has(filename)) return cache.get(filename);
    const result = {}; cache.set(filename, result);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    new Function('require', 'exports', code)(name => {
      if (mocks[name]) return mocks[name];
      if (name.endsWith('.ttf')) return 'font';
      return load(name.startsWith('@/') ? name.slice(2) : path.resolve(path.dirname(filename), name));
    }, result);
    return result;
  }
  return { load, business };
}
const policy = fixture().load('src/lib/business-policy.ts');
test('business permissions are scoped to role and customer accounts never gain business access', () => {
  const memberships = [{ id: 'one', role: 'ORG_ADMIN' }, { id: 'two', role: 'STAFF' }, { id: 'three', role: 'PLATFORM_AGENT' }];
  assert.deepEqual(policy.availableBusinesses('INTERNAL', memberships).map(m => m.id), ['one', 'two']);
  assert.deepEqual(policy.availableBusinesses('CUSTOMER', memberships), []);
  assert.equal(policy.canManageBusiness('STAFF'), false); assert.equal(policy.canManageBusiness('STAFF_MANAGER'), true);
});
test('money input preserves exact minor units and rejects rounding, exponent notation and negatives', () => {
  assert.equal(policy.moneyInput('12.99'), 1299); assert.equal(policy.moneyInput('100'), 10000);
  for (const value of ['1.999', '-2', '1e3', 'NaN', '']) assert.throws(() => policy.moneyInput(value));
  assert.match(policy.formatBusinessMoney(7800, 'NGN'), /NGN/);
});
test('business dates and time off respect timezone and daylight saving gaps', () => {
  assert.equal(policy.businessDate('2026-10-20T02:00:00Z', 'America/Chicago'), '2026-10-19');
  assert.equal(policy.businessDateTimeToIso('2026-10-20', '09:00', 'America/Chicago'), '2026-10-20T14:00:00.000Z');
  assert.throws(() => policy.businessDateTimeToIso('2026-03-08', '02:30', 'America/Chicago'), /clocks change/);
  assert.throws(() => policy.businessDateTimeToIso('2026-02-30', '09:00', 'UTC'));
  assert.throws(() => policy.validateHours('25:00', '26:00')); assert.throws(() => policy.validateHours('17:00', '09:00'));
});
test('appointment actions follow backend lifecycle and terminal appointments have no mutation actions', () => {
  assert.deepEqual(policy.bookingActions('PENDING'), ['CONFIRMED', 'CANCELLED']);
  assert.deepEqual(policy.bookingActions('CHECKED_IN'), ['COMPLETED']);
  for (const status of ['CANCELLED', 'COMPLETED', 'NO_SHOW']) assert.deepEqual(policy.bookingActions(status), []);
});
function findButton(tree, label) {
  const node = tree.root.findAllByType('Pressable').find(item => item.findAllByType('Text').some(t => t.children.join('') === label));
  assert.ok(node, `Missing button ${label}`); return node;
}
async function field(tree, label, value) { await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onChangeText(value)); }
const service = { id: 's', name: 'Facial', description: '', priceCents: 7800, currencyCode: 'USD', durationMinutes: 60, isActive: true, requiresApproval: false, imageUrl: 'https://example.com/photo.jpg', defaultChannel: 'IN_PERSON', availableChannels: ['IN_PERSON'], bufferBeforeMinutes: 0, bufferAfterMinutes: 0, bookingInstructions: '' };
test('service editor submits exact selected currency and minor units once while saving', async () => {
  const writes = []; let resolve, closed = 0;
  const pending = new Promise(r => { resolve = r; });
  const f = fixture({ businessRequest: (...args) => { writes.push(args); return pending; } });
  const { ServiceEditor } = f.load('src/components/business/ServiceEditor.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(ServiceEditor, { service, categoryId: 'cat', categories: [{ id: 'cat', name: 'Beauty', services: [service] }], onSaved: async () => {}, onClose: () => closed++ })); });
  await field(tree, 'Price', '12.99'); await act(async () => findButton(tree, 'NGN').props.onPress());
  const save = findButton(tree, 'Save changes').props.onPress;
  await act(async () => { save(); save(); });
  assert.equal(writes.length, 1); assert.equal(writes[0][3].priceCents, 1299); assert.equal(writes[0][3].currencyCode, 'NGN'); assert.equal(writes[0][1], 'org');
  await act(async () => resolve({})); assert.equal(closed, 1); await act(async () => tree.unmount());
});
test('invalid prices remain editable and never reach the backend', async () => {
  let writes = 0; const f = fixture({ businessRequest: async () => { writes++; } });
  const { ServiceEditor } = f.load('src/components/business/ServiceEditor.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(ServiceEditor, { service, categoryId: 'cat', categories: [], onSaved: async () => {}, onClose() {} })); });
  await field(tree, 'Price', '1.999'); await act(async () => findButton(tree, 'Save changes').props.onPress());
  assert.equal(writes, 0); assert.ok(tree.root.findAllByType('Text').some(t => t.children.join('').includes('two decimal'))); await act(async () => tree.unmount());
});
test('staff cannot save a service even if they reach the editor directly', async () => {
  let writes = 0; const f = fixture({ businessRequest: async () => { writes++; } }, { canManage: false });
  const { ServiceEditor } = f.load('src/components/business/ServiceEditor.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(ServiceEditor, { service, categoryId: 'cat', categories: [], onSaved: async () => {}, onClose() {} })); });
  await act(async () => findButton(tree, 'Save changes').props.onPress()); assert.equal(writes, 0); await act(async () => tree.unmount());
});
test('booking editor uses backend slots and submits the reviewed service price, currency and selected staff', async () => {
  const writes = [], svc = { ...service, currencyCode: 'NGN', priceCents: 1299 };
  const f = fixture({
    getMerchantServices: async () => ({ categories: [{ id: 'cat', services: [svc] }] }),
    getMerchantSettings: async () => ({ staffMembers: [], locations: [] }),
    getMerchantSlots: async () => ({ slots: [{ startAt: '2026-11-01T17:00:00Z', endAt: '2026-11-01T17:30:00Z', staffOptions: [{ staffMemberId: 'staff', displayName: 'Available Staff' }] }] }),
    businessRequest: async (url, org, method, payload) => {
      if (url === 'customers') return { customers: [] };
      writes.push({ url, org, method, payload }); return { id: 'booking' };
    },
  });
  const { BookingEditor } = f.load('src/components/business/BookingEditor.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(BookingEditor, { onSaved: async () => {}, onClose() {} })); });
  const choice = tree.root.findAllByType('Pressable').find(p => p.findAllByType('Text').some(t => t.children.join('').includes('Facial')));
  await act(async () => choice.props.onPress());
  await field(tree, 'First name', 'Fixture');
  await act(async () => findButton(tree, 'Find available times').props.onPress());
  const slot = tree.root.findAllByType('Pressable').find(p => p.findAllByType('Text').some(t => /11:00/.test(t.children.join(''))));
  assert.ok(slot); await act(async () => slot.props.onPress());
  await act(async () => findButton(tree, 'Review appointment').props.onPress());
  await act(async () => findButton(tree, 'Save appointment').props.onPress());
  assert.equal(writes.length, 1); assert.equal(writes[0].org, 'org');
  assert.equal(writes[0].payload.expectedPriceCents, 1299); assert.equal(writes[0].payload.expectedCurrencyCode, 'NGN');
  assert.equal(writes[0].payload.assignedStaffId, 'staff'); assert.equal(writes[0].payload.startsAt, '2026-11-01T17:00:00Z');
  await act(async () => tree.unmount());
});

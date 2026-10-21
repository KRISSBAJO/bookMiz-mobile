import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript'), React = require('react'), { act, create } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fixture(api = {}, overrides = {}, options = {}) {
  const routes = [], params = { ...options.params };
  const router = { push: route => routes.push(route), replace: route => routes.push(route), setParams: next => Object.assign(params, next) };
  const workspace = { id: 'p', organizationId: 'org', displayName: 'Test Studio', timezone: 'America/Chicago', currencyCode: 'USD', deliveryModes: ['IN_PERSON'] };
  const business = { organizationId: 'org', workspace, canManage: true, businesses: [{ id: 'org', role: 'ORG_ADMIN', displayName: 'Test Studio' }], ...overrides };
  const native = { View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', Modal: 'Modal', Image: 'Image', Switch: 'Switch', ActivityIndicator: 'Loading', KeyboardAvoidingView: 'KeyboardAvoidingView', ScrollView: 'ScrollView', StyleSheet: { create: x => x, hairlineWidth: 1 }, Platform: { OS: 'android' }, Linking: { openURL: async () => {} }, useWindowDimensions: () => ({ width: options.width ?? 320, height: 640, fontScale: options.fontScale ?? 1 }) };
  const mocks = { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, 'expo-router': { useFocusEffect: callback => React.useEffect(callback, [callback]), useRouter: () => router, useLocalSearchParams: () => params }, '@expo/vector-icons': { FontAwesome6: 'Icon' }, '@react-native-community/datetimepicker': { default: 'DatePicker' }, 'expo-document-picker': { getDocumentAsync: async () => ({ canceled: true }) }, 'expo-file-system': { File: class {}, Paths: { cache: { uri: 'cache/' } } } };
  const cache = new Map();
  function load(relative) {
    let filename = path.resolve(root, relative);
    if (!path.extname(filename)) filename += filename.includes('context') || filename.includes('components') || filename.includes('screens') ? '.tsx' : '.ts';
    const canonical = filename.replaceAll('\\', '/');
    if (canonical.endsWith('business-context.tsx')) return { useBusiness: () => business, BusinessSelector: 'BusinessSelector' };
    if (canonical.endsWith('session-context.tsx')) return { useSession: () => ({ user: { id: 'user' } }) };
    if (canonical.endsWith('api/business.ts') || canonical.endsWith('api/business-money.ts')) return api;
    if (canonical.endsWith('/drafts.ts')) return { readDraft: api.readDraft ?? (async () => null), writeDraft: api.writeDraft ?? (async () => {}) };
    if (canonical.endsWith('components/Screen.tsx')) return { Screen: ({ children, action, ...props }) => React.createElement('Screen', props, action, children) };
    if (canonical.endsWith('api/error-display.ts')) return { getFriendlyApiError: (e, fallback) => e?.message || fallback };
    if (cache.has(filename)) return cache.get(filename);
    const result = {}; cache.set(filename, result);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    new Function('require', 'exports', code)(name => {
      if (mocks[name]) return mocks[name];
      if (name.endsWith('.ttf')) return 'font';
      if (name.endsWith('.png')) return 'illustration';
      return load(name.startsWith('@/') ? name.slice(2) : path.resolve(path.dirname(filename), name));
    }, result);
    return result;
  }
  return { load, business, routes, params };
}
const policy = fixture().load('src/lib/business-policy.ts');
test('day summary orders bookings and excludes expired/terminal visits from the next appointment', () => {
  const { merchantDay } = fixture().load('src/lib/merchant-home.ts');
  const visit = (id, start, status = 'CONFIRMED', assignedStaffId = null) => ({ id, startsAt: `2026-10-21T${start}:00Z`, endsAt: `2026-10-21T${start}:30Z`, status, assignedStaffId, totalPriceCents: 0, currencyCode: 'USD' });
  const records = [visit('future', '16:00', 'PENDING'), visit('cancelled', '13:00', 'CANCELLED'), visit('late', '12:00'), visit('done', '11:00', 'COMPLETED'), visit('current', '14:00', 'CHECKED_IN', 'staff')];
  const result = merchantDay(records, new Date('2026-10-21T14:00:15Z'));
  assert.equal(result.next.id, 'current'); assert.equal(result.completed, 1); assert.equal(result.remaining.length, 3);
  assert.deepEqual(result.overdue.map(x => x.id), ['late']); assert.deepEqual(result.pending.map(x => x.id), ['future']);
  assert.deepEqual(result.unassigned.map(x => x.id), ['late', 'future']);
  assert.equal(records[0].id, 'future'); assert.equal(result.next.totalPriceCents, 0);
});

test('home uses business-day data and original zero/mixed-currency totals and routes useful shortcuts', async t => {
  const day = policy.businessDate(new Date(), 'America/Chicago');
  const start = policy.businessDateTimeToIso(day, '11:00', 'America/Chicago');
  const records = [{ id: 'zero', customerName: 'Alex', serviceName: 'Original booking', startsAt: start, endsAt: start, status: 'CONFIRMED', paymentStatus: 'UNPAID', totalPriceCents: 0, currencyCode: 'USD', assignedStaffId: null }, { id: 'ngn', customerName: 'Taylor', serviceName: 'Second service', startsAt: start, endsAt: start, status: 'COMPLETED', paymentStatus: 'PAID', totalPriceCents: 1299, currencyCode: 'NGN', assignedStaffId: 'staff' }];
  const f = fixture({ getMerchantBookings: async () => ({ bookings: records }), getMerchantBootstrap: async () => ({ stats: { openRequests: 2, activeServices: 5, activeStaff: 2 } }) });
  const { MerchantTodayScreen } = f.load('src/screens/business/MerchantTodayScreen.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(MerchantTodayScreen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const output = JSON.stringify(tree.toJSON()); assert.match(output, /Booking total/); assert.match(output, /USD/); assert.match(output, /0\.00/); assert.match(output, /NGN/); assert.match(output, /12\.99/); assert.match(output, /Need a team member/);
  await act(async () => findButton(tree, 'Availability').props.onPress());
  await act(async () => findButton(tree, 'Add service').props.onPress());
  await act(async () => findButton(tree, 'Money').props.onPress());
  assert.deepEqual(f.routes, ['/business/manage?section=availability', '/business/manage?section=services&action=add-service', '/business/money']);
  assert.equal(tree.root.findAllByType('Image').length, 0); // small-screen text gets the space
});

test('staff homepage exposes read access and loading errors never masquerade as an empty successful day', async t => {
  const f = fixture({ getMerchantBookings: async () => { throw new Error('Offline'); }, getMerchantBootstrap: async () => ({ stats: {} }) }, { canManage: false, businesses: [{ id: 'org', role: 'STAFF' }] }, { width: 840 });
  const { MerchantTodayScreen } = f.load('src/screens/business/MerchantTodayScreen.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(MerchantTodayScreen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const output = JSON.stringify(tree.toJSON()); assert.match(output, /Offline/); assert.doesNotMatch(output, /all caught up|New booking|Add service|Payments & payouts/);
  assert.equal(tree.root.findAllByType('Image').length, 1);
  await act(async () => findButton(tree, 'Messages').props.onPress()); assert.deepEqual(f.routes, ['/business/inbox']);
});

test('add-service shortcut opens the service editor once and cannot grant staff write access', async () => {
  for (const canManage of [true, false]) {
    const f = fixture({ getMerchantServices: async () => ({ categories: [] }), getMerchantSettings: async () => ({ workingHours: [], staffMembers: [], locations: [], timeOffs: [] }) }, { canManage }, { params: { section: 'services', action: 'add-service' } });
    const { MerchantManageScreen } = f.load('src/screens/business/MerchantManageScreen.tsx'); let tree;
    await act(async () => { tree = create(React.createElement(MerchantManageScreen)); });
    try { assert.equal(tree.root.findAllByType('Modal').length, canManage ? 1 : 0); if (canManage) assert.equal(f.params.action, undefined); }
    finally { await act(async () => tree.unmount()); }
  }
});
test('bank editor verifies account ownership, invalidates verification on edits and saves only explicit NGN details', async () => {
  const writes = []; let draftWrites = 0;
  const f = fixture({ businessRequest: async (url, org, method, payload) => {
    assert.equal(org, 'org');
    if (url === 'money/banks') return { banks: [{ code: '058', name: 'Fixture bank', active: true, currencyCode: 'NGN' }] };
    if (url === 'money/banks/resolve') return { accountName: 'FICTIONAL HOLDER', bankName: 'Fixture bank' };
    writes.push({ url, payload });
  }, writeDraft: async () => { draftWrites++; } });
  const { MerchantBankEditor } = f.load('src/components/business/MerchantBankEditor.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(MerchantBankEditor, { onSaved: async () => {}, onClose() {} })); });
  await act(async () => findButton(tree, 'Fixture bank').props.onPress());
  await field(tree, 'Account number', '0001234567');
  await act(async () => findButton(tree, 'Verify account holder').props.onPress());
  assert.equal(findButton(tree, 'Save bank destination').props.disabled, false);
  await field(tree, 'Account number', '0001234568');
  assert.equal(findButton(tree, 'Save bank destination').props.disabled, true);
  await act(async () => findButton(tree, 'Save bank destination').props.onPress());
  assert.equal(writes.length, 0);
  await act(async () => findButton(tree, 'Verify account holder').props.onPress());
  await act(async () => findButton(tree, 'Save bank destination').props.onPress());
  assert.equal(writes.length, 1); assert.equal(writes[0].payload.currencyCode, 'NGN'); assert.equal(writes[0].payload.accountNumber, '0001234568'); assert.equal(writes[0].payload.accountHolderName, 'FICTIONAL HOLDER');
  assert.equal(draftWrites, 0);
  await act(async () => tree.unmount());
});
const moneyOverview = {
  business: { id: 'p', displayName: 'Test Studio', currencyCode: 'USD' },
  paymentSettings: { acceptBookingPagePayments: false, requirePaymentUpfront: false },
  bookingTotals: [{ currencyCode: 'USD', paymentStatus: 'PAID', bookingCount: 1, bookedAmountCents: 1299 }, { currencyCode: 'NGN', paymentStatus: 'UNPAID', bookingCount: 1, bookedAmountCents: 1299 }],
  paystack: { summary: { availableBalanceCents: 100000, pendingBalanceCents: 1000, requestedBalanceCents: 0, minimumProviderPayoutCents: 100 }, rails: { paystack: { configured: true, payoutsEnabled: true, mode: 'test' } }, accounts: [{ id: 'bank', processor: 'PAYSTACK', currencyCode: 'NGN', status: 'ACTIVE', bankName: 'Fixture bank', accountNumberLast4: '1234', isDefault: true }], defaultPayoutAccountId: 'bank', requests: [] },
  stripe: { available: true, account: { connected: false, mode: 'test' }, payouts: [] }, generatedAt: '2026-10-20T12:00:00Z',
};
test('money screen rejects direct staff-manager access without requesting financial records', async () => {
  let reads = 0; const f = fixture({ getMoney: async () => { reads++; return moneyOverview; } }, { businesses: [{ id: 'org', role: 'STAFF_MANAGER' }] });
  const { MerchantMoneyScreen } = f.load('src/screens/business/MerchantMoneyScreen.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(MerchantMoneyScreen)); });
  assert.equal(reads, 0); assert.match(JSON.stringify(tree.toJSON()), /Owner access required/); await act(async () => tree.unmount());
});
test('payment preferences explicitly save charge-at-booking without altering transaction records', async () => {
  const writes = []; const f = fixture({ getMoney: async () => moneyOverview, businessRequest: async (...args) => { writes.push(args); } });
  const { MerchantMoneyScreen } = f.load('src/screens/business/MerchantMoneyScreen.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(MerchantMoneyScreen)); });
  const text = JSON.stringify(tree.toJSON()); assert.match(text, /USD/); assert.match(text, /NGN/); assert.match(text, /TEST MODE/);
  await act(async () => findButton(tree, 'Payment preferences').props.onPress());
  await act(async () => findButton(tree, 'Enabled').props.onPress());
  await act(async () => findButton(tree, 'Save preferences').props.onPress());
  assert.deepEqual(writes, [['money/preferences', 'org', 'POST', { enabled: true }]]);
  await act(async () => tree.unmount());
});
test('payout persists before sending, blocks duplicate taps and restores the same reference after a lost response', async () => {
  const drafts = new Map(), commands = []; let rejectNetwork;
  const f = fixture({ getMoney: async () => moneyOverview, readDraft: async key => drafts.get(key) ?? null, writeDraft: async (key, value) => { drafts.set(key, value); }, requestMerchantPayout: async (org, rail, payload) => {
    assert.equal(org, 'org'); assert.equal(rail, 'paystack'); assert.equal([...drafts.values()].filter(Boolean).length, 1);
    commands.push(payload); if (commands.length === 1) return new Promise((_, reject) => { rejectNetwork = reject; }); return { id: payload.requestId };
  } });
  const { MerchantMoneyScreen } = f.load('src/screens/business/MerchantMoneyScreen.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(MerchantMoneyScreen)); });
  await act(async () => findButton(tree, 'Request payout').props.onPress());
  await field(tree, 'Amount (NGN)', '12.99');
  await act(async () => findButton(tree, 'Review payout').props.onPress());
  const press = findButton(tree, 'Confirm payout').props.onPress;
  await act(async () => { press(); press(); }); assert.equal(commands.length, 1);
  await act(async () => rejectNetwork(new Error('Network timed out')));
  await act(async () => tree.unmount());
  await act(async () => { tree = create(React.createElement(MerchantMoneyScreen)); });
  await act(async () => findButton(tree, 'Request payout').props.onPress());
  await act(async () => findButton(tree, 'Check same request').props.onPress());
  assert.equal(commands.length, 2); assert.deepEqual(commands[0], commands[1]); assert.equal(commands[0].amountCents, 1299); assert.equal(commands[0].currencyCode, 'NGN');
  assert.equal([...drafts.values()].filter(Boolean).length, 0);
  await act(async () => tree.unmount());
});

test('money management excludes daily-operations managers and validates payout amounts exactly', () => {
  assert.equal(policy.canManageBusinessMoney('ORG_ADMIN'), true);
  assert.equal(policy.canManageBusinessMoney('SERVICE_PROVIDER'), true);
  for (const role of ['STAFF', 'STAFF_MANAGER', 'CUSTOMER']) assert.equal(policy.canManageBusinessMoney(role), false);
  assert.equal(policy.payoutAmount('12.99', 1300, 100), 1299);
  for (const amount of ['13.01', '0', '1.999', '-1', '1e3']) assert.throws(() => policy.payoutAmount(amount, 1300, 100));
  assert.match(policy.payoutReference(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
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
  assert.match(policy.formatBusinessMoney(7800, 'JPY'), /requires review/);
  assert.match(policy.formatBusinessMoney(7800, ''), /requires review/);
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

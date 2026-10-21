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
  const native = { View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', Modal: 'Modal', Image: 'Image', Switch: 'Switch', ActivityIndicator: 'Loading', KeyboardAvoidingView: 'KeyboardAvoidingView', ScrollView: 'ScrollView', RefreshControl: 'RefreshControl', StyleSheet: { create: x => x, hairlineWidth: 1 }, Platform: { OS: 'android' }, Linking: { openURL: async () => {} }, useWindowDimensions: () => ({ width: options.width ?? 320, height: 640, fontScale: options.fontScale ?? 1 }) };
  const mocks = { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, 'expo-router': { useFocusEffect: callback => React.useEffect(callback, [callback]), useRouter: () => router, useLocalSearchParams: () => params }, '@expo/vector-icons': { FontAwesome6: 'Icon' }, '@react-native-community/datetimepicker': { default: 'DatePicker' }, 'expo-document-picker': { getDocumentAsync: async () => ({ canceled: true }) }, 'expo-file-system': { File: class {}, Paths: { cache: { uri: 'cache/' } } } };
  native.ScrollView = ({ refreshControl, children, ...props }) => React.createElement('ScrollView', props, refreshControl, children);
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

test('calendar places original booking amounts in accessible blocks and opens scoped details', async t => {
  const day = policy.businessDate(new Date(), 'America/Chicago');
  const start = policy.businessDateTimeToIso(day, '11:00', 'America/Chicago');
  const end = policy.businessDateTimeToIso(day, '12:00', 'America/Chicago');
  const records = [{ id: 'zero', customerName: 'Alex', serviceName: 'Original booking', startsAt: start, endsAt: end, status: 'CONFIRMED', paymentStatus: 'UNPAID', totalPriceCents: 0, currencyCode: 'USD', assignedStaffId: null, channel: 'IN_PERSON' }, { id: 'ngn', customerName: 'Taylor', serviceName: 'Second service', startsAt: start, endsAt: end, status: 'COMPLETED', paymentStatus: 'PAID', totalPriceCents: 1299, currencyCode: 'NGN', assignedStaffId: 'staff', channel: 'IN_PERSON' }];
  const f = fixture({ getMerchantBookings: async () => ({ bookings: records }), getMerchantSettings: async () => ({ staffMembers: [] }), getMerchantBootstrap: async () => ({ stats: { openRequests: 2 } }) });
  const { MerchantTodayScreen } = f.load('src/screens/business/MerchantTodayScreen.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(MerchantTodayScreen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const output = JSON.stringify(tree.toJSON()); assert.match(output, /booking total USD\s0.00/); assert.match(output, /booking total NGN\s12.99/);
  await act(async () => findButton(tree, 'Hours & time off').props.onPress());
  await act(async () => findButton(tree, 'Add service').props.onPress());
  assert.deepEqual(f.routes, ['/business/manage?section=availability', '/business/manage?section=services&action=add-service']);
  const event = tree.root.findAllByType('Pressable').find(x => x.props.accessibilityLabel?.includes('Alex, Original booking'));
  await act(async () => event.props.onPress()); assert.equal(tree.root.findAllByType('Modal').length, 1);
  await act(async () => findButton(tree, 'Close').props.onPress()); assert.equal(tree.root.findAllByType('Modal').length, 0);
});

test('staff schedule keeps appointments available when auxiliary team loading fails and offers no creation', async t => {
  const f = fixture({ getMerchantBookings: async () => ({ bookings: [] }), getMerchantSettings: async () => { throw new Error('Offline'); }, getMerchantBootstrap: async () => ({ stats: {} }) }, { canManage: false, businesses: [{ id: 'org', role: 'STAFF' }] });
  const { MerchantTodayScreen } = f.load('src/screens/business/MerchantTodayScreen.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(MerchantTodayScreen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const output = JSON.stringify(tree.toJSON()); assert.match(output, /Team and setup information could not load/); assert.doesNotMatch(output, /New appointment|Add service/);
});

test('schedule layout separates overlapping blocks, clips overnight visits and respects DST business dates', () => {
  const { scheduleLayout } = fixture().load('src/lib/merchant-schedule.ts');
  const record = (id, startsAt, endsAt) => ({ id, startsAt, endsAt });
  const records = [record('a', '2026-10-21T14:00:00Z', '2026-10-21T15:00:00Z'), record('b', '2026-10-21T14:30:00Z', '2026-10-21T15:30:00Z'), record('c', '2026-10-21T15:30:00Z', '2026-10-21T16:00:00Z'), record('overnight', '2026-10-21T04:00:00Z', '2026-10-21T06:00:00Z'), record('midnight-end', '2026-10-21T04:00:00Z', '2026-10-21T05:00:00Z')];
  const result = scheduleLayout(records, '2026-10-21', 'America/Chicago');
  assert.equal(result.items.find(x => x.booking.id === 'a').columns, 2);
  assert.notEqual(result.items.find(x => x.booking.id === 'a').column, result.items.find(x => x.booking.id === 'b').column);
  assert.equal(result.items.find(x => x.booking.id === 'c').columns, 1);
  assert.equal(result.items.find(x => x.booking.id === 'overnight').start, 0);
  assert.equal(result.items.find(x => x.booking.id === 'overnight').end, 60);
  assert.equal(result.items.some(x => x.booking.id === 'midnight-end'), false);
  const dst = scheduleLayout([record('repeat', '2026-11-01T06:45:00Z', '2026-11-01T07:15:00Z')], '2026-11-01', 'America/Chicago');
  assert.equal(dst.items[0].start, 105); assert.ok(dst.items[0].end > dst.items[0].start);
  assert.equal(records[0].startsAt, '2026-10-21T14:00:00Z');
});

test('calendar creation carries the selected date and staff into the reviewed booking editor', async t => {
  let writes = 0;
  const f = fixture({ getMerchantBookings: async () => ({ bookings: [] }), getMerchantSettings: async () => ({ staffMembers: [{ id: 'staff', displayName: 'Jamie', status: 'ACTIVE', isBookable: true }], locations: [] }), getMerchantBootstrap: async () => ({ stats: {} }), getMerchantServices: async () => ({ categories: [] }), businessRequest: async (_, __, method) => { if (method) writes++; return { customers: [] }; } });
  const { MerchantCalendarScreen } = f.load('src/screens/business/MerchantCalendarScreen.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(MerchantCalendarScreen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const byLabel = label => tree.root.findAllByType('Pressable').find(p => p.props.accessibilityLabel === label);
  await act(async () => byLabel('Next week').props.onPress());
  await act(async () => byLabel('Jamie').props.onPress());
  await act(async () => byLabel('New appointment').props.onPress());
  const { DateField, Choices } = f.load('src/components/business/BusinessUI.tsx');
  assert.equal(tree.root.findAllByType(DateField).find(x => x.props.label === 'Appointment date').props.value, policy.shiftBusinessDate(policy.businessDate(new Date(), 'America/Chicago'), 7));
  assert.equal(tree.root.findAllByType(Choices).find(x => x.props.label === 'Team member').props.value, 'staff');
  assert.equal(writes, 0);
});

test('service menu opens compact details without granting staff edit or money access', async t => {
  const f = fixture({ getMerchantServices: async () => ({ categories: [{ id: 'cat', name: 'Hair', services: [{ id: 's', name: 'Cut', durationMinutes: 30, priceCents: 1299, currencyCode: 'NGN', isActive: true }] }] }), getMerchantSettings: async () => ({ workingHours: [], staffMembers: [], locations: [], timeOffs: [] }) }, { canManage: false, businesses: [{ id: 'org', role: 'STAFF' }] });
  const { MerchantManageScreen } = f.load('src/screens/business/MerchantManageScreen.tsx'); let tree;
  await act(async () => { tree = create(React.createElement(MerchantManageScreen)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const row = tree.root.findAllByType('Pressable').find(p => p.props.accessibilityLabel?.startsWith('Cut,'));
  await act(async () => row.props.onPress());
  assert.equal(tree.root.findAllByType('Modal').length, 1);
  const output = JSON.stringify(tree.toJSON()); assert.match(output, /NGN/); assert.match(output, /12.99/); assert.doesNotMatch(output, /Edit service|Archive service|Open money workspace/);
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

test('appointment deep link opens an already mounted row and is consumed on dismissal', async () => {
  const f = fixture(); const { BookingCard } = f.load('src/components/business/BookingCard.tsx');
  const booking = { id: 'visit', startsAt: '2026-10-21T16:00:00Z', endsAt: '2026-10-21T17:00:00Z', customerName: 'Alex', serviceName: 'Haircut', status: 'CONFIRMED', paymentStatus: 'UNPAID', totalPriceCents: 0, currencyCode: 'USD', channel: 'IN_PERSON' };
  let tree, dismissed = 0; const props = { booking, onRefresh: async () => {}, onDismiss: () => { dismissed++; } };
  await act(async () => { tree = create(React.createElement(BookingCard, props)); });
  try {
    assert.equal(tree.root.findAllByType('Modal').length, 0);
    await act(async () => tree.update(React.createElement(BookingCard, { ...props, initialOpen: true })));
    assert.equal(tree.root.findAllByType('Modal').length, 1);
    await act(async () => findButton(tree, 'Close').props.onPress());
    assert.equal(dismissed, 1); assert.equal(tree.root.findAllByType('Modal').length, 0);
  } finally { await act(async () => tree.unmount()); }
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


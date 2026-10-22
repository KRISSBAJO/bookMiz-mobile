import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { act, create } = require("react-test-renderer");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};

function screen(name, overrides = {}) {
  const native = {
    DeviceEventEmitter: { addListener: () => ({ remove() {} }) },
    Alert: { alert() {} },
    View: "View",
    Image: "Image",
    Text: "Text",
    TextInput: "TextInput",
    Pressable: "Pressable",
    Switch: "Switch",
    Modal: "Modal",
    ActivityIndicator: "ActivityIndicator",
    Keyboard: { dismiss() {} },
    FlatList: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({ scrollToEnd() {} }));
      return React.createElement("FlatList", props, props.data?.length ? props.data.map((item, index) => React.createElement(React.Fragment, { key: item.id }, props.renderItem({ item, index }))) : props.ListEmptyComponent);
    }),
    KeyboardAvoidingView: "KeyboardAvoidingView",
    Platform: { OS: overrides.__platform ?? "ios" },
    AppState: { currentState: "active" },
    ScrollView: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({ scrollToEnd() {} }));
      return React.createElement("ScrollView", props, props.children);
    }),
    StyleSheet: { create: (value) => value },
    Linking: { openURL: async () => {} },
    Share: { share: async () => ({ action: "dismissedAction" }) },
    Animated: {
      Value: class {},
      View: "AnimatedView",
      loop: () => ({ start() {}, stop() {} }),
      sequence() {},
      timing() {},
    },
  };
  Object.assign(native, overrides.__native);
  const authButton = (props) => React.createElement("Button", props);
  const deps = {
    "../lib/inbox-presentation": utility("inbox-presentation"),
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "react-native": native,
    "expo-router": {
      useRouter: () => ({ push() {}, back() {}, replace() {} }),
      useLocalSearchParams: () => ({ slug: "fixture" }),
    },
    "expo-router/react-navigation": {
      useFocusEffect: (callback) => React.useEffect(callback, [callback]),
    },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@expo/vector-icons": { FontAwesome6: "Icon" },
    "expo-status-bar": { StatusBar: "StatusBar" },
    "@/src/lib/mobile-env": { mobileEnv: { webAppUrl: "https://www.bookmiz.com" } },
    "@/src/lib/public-business-links": utility("public-business-links"),
    "@/src/components/Screen": {
      Screen: (props) => React.createElement("Screen", props, props.children),
    },
    "@/src/components/SectionHeader": { SectionHeader: "SectionHeader" },
    "@/src/components/business/BusinessUI": { Choices: "Choices" },
    "@/src/components/auth/AuthButton": { AuthButton: authButton },
    "@/src/components/auth/AuthField": { AuthField: "Field" },
    "@react-native-community/datetimepicker": { default: "DateTimePicker" },
    "@/src/screens/AgentWorkbenchScreen": {
      AgentWorkbenchScreen: "AgentScreen",
    },
    "@/src/lib/api/error-display": {
      getFriendlyApiError: (error, fallback) => error?.message || fallback,
    },
    "@/src/lib/open-booking-checkout": { openBookingCheckout: async () => {} },
    "@/src/lib/use-saved-draft": {
      useSavedDraft: () => ({ draftError: null, clearDraft: async () => {} }),
    },
    "@/src/theme/tokens": { tokens: { colors: {}, font: {}, radius: {} } },
    "@/src/lib/notification-destination": utility("notification-destination"),
    ...overrides,
  };
  if (name === "WorkbenchScreen") {
    const chat = {};
    const chatCode = ts.transpileModule(readFileSync(new URL('../src/components/QuoteChatModal.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'exports', chatCode)((key) => { if (key in deps) return deps[key]; throw Error(`Missing chat mock ${key}`); }, chat);
    deps['@/src/components/QuoteChatModal'] = chat;
  }
  const code = ts.transpileModule(
    readFileSync(
      new URL(`../src/screens/${name}.tsx`, import.meta.url),
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
  new Function("require", "exports", "setInterval", code)(
    (name) => {
      if (name in deps) return deps[name];
      throw Error(`Missing mock: ${name}`);
    },
    output,
    overrides.__setInterval ?? setInterval,
  );
  return output[name];
}
function utility(path) {
  const code = ts.transpileModule(
    readFileSync(new URL(`../src/lib/${path}.ts`, import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const result = {};
  new Function("exports", code)(result);
  return result;
}
test('merchant onboarding keeps five steps and retries workspace creation without registering twice', async()=>{
 const signup=deferred();let registrations=0,provisions=0;const requests=[];
 const city={id:'lagos',city:'Lagos',stateCode:'LA',countryCode:'NG',countryName:'Nigeria',currencyCode:'NGN',label:'Lagos, Nigeria',timezone:'Africa/Lagos'};
 const Signup=screen('MerchantSignupScreen',{
  '../components/business/BusinessUI':{Action:'Button',Field:'Field',Notice:'Notice',Editor:({children})=>React.createElement('Editor',{},children),ui:{}},
  '../store/session-context':{useSession:()=>({isHydrating:false,isSignedIn:false,businesses:[],applyAuthResponse:async()=>{}})},
  '../store/discovery-context':{useDiscovery:()=>({cities:[city]})},
  '../lib/api/marketplace':{listCategoryDiscovery:async mode=>mode==='LOCAL'?[{id:'beauty',name:'Beauty',slug:'beauty',serviceModel:'LOCAL'}]:[]},
  '../lib/api/merchant-onboarding':{registerOwnerMobile:async()=>{registrations++;return signup.promise;},onboardBusiness:async payload=>{requests.push(payload);if(++provisions===1)throw Error('Temporary setup outage');}},
  '../lib/merchant-onboarding':utility('merchant-onboarding'),
  '../lib/mobile-env':{mobileEnv:{webAppUrl:'https://www.bookmiz.com'}},
  '../theme/tokens':{tokens:{colors:{},font:{}}},
  '../../assets/bookmiz/barber.png':1,'../../assets/bookmiz/manicure.png':1,'../../assets/bookmiz/hospital.png':1,'../../assets/bookmiz/merchant-day-illustration.png':1,
 });
 let tree;await act(async()=>{tree=create(React.createElement(Signup));});
 const field=async(label,value)=>act(async()=>{tree.root.findAllByType('Field').find(n=>n.props.label===label).props.onChangeText(value);});
 await act(async()=>tree.root.findAllByType('Pressable').find(n=>n.props.accessibilityState?.selected===false).props.onPress());
 await press(tree.root,'Continue');await field('Business name','Lagos fixture');await press(tree.root,'Continue');
 await press(tree.root,'Choose your city');await press(tree.root,city.label);await field('Street address','123 Test Road');await field('Postal or ZIP code','100001');await press(tree.root,'Continue');
 for(const [label,value] of [['First name','Test'],['Last name','Owner'],['Email','owner@example.test'],['Password','secure-fixture-only']])await field(label,value);
 await press(tree.root,'Continue');assert(tree.root.findAllByType('Text').some(n=>n.children.join('')==='STEP 5 OF 5'));
 await act(async()=>tree.root.findAllByType('Pressable').find(n=>n.props.accessibilityRole==='checkbox').props.onPress());
 const submit=tree.root.findAllByType('Button').find(n=>n.props.label==='Create your business');
 await act(async()=>{submit.props.onPress();submit.props.onPress();});assert.equal(registrations,1);
 await act(async()=>{signup.resolve({organizations:[{id:'org',role:'ORG_ADMIN'}]});});
 assert.equal(provisions,1);assert(tree.root.findAllByType('Notice').some(n=>n.props.text==='Temporary setup outage'));
 await press(tree.root,'Create your business');assert.equal(registrations,1);assert.equal(provisions,2);
 assert.equal(requests[1].cityId,'lagos');assert.equal(requests[1].acceptedTerms,true);assert.equal(requests[1].currencyCode,undefined,'server derives currency');
 assert(labels(tree.root).includes('Your next chapter is ready.'));await act(async()=>tree.unmount());
});
const labels = (root) =>
  root
    .findAllByType("Text")
    .flatMap((node) =>
      node.children.filter((child) => typeof child === "string"),
    );
const press = async (root, label) => {
  const node = root
    .findAllByType("Button")
    .find((item) => item.props.label === label);
  assert.ok(node, `button ${label}`);
  await act(async () => {
    await node.props.onPress();
  });
};

test("already-read notifications open full details; unread notifications are marked read", async () => {
  let marks = 0;
  const note = {
    id: "notice",
    title: "Long complete notification title",
    body: "The complete body is available here.",
    createdAt: "2026-10-18T12:00:00Z",
    readAt: "2026-10-18T13:00:00Z",
  };
  const Inbox = screen("InboxScreen", {
    "@/src/lib/api/notifications": {
      listInboxNotifications: async () => ({ items: [note], unreadCount: 0 }),
      markAllInboxNotificationsRead: async () => {},
      markInboxNotificationRead: async () => {
        marks++;
      },
    },
  });
  let tree;
  await act(async () => {
    tree = create(React.createElement(Inbox));
  });
  const row = tree.root
    .findAllByType("Pressable")
    .find((node) => node.props.accessibilityLabel === note.title);
  await act(async () => {
    row.props.onPress();
  });
  assert.equal(tree.root.findByType("Modal").props.visible, true);
  assert.equal(marks, 0);
  assert.ok(labels(tree.root).includes(note.body));
  await act(async () => {
    tree.unmount();
  });
  note.readAt = null;
  await act(async () => {
    tree = create(React.createElement(Inbox));
  });
  await act(async () => {
    tree.root
      .findAllByType("Pressable")
      .find((node) => node.props.accessibilityLabel.startsWith(note.title))
      .props.onPress();
  });
  assert.equal(marks, 1);
  await act(async () => {
    tree.unmount();
  });
});

function bookingFixture(overrides = {}) {
  const provider = {
    id: "provider",
    displayName: "Fixture",
    timezone: "UTC",
    currencyCode: "NGN",
    locations: [],
  };
  const service = {
    id: "service",
    name: "Haircut",
    durationMinutes: 30,
    priceCents: 4550,
    currencyCode: "USD",
    availableChannels: ["IN_PERSON"],
    defaultChannel: "IN_PERSON",
    intakeFields: [],
    requiredDocumentLabels: [],
  };
  return screen("NativeBookingScreen", {
    "@/src/store/session-context": {
      useSession: () => ({
        isSignedIn: true,
        user: {
          id: "customer",
          userType: "CUSTOMER",
          firstName: "Test",
          email: "fixture@example.invalid",
        },
        profile: {},
      }),
    },
    "@/src/lib/api/marketplace": {
      getMarketplaceProvider: async () => ({
        provider,
        services: { groups: [{ services: [service] }], suggested: [] },
      }),
    },
    "@/src/lib/api/bookings": {
      createCustomerBooking: async () => ({ id: "booking" }),
      getPublicBookingAvailability: async () => ({ slots: [] }),
      getPublicBookingAvailabilityMonth: async () => ({ days: [] }),
      ...overrides,
    },
  });
}
test("calendar-summary failure leaves dates selectable and individual availability usable", async () => {
  const Booking = bookingFixture({
    getPublicBookingAvailabilityMonth: async () => {
      throw Error("offline summary");
    },
  });
  let tree;
  await act(async () => {
    tree = create(React.createElement(Booking));
  });
  await press(tree.root, "Continue");
  const dayButtons = tree.root
    .findAllByType("Pressable")
    .filter(
      (node) =>
        node.props.accessibilityLabel?.match(/\b\d+\b/) &&
        node.props.accessibilityState,
    );
  assert.equal(dayButtons.length, 21);
  assert.ok(dayButtons.every((node) => !node.props.disabled));
  await act(async () => {
    tree.unmount();
  });
});
test("late availability for a previous day never replaces the newly selected day", async () => {
  const requests = [];
  const Booking = bookingFixture({
    getPublicBookingAvailability: (params) => {
      const pending = deferred();
      requests.push({ params, ...pending });
      return pending.promise;
    },
  });
  let tree;
  await act(async () => {
    tree = create(React.createElement(Booking));
  });
  await press(tree.root, "Continue");
  assert.equal(requests.length, 1);
  const days = tree.root
    .findAllByType("Pressable")
    .filter(
      (node) =>
        node.props.accessibilityLabel?.match(/\b\d+\b/) &&
        node.props.accessibilityState,
    );
  await act(async () => {
    days[1].props.onPress();
  });
  assert.equal(requests.length, 2);
  const oldTime = "2026-10-18T10:00:00Z",
    newTime = "2026-10-19T15:00:00Z";
  await act(async () => {
    requests[1].resolve({
      slots: [{ startAt: newTime, endAt: "2026-10-19T15:30:00Z" }],
    });
  });
  await act(async () => {
    requests[0].resolve({
      slots: [{ startAt: oldTime, endAt: "2026-10-18T10:30:00Z" }],
    });
  });
  const times = tree.root
    .findAllByType("Pressable")
    .map((node) => node.props.accessibilityLabel);
  assert.ok(times.includes(new Date(newTime).toLocaleString(undefined, { timeZone: "UTC" })));
  assert.ok(!times.includes(new Date(oldTime).toLocaleString(undefined, { timeZone: "UTC" })));
  await act(async () => {
    tree.unmount();
  });
});

test("business profile always opens and shares its BookMiz page, hiding placeholder external websites", async () => {
  const opened = [], shared = [];
  // Only native link/share boundaries are mocked; the actual screen and URL policy render here.
  const profile = { provider: { id: "provider", slug: "business", displayName: "Test Studio", websiteUrl: "https://fadelab.example.com", currencyCode: "NGN", lowestPriceCents: null },
    hours: { todayLabel: "Closed", week: [] }, gallery: [], services: { suggested: [], groups: [] },
    reviewSummary: { totalReviews: 0, reviews: [] } };
  const Provider = screen("ProviderDetailScreen", {
    "@/src/store/session-context": { useSession: () => ({ isSignedIn: false }) },
    "@/src/lib/api/marketplace": { getMarketplaceProvider: async () => profile },
    "@/src/lib/marketplace-display": { formatMarketplacePrice: () => "", formatPriceTier: () => "", formatMarketplaceDistance: () => "", getMarketplaceLocationLabel: () => "", resolveMarketplaceImage: () => ({ uri: "photo" }) },
    __native: { Linking: { openURL: async (url) => { opened.push(url); } }, Share: { share: async (payload) => { shared.push(payload); return {}; } } },
  });
  let tree;
  await act(async () => { tree = create(React.createElement(Provider)); });
  assert.ok(!labels(tree.root).includes("Website"));
  await act(async () => { await tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === "Open Test Studio's BookMiz business page").props.onPress(); });
  assert.equal(opened[0], "https://www.bookmiz.com/marketplace/providers/business");
  await act(async () => { await tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === "Share Test Studio's business page").props.onPress(); });
  assert.equal(shared[0].url, opened[0]);
  await act(async () => tree.unmount());
});

test("quote acceptance is offered only for unlocked matches on an active, unselected request", async () => {
  const { canAcceptQuoteMatch } = utility("service-request-utils");
  const request = { id: "request", requestedServiceName: "Haircut", city: "Dallas", status: "MATCHED", conversations: [],
    matches: ["UNLOCKED", "AVAILABLE", "EXPIRED", "DECLINED"].map((status) => ({ id: status, status, provider: { displayName: status } })) };
  assert.equal(canAcceptQuoteMatch(request, "UNLOCKED"), true);
  for (const id of ["AVAILABLE", "EXPIRED", "DECLINED", "missing"]) assert.equal(canAcceptQuoteMatch(request, id), false);
  const blocked = [
    ...["ACCEPTED", "CANCELLED", "EXPIRED"].map((status) => ({ ...request, status })),
    { ...request, acceptedQuoteMatchId: "another" }, { ...request, acceptedProviderId: "provider" },
    { ...request, acceptedAt: "2026-10-19T12:00:00Z" },
    { ...request, matches: [...request.matches, { id: "other", status: "ACCEPTED", provider: { displayName: "Chosen" } }] },
  ];
  for (const item of blocked) assert.equal(canAcceptQuoteMatch(item, "UNLOCKED"), false);
  let current = request;
  let poll;
  let accepts = 0;
  const pending = deferred();
  const Workbench = screen("WorkbenchScreen", {
    __setInterval: (callback) => { poll = callback; return 0; },
    "@/src/store/session-context": { useSession: () => ({ activePersona: "customer", user: { id: "customer", email: "fixture@example.invalid" }, profile: {} }) },
    "@/src/lib/api/marketplace": {
      listMarketplaceRequestTemplates: async () => [], listCustomerQuoteRequests: async () => [current],
      acceptCustomerQuoteMatch: () => { accepts++; return pending.promise; },
    },
    "@/src/lib/marketplace-display": { formatMarketplaceDistance: () => "", formatMarketplacePrice: () => "" },
    "@/src/lib/service-request-utils": utility("service-request-utils"),
  });
  let tree;
  await act(async () => { tree = create(React.createElement(Workbench)); });
  const buttons = () => tree.root.findAllByType("Button").filter((node) => node.props.label === "Accept");
  assert.equal(buttons().length, 1);
  const accept = buttons()[0].props.onPress;
  let sending;
  await act(async () => { sending = accept(); await accept(); });
  assert.equal(accepts, 1, "rapid taps must send one selection");
  current = { ...request, status: "ACCEPTED", acceptedQuoteMatchId: "UNLOCKED" };
  await act(async () => { pending.resolve({}); await sending; });
  assert.equal(buttons().length, 0);
  for (const item of blocked) {
    current = item;
    await act(async () => { await poll(); });
    assert.equal(buttons().length, 0, `no acceptance for ${JSON.stringify(item)}`);
  }
  await act(async () => tree.unmount());
});

test("chat opens as a modal, keeps conversation drafts separate and preserves text typed during send", async () => {
  const pending = deferred();
  let poll;
  const conversations = ["a", "b"].map((id) => ({
    id,
    quoteMatchId: `match-${id}`,
    provider: { displayName: `Provider ${id}` },
    messages: [],
    requesterEmail: "fixture@example.invalid",
  }));
  const request = {
    id: "request",
    requestedServiceName: "Haircut",
    city: "Dallas",
    status: "MATCHED",
    matches: conversations.map((c) => ({
      id: c.quoteMatchId,
      provider: {
        displayName: c.provider.displayName,
        businessCategory: "Barber",
      },
      status: "MATCHED",
    })),
    conversations,
  };
  const Workbench = screen("WorkbenchScreen", {
    __platform: "android",
    __setInterval: (callback) => {
      poll = callback;
      return 0;
    },
    "@/src/store/session-context": { useSession: () => session },
    "@/src/lib/api/marketplace": {
      listMarketplaceRequestTemplates: async () => [],
      listCustomerQuoteRequests: async () => [request],
      sendRequesterQuoteMessage: () => pending.promise,
    },
    "@/src/lib/marketplace-display": {
      formatMarketplaceDistance: () => "",
      formatMarketplacePrice: () => "",
    },
    "@/src/lib/service-request-utils": utility("service-request-utils"),
  });
  const session = {
    activePersona: "customer",
    user: { id: "customer", email: "fixture@example.invalid" },
    profile: {},
  };
  let tree;
  await act(async () => {
    tree = create(React.createElement(Workbench));
  });
  await press(tree.root, "Open chat");
  assert.ok(
    tree.root.findAllByType("Modal").some((node) => node.props.visible),
  );
  const input = () =>
    tree.root
      .findAllByType("TextInput")
      .find((node) => node.props.accessibilityLabel === "Reply");
  assert.ok(tree.root.findAllByType('KeyboardAvoidingView').some((node) => node.props.behavior === 'height'));
  for (let ancestor = input(); ancestor; ancestor = ancestor.parent) assert.notEqual(ancestor.type, 'FlatList', 'composer must remain outside the scrolling history');
  await act(async () => {
    input().props.onChangeText("Draft A");
  });
  const selectB = () =>
    tree.root
      .findAllByType("Pressable")
      .find(
        (node) =>
          node.props.accessibilityRole === "tab" &&
          labels(node).includes("Provider b"),
      );
  await act(async () => {
    selectB().props.onPress();
  });
  assert.equal(input().props.value, "");
  await act(async () => {
    input().props.onChangeText("Draft B");
  });
  await act(async () => {
    tree.root
      .findAllByType("Pressable")
      .find(
        (node) =>
          node.props.accessibilityRole === "tab" &&
          labels(node).includes("Provider a"),
      )
      .props.onPress();
  });
  assert.equal(input().props.value, "Draft A");
  let sending;
  await act(async () => {
    sending = tree.root
      .findAllByType("Pressable")
      .find((node) => node.props.accessibilityLabel === "Send")
      .props.onPress();
  });
  await act(async () => {
    input().props.onChangeText("Next message");
  });
  await act(async () => {
    pending.resolve({});
    await sending;
  });
  assert.equal(input().props.value, "Next message");
  conversations[0].messages = [
    {
      id: "incoming",
      senderRole: "PROVIDER",
      senderName: "Provider a",
      content: "Your quote is ready",
    },
  ];
  await act(async () => {
    poll();
  });
  assert.ok(labels(tree.root).includes("Your quote is ready"));
  await act(async () => {
    tree.unmount();
  });
});

test('notification actions open matching native screens and reject untrusted destinations', () => {
  const { notificationDestination } = utility('notification-destination');
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(notificationDestination({ actionUrl: `/customer/quotes?quoteRequestId=${id}` }).route, `/(tabs)/workbench?requestId=${id}`);
  assert.equal(notificationDestination({ actionUrl: `/customer/appointments?booking=${id}` }).route, `/appointments/${id}`);
  for (const actionUrl of ['javascript:alert(1)', 'http://bookmiz.com/customer/quotes', 'https://evil.example/customer/quotes', 'https://bookmiz.com.evil.example/']) assert.equal(notificationDestination({ actionUrl }), null);
});

test("security password changes rotate the mobile session and clear password inputs", async () => {
  let submitted, applied;
  const auth = {
    session: { accessToken: "new-fixture", refreshToken: "new-refresh" },
  };
  const Security = screen("SecurityScreen", {
    "@/src/store/session-context": {
      useSession: () => ({
        isSignedIn: true,
        isHydrating: false,
        applyAuthResponse: async (value) => {
          applied = value;
        },
      }),
    },
    "@/src/lib/api/auth": {
      getAccountDeletionRequest: async () => null,
      getSecuritySummary: async () => ({ mfaEnabled: false }),
      listSecuritySessions: async () => [],
      changeMobilePassword: async (...args) => {
        submitted = args;
        return auth;
      },
    },
  });
  let tree;
  await act(async () => {
    tree = create(React.createElement(Security));
  });
  for (const [label, value] of [
    ["Current password", "CurrentFixture123!"],
    ["New password", "NewFixture123!"],
    ["Confirm new password", "NewFixture123!"],
  ]) {
    await act(async () => {
      tree.root
        .findAllByType("Field")
        .find((node) => node.props.label === label)
        .props.onChangeText(value);
    });
  }
  await press(tree.root, "Change password");
  assert.deepEqual(submitted, ["CurrentFixture123!", "NewFixture123!"]);
  assert.equal(applied, auth);
  assert.ok(
    tree.root
      .findAllByType("Field")
      .filter((node) => /password/i.test(node.props.label))
      .every((node) => node.props.value === ""),
  );
  await act(async () => {
    tree.unmount();
  });
});

test("a failed MFA enable keeps the setup secret and entered code available for retry", async () => {
  const Security = screen("SecurityScreen", {
    "@/src/store/session-context": {
      useSession: () => ({ isSignedIn: true, isHydrating: false }),
    },
    "@/src/lib/api/auth": {
      getAccountDeletionRequest: async () => null,
      getSecuritySummary: async () => ({ mfaEnabled: false }),
      listSecuritySessions: async () => [],
      setupMobileMfa: async () => ({ secret: "FIXTURESECRET" }),
      updateMobileMfa: async () => {
        throw Error("The MFA verification code is invalid.");
      },
    },
  });
  let tree;
  await act(async () => {
    tree = create(React.createElement(Security));
  });
  await press(tree.root, "Set up authenticator");
  await act(async () => {
    tree.root
      .findAllByType("Field")
      .find((node) => node.props.label === "Authenticator code")
      .props.onChangeText("123456");
  });
  await press(tree.root, "Enable MFA");
  assert.ok(labels(tree.root).includes("FIXTURESECRET"));
  assert.ok(
    labels(tree.root).includes("The MFA verification code is invalid."),
  );
  assert.equal(
    tree.root
      .findAllByType("Field")
      .find((node) => node.props.label === "Authenticator code").props.value,
    "123456",
  );
  await act(async () => {
    tree.unmount();
  });
});

test("account deletion requires confirmation, displays its review reference and supports withdrawal", async () => {
  let confirmation,
    requested = 0,
    withdrawn = 0;
  const request = {
    id: "fixture-request",
    status: "PENDING",
    requestedAt: "2026-10-18T00:00:00Z",
  };
  const Security = screen("SecurityScreen", {
    "react-native": {
      View: "View",
      Text: "Text",
      StyleSheet: { create: (x) => x },
      Alert: {
        alert: (...args) => {
          confirmation = args;
        },
      },
    },
    "@/src/store/session-context": {
      useSession: () => ({
        isSignedIn: true,
        user: { id: "fixture-user", emailVerified: true },
      }),
    },
    "@/src/lib/api/auth": {
      getSecuritySummary: async () => ({ mfaEnabled: false }),
      listSecuritySessions: async () => [],
      getAccountDeletionRequest: async () => null,
      requestAccountDeletion: async () => {
        requested++;
        return request;
      },
      withdrawAccountDeletion: async () => {
        withdrawn++;
        return { ...request, status: "CANCELLED" };
      },
    },
  });
  let tree;
  await act(async () => {
    tree = create(React.createElement(Security));
  });
  await press(tree.root, "Request account deletion");
  assert.equal(requested, 0);
  await act(async () => {
    await confirmation[2]
      .find((action) => action.text === "Submit request")
      .onPress();
  });
  assert.equal(requested, 1);
  assert.ok(labels(tree.root).join(" ").includes("fixture-request"));
  assert.ok(labels(tree.root).join(" ").includes("Awaiting review"));
  await press(tree.root, "Withdraw deletion request");
  assert.equal(withdrawn, 1);
  assert.ok(
    tree.root
      .findAllByType("Button")
      .some((node) => node.props.label === "Request account deletion"),
  );
  await act(async () => tree.unmount());
});


test("native booking displays the service USD price even when the business profile is NGN", async () => {
  const Booking = bookingFixture(); let tree;
  await act(async () => { tree = create(React.createElement(Booking)); });
  const text = labels(tree.root).join(" ");
  assert.match(text, /USD/); assert.match(text, /45\.50/); assert.doesNotMatch(text, /NGN/);
  await act(async () => { tree.unmount(); });
});


test('customer actions respect separate server deadlines and never offer changes without a reviewed policy', () => {
  const { canCancelBooking, canRescheduleBooking } = utility('booking-display');
  const later = new Date(Date.now() + 3600000).toISOString(), earlier = new Date(Date.now() - 3600000).toISOString();
  const booking = { status: 'CONFIRMED', startsAt: later, customerPolicy: { changeDeadline: earlier, cancellationDeadline: earlier, rescheduleDeadline: later, canCancel: false, canReschedule: true } };
  assert.equal(canCancelBooking(booking), false); assert.equal(canRescheduleBooking(booking), true);
  assert.equal(canCancelBooking({ ...booking, customerPolicy: undefined }), false);
  assert.equal(canRescheduleBooking({ ...booking, customerPolicy: { ...booking.customerPolicy, requiresReview: true } }), false);
  for (const status of ['CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW']) assert.equal(canRescheduleBooking({ ...booking, status }), false);
});


test("inbox filters ignore an older response and repeated taps mark an unread update only once", async () => {
  const requests=[],read=deferred();let marks=0;
  const Inbox=screen('InboxScreen',{'@/src/components/Screen':{Screen:props=>React.createElement('Screen',props,props.heroContent,props.children)},'@/src/lib/api/notifications':{
    listInboxNotifications: options=>{const next=deferred();requests.push({options,...next});return next.promise;},
    markInboxNotificationRead:async()=>{marks++;await read.promise;},markAllInboxNotificationsRead:async()=>{},
  }});
  let tree;await act(async()=>{tree=create(React.createElement(Inbox));});
  await act(async()=>tree.root.findAllByType('Pressable').find(node=>node.props.accessibilityLabel==='Show payments updates').props.onPress());
  assert.equal(requests[1].options.category,'PAYMENTS');
  const old={id:'old',eventKey:'booking.confirmed.customer',title:'Old booking',body:'Old body',createdAt:new Date().toISOString(),readAt:null};
  await act(async()=>requests[0].resolve({items:[old],unreadCount:42}));assert(!labels(tree.root).includes('Old booking'));
  const paid={...old,id:'payment',eventKey:'booking.refund',title:'Refund confirmed',body:'Your refund is confirmed.'};
  await act(async()=>requests[1].resolve({items:[paid],unreadCount:42}));
  const row=tree.root.findAllByType('Pressable').find(node=>node.props.accessibilityLabel==='Refund confirmed, unread');
  await act(async()=>{row.props.onPress();row.props.onPress();});assert.equal(marks,1);assert(labels(tree.root).includes('41 unread updates'));
  await act(async()=>read.resolve());await act(async()=>tree.unmount());
});

test('account personal information starts closed and edit opens a separate page', async () => {
  const pushes = [], profile = { firstName: 'Test', lastName: 'User', email: 'test@example.invalid', city: 'Chicago' };
  const session = { user: { id: 'fixture', ...profile }, profile };
  const Account = screen('AccountScreen', {
    'expo-router': { useRouter: () => ({ push: path => pushes.push(path) }) },
    '@/src/components/PersonaSwitcher': { PersonaSwitcher: 'PersonaSwitcher' },
    '@/src/components/AppUpdatesPanel': { AppUpdatesPanel: 'AppUpdatesPanel' },
    '@/src/components/ProfilePhotoEditor': { ProfilePhotoEditor: 'PhotoEditor' },
    '@/src/lib/mobile-push': { getPushRegistration: async () => null },
    '@/src/store/session-context': { useSession: () => session },
  });
  let tree; await act(async () => { tree = create(React.createElement(Account)); });
  const toggle = () => tree.root.findByProps({ accessibilityLabel: 'Personal information' });
  assert.equal(toggle().props.accessibilityState.expanded, false);
  await act(async () => toggle().props.onPress());
  await act(async () => tree.root.findAllByType('Button').find(node => node.props.label === 'Edit profile').props.onPress());
  assert.deepEqual(pushes, ['/edit-profile']);
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'First name' }).length, 0);
  await act(async () => toggle().props.onPress());
  assert.equal(toggle().props.accessibilityState.expanded, false);
  await act(async () => tree.unmount());
});

test('device notification toggle waits for registration, prevents duplicate requests and retains state on failure', async () => {
  const registration = deferred(), enabling = deferred(); let enables = 0, disables = 0;
  const user = { id: 'fixture', firstName: 'Test', lastName: 'User' };
  const session = { user, profile: null };
  const Account = screen('AccountScreen', {
    '@/src/components/PersonaSwitcher': { PersonaSwitcher: 'PersonaSwitcher' },
    '@/src/components/AppUpdatesPanel': { AppUpdatesPanel: 'AppUpdatesPanel' },
    '@/src/components/ProfilePhotoEditor': { ProfilePhotoEditor: 'PhotoEditor' },
    '@/src/components/ProfileLocationPicker': { ProfileLocationPicker: 'LocationPicker' },
    '@/src/lib/mobile-push': { getPushRegistration: () => registration.promise, enablePush: async () => { enables++; await enabling.promise; }, disablePush: async () => { disables++; throw Error('Permission update failed'); } },
    '@/src/store/session-context': { useSession: () => session },
  });
  let tree; await act(async () => { tree = create(React.createElement(Account)); });
  const toggle = () => tree.root.findByProps({ accessibilityLabel: 'Device notifications' });
  assert.equal(toggle().props.disabled, true);
  await act(async () => registration.resolve(null));
  assert.equal(toggle().props.value, false);
  const change = toggle().props.onValueChange;
  let first; await act(async () => { first = change(true); void change(true); });
  assert.equal(enables, 1); assert.equal(toggle().props.disabled, true);
  assert.equal(toggle().props.value, false);
  await act(async () => { enabling.resolve(); await first; });
  assert.equal(toggle().props.value, true);
  await act(async () => toggle().props.onValueChange(false));
  assert.equal(disables, 1); assert.equal(toggle().props.value, true);
  assert.equal(toggle().props.disabled, false);
  assert(tree.root.findAllByProps({ accessibilityRole: 'alert' }).some(node => node.props.children === 'Permission update failed'));
  await act(async () => tree.unmount());
});

test('profile page protects drafts, validates location and returns only after a successful save', async () => {
  let prevention, fail = true, saves = 0, backs = 0, dispatched, alerts;
  const pending = deferred(), payloads = [];
  const profile = { firstName: 'Test', lastName: 'User', phone: '123', city: 'Chicago', stateCode: 'IL', countryCode: 'US' };
  const session = { user: { id: 'fixture', ...profile }, profile, updateProfile: async payload => { saves++; payloads.push(payload); if (fail) throw Error('Save failed'); await pending.promise; } };
  const router = { canGoBack: () => true, back: () => { backs++; } };
  const navigation = { dispatch: action => { dispatched = action; } };
  const Edit = screen('EditProfileScreen', {
    'expo-router': { useRouter: () => router, useNavigation: () => navigation },
    'expo-router/react-navigation': { usePreventRemove: (enabled, callback) => { prevention = { enabled, callback }; } },
    __native: { Alert: { alert: (...args) => { alerts = args; } } },
    '@/src/components/ProfileLocationPicker': { ProfileLocationPicker: 'LocationPicker' },
    '@/src/store/session-context': { useSession: () => session },
  });
  let tree; await act(async () => { tree = create(React.createElement(Edit)); });
  const save = () => tree.root.findByType('Button');
  const name = () => tree.root.findByProps({ accessibilityLabel: 'First name' });
  assert.equal(save().props.disabled, true); assert.equal(prevention.enabled, false);
  await act(async () => name().props.onChangeText('New name'));
  assert.equal(prevention.enabled, true);
  const action = { type: 'GO_BACK' }; prevention.callback({ data: { action } });
  assert.equal(alerts[0], 'Discard changes?');
  alerts[2][1].onPress(); assert.equal(dispatched, action);
  const picker = () => tree.root.findByType('LocationPicker');
  const location = picker().props.value;
  await act(async () => picker().props.onChange({ ...location, city: '' }, false));
  assert.equal(save().props.disabled, true);
  await act(async () => picker().props.onChange(location, true));
  await act(async () => save().props.onPress());
  assert.equal(backs, 0); assert.equal(name().props.value, 'New name');
  assert(tree.root.findAllByProps({ accessibilityRole: 'alert' }).some(node => node.props.children === 'Save failed'));
  fail = false;
  await act(async () => { const press = save().props.onPress; press(); press(); });
  assert.equal(saves, 2); assert.equal(save().props.disabled, true);
  await act(async () => pending.resolve());
  assert.equal(backs, 1); assert.equal(prevention.enabled, false);
  assert.equal(payloads[1].firstName, 'New name');
  assert.equal('city' in payloads[1], false);
  await act(async () => tree.unmount());
});

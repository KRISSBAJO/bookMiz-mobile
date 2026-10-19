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
    Animated: {
      Value: class {},
      View: "AnimatedView",
      loop: () => ({ start() {}, stop() {} }),
      sequence() {},
      timing() {},
    },
  };
  const authButton = (props) => React.createElement("Button", props);
  const deps = {
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
    "@/src/components/Screen": {
      Screen: (props) => React.createElement("Screen", props, props.children),
    },
    "@/src/components/SectionHeader": { SectionHeader: "SectionHeader" },
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
    currencyCode: "USD",
  };
  const service = {
    id: "service",
    name: "Haircut",
    durationMinutes: 30,
    priceCents: 4550,
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
  assert.ok(times.includes(new Date(newTime).toLocaleString()));
  assert.ok(!times.includes(new Date(oldTime).toLocaleString()));
  await act(async () => {
    tree.unmount();
  });
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

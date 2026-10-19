import { useFocusEffect } from "expo-router/react-navigation";
import { useRouter } from "expo-router";
import { FontAwesome6 } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AgentOperationsPanel } from "@/src/components/agent/AgentOperationsPanel";
import { AuthButton } from "@/src/components/auth/AuthButton";
import { AuthField } from "@/src/components/auth/AuthField";
import { Screen } from "@/src/components/Screen";
import { SectionHeader } from "@/src/components/SectionHeader";
import {
  createAgentPayoutRequest,
  getAgentDashboard,
  listAgentPayoutBanks,
  resolveAgentPayoutAccount,
  setDefaultAgentPayoutAccount,
  updateAgentPayoutAccount,
} from "@/src/lib/api/agent";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import type {
  AgentDashboard,
  PlatformAgentAttribution,
  PlatformAgentCommission,
  PlatformAgentPayoutAccount,
  PlatformPayoutBankDirectory,
} from "@/src/lib/api/types";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

const agentTabs = [
  { id: "overview", label: "Overview", icon: "chart-line" },
  { id: "operations", label: "Operations", icon: "inbox" },
  { id: "providers", label: "Providers", icon: "briefcase" },
  { id: "commissions", label: "Commissions", icon: "coins" },
  { id: "payouts", label: "Payouts", icon: "wallet" },
] as const;

type AgentTabId = (typeof agentTabs)[number]["id"];

type AccountFormState = {
  accountId: string | null;
  setAsDefault: boolean;
  countryCode: string;
  currencyCode: string;
  accountHolderName: string;
  bankName: string;
  bankCode: string;
  branchCode: string;
  accountNumber: string;
  routingNumber: string;
  accountReference: string;
  destinationLabel: string;
  payoutNotes: string;
};

type PayoutFormState = {
  payoutAccountId: string;
  agentNote: string;
};

const defaultAccountForm: AccountFormState = {
  accountId: null,
  setAsDefault: true,
  countryCode: "US",
  currencyCode: "USD",
  accountHolderName: "",
  bankName: "",
  bankCode: "",
  branchCode: "",
  accountNumber: "",
  routingNumber: "",
  accountReference: "",
  destinationLabel: "",
  payoutNotes: "",
};

function formatMoney(value: number, currencyCode?: string) {
  if (!currencyCode) return "Currency unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getCountryLabel(code: string) {
  switch (code) {
    case "NG":
      return "Nigeria";
    case "US":
      return "United States";
    default:
      return code;
  }
}

function getDefaultCurrency(code: string) {
  switch (code) {
    case "NG":
      return "NGN";
    case "US":
      return "USD";
    default:
      return "USD";
  }
}

function getStatusTone(status: string) {
  switch (status) {
    case "ACTIVE":
    case "AVAILABLE":
    case "PAID":
      return styles.statusSuccess;
    case "PENDING":
    case "REQUESTED":
    case "APPROVED":
    case "PENDING_VERIFICATION":
      return styles.statusPending;
    case "ENDED":
    case "REVERSED":
    case "REJECTED":
    case "CANCELLED":
    case "DISABLED":
      return styles.statusDanger;
    default:
      return styles.statusNeutral;
  }
}

function getProcessorLabel(processor: PlatformAgentPayoutAccount["processor"]) {
  switch (processor) {
    case "PAYSTACK":
      return "Paystack";
    case "STRIPE":
      return "Stripe";
    default:
      return "Manual";
  }
}

function commissionSourceLabel(source: PlatformAgentCommission["sourceType"]) {
  return {
    SUBSCRIPTION: "Subscription",
    QUOTE_UNLOCK: "Lead unlock",
    MANUAL_ADJUSTMENT: "Manual adjustment",
    REVERSAL: "Reversal",
  }[source];
}

function providerLocationLabel(attribution: PlatformAgentAttribution) {
  const location = attribution.provider?.primaryLocation;

  if (!location) {
    return "Location pending";
  }

  return `${location.city}${location.stateCode ? `, ${location.stateCode}` : ""}`;
}

function isAttributionExpiringSoon(attribution: PlatformAgentAttribution) {
  if (attribution.status !== "ACTIVE") {
    return false;
  }

  const days =
    (new Date(attribution.attributionEndsAt).getTime() - Date.now()) /
    (24 * 60 * 60 * 1000);

  return days <= 30;
}

function buildAccountFormFromAccount(
  account: PlatformAgentPayoutAccount | null,
  fallbackCountryCode: string,
): AccountFormState {
  if (!account) {
    return {
      ...defaultAccountForm,
      countryCode: fallbackCountryCode,
      currencyCode: getDefaultCurrency(fallbackCountryCode),
    };
  }

  return {
    accountId: account.id,
    setAsDefault: account.isDefault,
    countryCode: account.countryCode,
    currencyCode: account.currencyCode,
    accountHolderName: account.accountHolderName,
    bankName: account.bankName,
    bankCode: account.bankCode ?? "",
    branchCode: account.branchCode ?? "",
    accountNumber: "",
    routingNumber: "",
    accountReference: account.accountReference ?? "",
    destinationLabel: account.destinationLabel ?? "",
    payoutNotes: account.payoutNotes ?? "",
  };
}

function buildPayoutFormFromDashboard(
  dashboard: AgentDashboard | null,
  requestedAccountId?: string | null,
): PayoutFormState {
  return {
    payoutAccountId:
      requestedAccountId ??
      dashboard?.payoutWorkspace.defaultPayoutAccountId ??
      dashboard?.payoutWorkspace.accounts.find(
        (account) => account.status === "ACTIVE",
      )?.id ??
      "",
    agentNote: "",
  };
}

function countStatus<T extends { status: string }>(items: T[], status: string) {
  return items.filter((item) => item.status === status).length;
}

export function AgentWorkbenchScreen() {
  const router = useRouter();
  const session = useSession();
  const [dashboard, setDashboard] = useState<AgentDashboard | null>(null);
  const [activeTab, setActiveTab] = useState<AgentTabId>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState<PayoutFormState>({
    payoutAccountId: "",
    agentNote: "",
  });
  const [accountForm, setAccountForm] =
    useState<AccountFormState>(defaultAccountForm);
  const [banks, setBanks] = useState<PlatformPayoutBankDirectory>([]);
  const [bankLookupLoading, setBankLookupLoading] = useState(false);
  const [resolutionLoading, setResolutionLoading] = useState(false);
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>(
    null,
  );
  const resolutionKey = `${accountForm.countryCode}:${accountForm.bankCode}:${accountForm.accountNumber}`;
  const currentResolutionKey = useRef(resolutionKey);
  currentResolutionKey.current = resolutionKey;
  useEffect(() => {
    setResolvedAccountName(null);
  }, [resolutionKey]);
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [settingDefaultAccountId, setSettingDefaultAccountId] = useState<
    string | null
  >(null);

  const agentName =
    [session.user?.firstName, session.user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    session.user?.email ||
    "BookMiz agent";

  const activeCurrencyCode =
    dashboard?.summary.currencyCode ??
    dashboard?.payoutWorkspace.account?.currencyCode ??
    dashboard?.commissions[0]?.currencyCode ??
    "USD";
  const operatingCountryCode =
    dashboard?.payoutWorkspace.operatingCountryCode ?? "US";
  const payoutAccounts = dashboard?.payoutWorkspace.accounts ?? [];
  const activePayoutAccounts = payoutAccounts.filter(
    (account) => account.status === "ACTIVE",
  );
  const matchingPayoutAccounts = activePayoutAccounts.filter(
    (account) => account.currencyCode === activeCurrencyCode,
  );

  const availableCommissionCount = useMemo(
    () => countStatus(dashboard?.commissions ?? [], "AVAILABLE"),
    [dashboard?.commissions],
  );

  const commissionTotals = useMemo(
    () => ({
      pending: dashboard?.summary.pendingCommissionCents ?? 0,
      available: dashboard?.summary.availableCommissionCents ?? 0,
      requested: dashboard?.summary.requestedCommissionCents ?? 0,
      paid: dashboard?.summary.paidCommissionCents ?? 0,
    }),
    [dashboard?.summary],
  );

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const nextDashboard = await getAgentDashboard();
      setDashboard(nextDashboard);
      setPayoutForm((current) =>
        buildPayoutFormFromDashboard(
          nextDashboard,
          current.payoutAccountId || undefined,
        ),
      );
    } catch (nextError) {
      setError(
        getFriendlyApiError(
          nextError,
          "We could not load the agent workspace.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  useEffect(() => {
    if (!accountModalOpen || accountForm.countryCode !== "NG") {
      setBanks([]);
      return;
    }

    let isActive = true;

    const loadBanks = async () => {
      try {
        setBankLookupLoading(true);
        const nextBanks = await listAgentPayoutBanks("NG");

        if (!isActive) {
          return;
        }

        setBanks(nextBanks.filter((bank) => bank.active));
      } catch (nextError) {
        if (isActive) {
          setError(
            getFriendlyApiError(nextError, "We could not load payout banks."),
          );
        }
      } finally {
        if (isActive) {
          setBankLookupLoading(false);
        }
      }
    };

    void loadBanks();

    return () => {
      isActive = false;
    };
  }, [accountForm.countryCode, accountModalOpen]);

  const openAddAccountModal = useCallback(
    (account?: PlatformAgentPayoutAccount | null) => {
      setError(null);
      setSuccess(null);
      setResolvedAccountName(account?.accountHolderName ?? null);
      setAccountForm(
        buildAccountFormFromAccount(
          account ?? dashboard?.payoutWorkspace.account ?? null,
          operatingCountryCode,
        ),
      );
      setAccountModalOpen(true);
    },
    [dashboard?.payoutWorkspace.account, operatingCountryCode],
  );

  const openPayoutRequestModal = useCallback(
    (requestedAccountId?: string) => {
      setError(null);
      setSuccess(null);
      setPayoutForm(
        buildPayoutFormFromDashboard(dashboard, requestedAccountId),
      );
      setPayoutModalOpen(true);
    },
    [dashboard],
  );

  const handleAccountCountryChange = useCallback((countryCode: "US" | "NG") => {
    setResolvedAccountName(null);
    setAccountForm((current) => ({
      ...current,
      countryCode,
      currencyCode: getDefaultCurrency(countryCode),
      bankCode: countryCode === "NG" ? current.bankCode : "",
      bankName: countryCode === "NG" ? current.bankName : current.bankName,
      routingNumber: countryCode === "US" ? current.routingNumber : "",
      accountHolderName: countryCode === "NG" ? "" : current.accountHolderName,
      accountNumber: "",
    }));
  }, []);

  const handleResolveAccount = useCallback(async () => {
    const resolvingKey = `${accountForm.countryCode}:${accountForm.bankCode}:${accountForm.accountNumber}`;
    if (
      accountForm.countryCode !== "NG" ||
      !accountForm.bankCode ||
      !accountForm.accountNumber
    ) {
      setError(
        "Choose a Nigerian bank and enter the account number to verify it.",
      );
      return;
    }

    try {
      setResolutionLoading(true);
      setError(null);
      const result = await resolveAgentPayoutAccount({
        countryCode: accountForm.countryCode,
        bankCode: accountForm.bankCode,
        accountNumber: accountForm.accountNumber,
      });
      if (resolvingKey !== currentResolutionKey.current) return;
      setResolvedAccountName(result.accountName);
      setAccountForm((current) => ({
        ...current,
        accountHolderName: result.accountName,
        bankName:
          current.bankName ||
          banks.find((bank) => bank.code === current.bankCode)?.name ||
          current.bankName,
      }));
      setSuccess("Payout account verified.");
    } catch (nextError) {
      setError(
        getFriendlyApiError(
          nextError,
          "We could not verify that payout account.",
        ),
      );
    } finally {
      setResolutionLoading(false);
    }
  }, [
    accountForm.accountNumber,
    accountForm.bankCode,
    accountForm.countryCode,
    banks,
  ]);

  const handleSubmitAccount = useCallback(async () => {
    try {
      setSavingAccount(true);
      setError(null);
      setSuccess(null);

      await updateAgentPayoutAccount({
        accountId: accountForm.accountId || undefined,
        countryCode: accountForm.countryCode,
        currencyCode: accountForm.currencyCode,
        accountHolderName: accountForm.accountHolderName || undefined,
        bankName:
          accountForm.bankName ||
          banks.find((bank) => bank.code === accountForm.bankCode)?.name ||
          undefined,
        bankCode: accountForm.bankCode || undefined,
        branchCode: accountForm.branchCode || undefined,
        accountNumber: accountForm.accountNumber || undefined,
        routingNumber: accountForm.routingNumber || undefined,
        accountReference: accountForm.accountReference || undefined,
        destinationLabel: accountForm.destinationLabel || undefined,
        payoutNotes: accountForm.payoutNotes || undefined,
        setAsDefault: accountForm.setAsDefault,
      });

      setAccountModalOpen(false);
      await loadDashboard();
      setSuccess(
        accountForm.accountId
          ? "Payout method updated."
          : "Payout method added successfully.",
      );
    } catch (nextError) {
      setError(
        getFriendlyApiError(nextError, "We could not save that payout method."),
      );
    } finally {
      setSavingAccount(false);
    }
  }, [accountForm, banks, loadDashboard]);

  const handleSetDefaultAccount = useCallback(
    async (accountId: string) => {
      try {
        setSettingDefaultAccountId(accountId);
        setError(null);
        setSuccess(null);
        await setDefaultAgentPayoutAccount(accountId);
        await loadDashboard();
        setSuccess("Default payout method updated.");
      } catch (nextError) {
        setError(
          getFriendlyApiError(
            nextError,
            "We could not update the default payout method.",
          ),
        );
      } finally {
        setSettingDefaultAccountId(null);
      }
    },
    [loadDashboard],
  );

  const submitPayoutRequest = useCallback(async () => {
    if (
      !matchingPayoutAccounts.some(
        (account) => account.id === payoutForm.payoutAccountId,
      )
    ) {
      setError(
        "Choose an active payout method in the displayed balance’s currency.",
      );
      return;
    }

    try {
      setIsSubmittingPayout(true);
      setError(null);
      setSuccess(null);
      await createAgentPayoutRequest({
        payoutAccountId: payoutForm.payoutAccountId,
        agentNote: payoutForm.agentNote.trim() || undefined,
      });
      setPayoutModalOpen(false);
      setPayoutForm(buildPayoutFormFromDashboard(dashboard));
      await loadDashboard();
      setSuccess("Payout request submitted for finance review.");
    } catch (nextError) {
      setError(
        getFriendlyApiError(
          nextError,
          "We could not submit that payout request.",
        ),
      );
    } finally {
      setIsSubmittingPayout(false);
    }
  }, [dashboard, loadDashboard, payoutForm, matchingPayoutAccounts]);

  const canRequestPayout =
    matchingPayoutAccounts.length > 0 &&
    (dashboard?.summary.availableCommissionCents ?? 0) > 0 &&
    (dashboard?.summary.availableCommissionCents ?? 0) >=
      (dashboard?.summary.minimumPayoutCents ?? 0);
  const defaultAccount = dashboard?.payoutWorkspace.account ?? null;

  const renderAttributionRow = (
    attribution: PlatformAgentAttribution,
    showEnds: boolean,
  ) => {
    const expiring = isAttributionExpiringSoon(attribution);
    const statusKey = expiring ? "PENDING" : attribution.status;
    const name = attribution.provider?.displayName ?? "Provider removed";
    return (
      <View key={attribution.id} style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsFor(name)}</Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {providerLocationLabel(attribution)}
            {attribution.provider?.serviceModel
              ? ` · ${formatStatusLabel(attribution.provider.serviceModel)}`
              : ""}
            {showEnds
              ? ` · Ends ${formatDate(attribution.attributionEndsAt)}`
              : ""}
          </Text>
        </View>
        <View style={[styles.statusPill, getStatusTone(statusKey)]}>
          <Text style={[styles.statusText, getStatusTextTone(statusKey)]}>
            {expiring ? "Expiring soon" : formatStatusLabel(attribution.status)}
          </Text>
        </View>
      </View>
    );
  };

  const payoutMethodCard = (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.rowBody}>
          <Text style={styles.cardTitle}>
            {defaultAccount
              ? defaultAccount.destinationLabel || defaultAccount.bankName
              : "No payout method"}
          </Text>
          <Text style={styles.rowMeta}>
            {defaultAccount
              ? `${getProcessorLabel(defaultAccount.processor)} · ${defaultAccount.bankName} · ••••${defaultAccount.accountNumberLast4 ?? "—"}`
              : "Add a bank account to receive payouts."}
          </Text>
        </View>
        {defaultAccount ? (
          <View style={[styles.statusPill, styles.statusSuccess]}>
            <Text style={[styles.statusText, styles.statusTextSuccess]}>
              Default
            </Text>
          </View>
        ) : null}
      </View>
      <AuthButton
        label={
          payoutAccounts.length > 0
            ? "Manage payout method"
            : "Add payout method"
        }
        variant="secondary"
        style={styles.secondaryButton}
        onPress={() => openAddAccountModal()}
      />
    </View>
  );

  return (
    <Screen
      title="Agent desk"
      subtitle={`${agentName} · ${getCountryLabel(operatingCountryCode)} · ${activeCurrencyCode}`}
      showBack={false}
      refreshing={isLoading && dashboard !== null}
      onRefresh={() => void loadDashboard()}
    >
      <AuthButton
        label="Request payout"
        disabled={!canRequestPayout}
        onPress={() => openPayoutRequestModal()}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
          <Pressable
            onPress={() => void loadDashboard()}
            accessibilityRole="button"
          >
            <Text style={styles.errorRetry}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      {success ? (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      ) : null}

      <AuthButton
        label="Create a service request"
        variant="secondary"
        onPress={() => {
          session.switchPersona("customer");
          router.push({
            pathname: "/(tabs)/workbench",
            params: { service: "Custom service", description: "" },
          });
        }}
      />
      <Text style={styles.emptyBody}>
        Create a request for your own account. Provider service menus are
        managed by authorized providers.
      </Text>
      {dashboard?.payoutWorkspace.balancesByCurrency?.map((balance) => (
        <Text key={balance.currencyCode} style={styles.emptyBody}>
          {balance.currencyCode} available:{" "}
          {formatMoney(balance.availableCommissionCents, balance.currencyCode)}.
          Change the default payout method to request a different currency.
        </Text>
      ))}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.railScroll}
        contentContainerStyle={styles.tabRow}
      >
        {agentTabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tabChip, active ? styles.tabChipActive : null]}
              onPress={() => setActiveTab(tab.id)}
            >
              <FontAwesome6
                name={tab.icon}
                size={14}
                color={active ? "#ffffff" : tokens.colors.ink}
              />
              <Text
                style={[
                  styles.tabChipText,
                  active ? styles.tabChipTextActive : null,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading && !dashboard ? <SkeletonRows /> : null}

      {activeTab === "overview" && dashboard ? (
        <>
          <View style={styles.card}>
            <View style={styles.balanceHead}>
              <Text style={styles.rowMeta}>Available now</Text>
              <Text style={styles.balanceBig}>
                {formatMoney(commissionTotals.available, activeCurrencyCode)}
              </Text>
            </View>
            {[
              { label: "Pending", value: commissionTotals.pending },
              { label: "Requested", value: commissionTotals.requested },
              { label: "Paid out", value: commissionTotals.paid },
              {
                label: "Minimum payout",
                value: dashboard.summary.minimumPayoutCents ?? 0,
              },
            ].map((item) => (
              <View key={item.label} style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>{item.label}</Text>
                <Text style={styles.balanceValue}>
                  {formatMoney(item.value, activeCurrencyCode)}
                </Text>
              </View>
            ))}
          </View>

          {payoutMethodCard}

          <View style={styles.section}>
            <SectionHeader
              title="Providers"
              subtitle={`${dashboard.summary.activeProviderCount ?? 0} active · ${dashboard.summary.expiringAttributionCount ?? 0} expiring soon`}
              actionLabel={
                dashboard.attributions.length > 4 ? "See all" : undefined
              }
              onAction={
                dashboard.attributions.length > 4
                  ? () => setActiveTab("providers")
                  : undefined
              }
            />
            {dashboard.attributions.length > 0 ? (
              dashboard.attributions
                .slice(0, 4)
                .map((attribution) => renderAttributionRow(attribution, false))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No providers yet</Text>
                <Text style={styles.emptyBody}>
                  Providers you bring on show up here.
                </Text>
              </View>
            )}
          </View>
        </>
      ) : null}

      {activeTab === "operations" ? <AgentOperationsPanel /> : null}

      {activeTab === "providers" && dashboard ? (
        <View style={styles.section}>
          <SectionHeader
            title="Providers"
            subtitle={`${countStatus(dashboard.attributions, "ACTIVE")} active of ${dashboard.attributions.length}`}
          />
          {dashboard.attributions.length > 0 ? (
            dashboard.attributions.map((attribution) =>
              renderAttributionRow(attribution, true),
            )
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No providers yet</Text>
              <Text style={styles.emptyBody}>
                Providers you bring on show up here.
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {activeTab === "commissions" && dashboard ? (
        <View style={styles.section}>
          <SectionHeader
            title="Commissions"
            subtitle={`${dashboard.commissions.length} ${dashboard.commissions.length === 1 ? "entry" : "entries"} · ${availableCommissionCount} available`}
          />
          {dashboard.commissions.length > 0 ? (
            dashboard.commissions.map((commission) => (
              <View key={commission.id} style={styles.row}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {commission.provider?.displayName ?? "Provider removed"}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {commissionSourceLabel(commission.sourceType)} ·{" "}
                    {commission.commissionPercent}% of{" "}
                    {formatMoney(
                      commission.grossAmountCents,
                      commission.currencyCode,
                    )}
                  </Text>
                  {commission.note ? (
                    <Text style={styles.rowNote} numberOfLines={2}>
                      {commission.note}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.rowEnd}>
                  <Text style={styles.rowAmount}>
                    {formatMoney(
                      commission.commissionAmountCents,
                      commission.currencyCode,
                    )}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      getStatusTone(commission.status),
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        getStatusTextTone(commission.status),
                      ]}
                    >
                      {formatStatusLabel(commission.status)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No commissions yet</Text>
              <Text style={styles.emptyBody}>
                Earnings from your providers show up here.
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {activeTab === "payouts" && dashboard ? (
        <>
          {payoutMethodCard}

          <View style={styles.section}>
            <SectionHeader
              title="Saved methods"
              subtitle={`${activePayoutAccounts.length} active`}
            />
            {dashboard.payoutWorkspace.accounts.length > 0 ? (
              dashboard.payoutWorkspace.accounts.map((account) => (
                <View key={account.id} style={styles.row}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {account.destinationLabel || account.bankName}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {getCountryLabel(account.countryCode)} ·{" "}
                      {account.bankName} · ••••
                      {account.accountNumberLast4 ?? "—"}
                    </Text>
                    <View style={styles.rowLinks}>
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => openAddAccountModal(account)}
                      >
                        <Text style={styles.linkText}>Edit</Text>
                      </Pressable>
                      {!account.isDefault ? (
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() =>
                            void handleSetDefaultAccount(account.id)
                          }
                          disabled={settingDefaultAccountId === account.id}
                        >
                          <Text style={styles.linkText}>
                            {settingDefaultAccountId === account.id
                              ? "Saving…"
                              : "Make default"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      account.isDefault
                        ? styles.statusSuccess
                        : getStatusTone(account.status),
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        account.isDefault
                          ? styles.statusTextSuccess
                          : getStatusTextTone(account.status),
                      ]}
                    >
                      {account.isDefault
                        ? "Default"
                        : formatStatusLabel(account.status)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No payout methods yet</Text>
                <Text style={styles.emptyBody}>
                  Add a bank account to get paid.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <SectionHeader title="Payout requests" />
            {dashboard.payoutWorkspace.requests.length > 0 ? (
              dashboard.payoutWorkspace.requests.map((request) => (
                <View key={request.id} style={styles.row}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>
                      {formatMoney(request.amountCents, request.currencyCode)}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      Requested {formatDate(request.requestedAt)}
                      {request.destinationSummary
                        ? ` · ${request.destinationSummary}`
                        : ""}
                    </Text>
                  </View>
                  <View
                    style={[styles.statusPill, getStatusTone(request.status)]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        getStatusTextTone(request.status),
                      ]}
                    >
                      {formatStatusLabel(request.status)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No payout requests yet</Text>
                <Text style={styles.emptyBody}>
                  Request a payout once your balance clears the minimum.
                </Text>
              </View>
            )}
          </View>
        </>
      ) : null}

      <Modal
        visible={accountModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAccountModalOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => setAccountModalOpen(false)}
          />
          <View style={styles.modalSheetWrap}>
            <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
              <View style={styles.modalHandle} />
              {error ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {error}
                </Text>
              ) : null}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {accountForm.accountId
                    ? "Edit payout method"
                    : "Add payout method"}
                </Text>
                <Pressable
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setAccountModalOpen(false)}
                >
                  <FontAwesome6
                    name="xmark"
                    size={18}
                    color={tokens.colors.ink}
                  />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Country</Text>
                  <View style={styles.chipRow}>
                    {(["US", "NG"] as const).map((countryCode) => {
                      const active = accountForm.countryCode === countryCode;
                      return (
                        <Pressable
                          key={countryCode}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={[
                            styles.chip,
                            active ? styles.chipActive : null,
                          ]}
                          onPress={() =>
                            handleAccountCountryChange(countryCode)
                          }
                        >
                          <Text
                            style={[
                              styles.chipText,
                              active ? styles.chipTextActive : null,
                            ]}
                          >
                            {getCountryLabel(countryCode)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <AuthField
                  label="Label"
                  placeholder="Main account"
                  value={accountForm.destinationLabel}
                  onChangeText={(value) =>
                    setAccountForm((current) => ({
                      ...current,
                      destinationLabel: value,
                    }))
                  }
                  autoComplete="off"
                />

                {accountForm.countryCode === "NG" ? (
                  <>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Bank</Text>
                      {bankLookupLoading ? (
                        <SkeletonChips />
                      ) : (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.railScroll}
                          contentContainerStyle={styles.chipRail}
                        >
                          {banks.map((bank) => {
                            const active = accountForm.bankCode === bank.code;
                            return (
                              <Pressable
                                key={bank.code}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                style={[
                                  styles.chip,
                                  active ? styles.chipActive : null,
                                ]}
                                onPress={() =>
                                  setAccountForm((current) => ({
                                    ...current,
                                    bankCode: bank.code,
                                    bankName: bank.name,
                                  }))
                                }
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    active ? styles.chipTextActive : null,
                                  ]}
                                >
                                  {bank.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      )}
                    </View>

                    <AuthField
                      label="Account number"
                      placeholder="10 digits"
                      value={accountForm.accountNumber}
                      onChangeText={(value) =>
                        setAccountForm((current) => ({
                          ...current,
                          accountNumber: value,
                        }))
                      }
                      keyboardType="number-pad"
                      autoComplete="off"
                    />

                    <AuthButton
                      label="Verify account"
                      variant="secondary"
                      loading={resolutionLoading}
                      style={styles.secondaryButton}
                      onPress={() => void handleResolveAccount()}
                    />
                  </>
                ) : (
                  <>
                    <AuthField
                      label="Account holder"
                      placeholder="Name on the account"
                      value={accountForm.accountHolderName}
                      onChangeText={(value) =>
                        setAccountForm((current) => ({
                          ...current,
                          accountHolderName: value,
                        }))
                      }
                      autoComplete="name"
                    />
                    <AuthField
                      label="Bank name"
                      placeholder="Bank"
                      value={accountForm.bankName}
                      onChangeText={(value) =>
                        setAccountForm((current) => ({
                          ...current,
                          bankName: value,
                        }))
                      }
                      autoComplete="off"
                    />
                    <AuthField
                      label="Routing number"
                      placeholder="9 digits"
                      value={accountForm.routingNumber}
                      onChangeText={(value) =>
                        setAccountForm((current) => ({
                          ...current,
                          routingNumber: value,
                        }))
                      }
                      keyboardType="number-pad"
                      autoComplete="off"
                    />
                    <AuthField
                      label="Account number"
                      placeholder="Account number"
                      value={accountForm.accountNumber}
                      onChangeText={(value) =>
                        setAccountForm((current) => ({
                          ...current,
                          accountNumber: value,
                        }))
                      }
                      keyboardType="number-pad"
                      autoComplete="off"
                    />
                  </>
                )}

                {resolvedAccountName ? (
                  <View style={styles.successBox}>
                    <FontAwesome6
                      name="circle-check"
                      size={16}
                      color={tokens.colors.success}
                    />
                    <Text style={styles.successText}>
                      {resolvedAccountName}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Note for finance (optional)
                  </Text>
                  <TextInput
                    value={accountForm.payoutNotes}
                    onChangeText={(value) =>
                      setAccountForm((current) => ({
                        ...current,
                        payoutNotes: value,
                      }))
                    }
                    style={styles.textArea}
                    placeholder="Anything finance should know"
                    placeholderTextColor={tokens.colors.muted}
                    multiline
                    textAlignVertical="top"
                    accessibilityLabel="Note for finance"
                  />
                </View>

                <Pressable
                  style={styles.toggleRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: accountForm.setAsDefault }}
                  onPress={() =>
                    setAccountForm((current) => ({
                      ...current,
                      setAsDefault: !current.setAsDefault,
                    }))
                  }
                >
                  <View
                    style={[
                      styles.toggleIndicator,
                      accountForm.setAsDefault
                        ? styles.toggleIndicatorActive
                        : null,
                    ]}
                  >
                    {accountForm.setAsDefault ? (
                      <FontAwesome6
                        name="check"
                        size={12}
                        color={tokens.colors.inkDeep}
                      />
                    ) : null}
                  </View>
                  <Text style={styles.toggleTitle}>
                    Use as default payout method
                  </Text>
                </Pressable>

                <AuthButton
                  label="Save payout method"
                  loading={savingAccount}
                  onPress={() => void handleSubmitAccount()}
                />
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={payoutModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPayoutModalOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => setPayoutModalOpen(false)}
          />
          <View style={styles.modalSheetWrap}>
            <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
              <View style={styles.modalHandle} />
              {error ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {error}
                </Text>
              ) : null}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Request payout</Text>
                <Pressable
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setPayoutModalOpen(false)}
                >
                  <FontAwesome6
                    name="xmark"
                    size={18}
                    color={tokens.colors.ink}
                  />
                </Pressable>
              </View>
              <Text style={styles.modalSubtitle}>
                Sends your full available balance to finance for review.
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.card}>
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Available now</Text>
                    <Text style={styles.balanceValue}>
                      {formatMoney(
                        dashboard?.summary.availableCommissionCents ?? 0,
                        activeCurrencyCode,
                      )}
                    </Text>
                  </View>
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Minimum payout</Text>
                    <Text style={styles.balanceValue}>
                      {formatMoney(
                        dashboard?.summary.minimumPayoutCents ?? 0,
                        activeCurrencyCode,
                      )}
                    </Text>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Send to</Text>
                  <View style={styles.chipWrap}>
                    {matchingPayoutAccounts.map((account) => {
                      const active = payoutForm.payoutAccountId === account.id;
                      return (
                        <Pressable
                          key={account.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={[
                            styles.chip,
                            active ? styles.chipActive : null,
                          ]}
                          onPress={() =>
                            setPayoutForm((current) => ({
                              ...current,
                              payoutAccountId: account.id,
                            }))
                          }
                        >
                          <Text
                            style={[
                              styles.chipText,
                              active ? styles.chipTextActive : null,
                            ]}
                          >
                            {account.destinationLabel || account.bankName}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Note for finance (optional)
                  </Text>
                  <TextInput
                    value={payoutForm.agentNote}
                    onChangeText={(value) =>
                      setPayoutForm((current) => ({
                        ...current,
                        agentNote: value,
                      }))
                    }
                    style={styles.textArea}
                    placeholder="Anything finance should know"
                    placeholderTextColor={tokens.colors.muted}
                    multiline
                    textAlignVertical="top"
                    accessibilityLabel="Note for finance"
                  />
                </View>

                <AuthButton
                  label="Submit payout request"
                  loading={isSubmittingPayout}
                  onPress={() => void submitPayoutRequest()}
                />
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function getStatusTextTone(status: string) {
  switch (status) {
    case "ACTIVE":
    case "AVAILABLE":
    case "PAID":
      return styles.statusTextSuccess;
    case "PENDING":
    case "REQUESTED":
    case "APPROVED":
    case "PENDING_VERIFICATION":
      return styles.statusTextPending;
    case "ENDED":
    case "REVERSED":
    case "REJECTED":
    case "CANCELLED":
    case "DISABLED":
      return styles.statusTextDanger;
    default:
      return null;
  }
}

function formatStatusLabel(status: string) {
  const lower = status.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function initialsFor(value: string) {
  const letters = value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "P";
}

function usePulse() {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return opacity;
}

function SkeletonRows() {
  const opacity = usePulse();
  return (
    <View style={styles.section}>
      {[0, 1, 2].map((index) => (
        <Animated.View key={index} style={[styles.row, { opacity }]}>
          <View style={[styles.avatar, styles.skeletonBlock]} />
          <View style={styles.rowBody}>
            <View style={[styles.skeletonBlock, styles.skeletonLineShort]} />
            <View style={[styles.skeletonBlock, styles.skeletonLine]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

function SkeletonChips() {
  const opacity = usePulse();
  return (
    <View style={styles.chipRow}>
      {[0, 1, 2].map((index) => (
        <Animated.View
          key={index}
          style={[styles.chip, styles.skeletonBlock, { opacity, width: 96 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  railScroll: {
    marginHorizontal: -20,
  },
  tabRow: {
    gap: 8,
    paddingHorizontal: 20,
  },
  tabChip: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
  },
  tabChipActive: {
    backgroundColor: tokens.colors.inkDeep,
    borderColor: tokens.colors.inkDeep,
  },
  tabChipText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  tabChipTextActive: {
    color: "#ffffff",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitle: {
    color: tokens.colors.ink,
    fontSize: 17,
    fontFamily: tokens.font.display,
    letterSpacing: -0.3,
  },
  balanceHead: {
    gap: 2,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  balanceBig: {
    color: tokens.colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: tokens.font.display,
    letterSpacing: -0.4,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceLabel: {
    color: tokens.colors.muted,
    fontSize: 15,
    fontFamily: tokens.font.regular,
  },
  balanceValue: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.semibold,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#ffffff",
    padding: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.bold,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowEnd: {
    alignItems: "flex-end",
    gap: 6,
  },
  rowTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.bold,
  },
  rowMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
  },
  rowNote: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
    marginTop: 2,
  },
  rowAmount: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.bold,
  },
  rowLinks: {
    flexDirection: "row",
    gap: 16,
    marginTop: 6,
  },
  linkText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.bold,
  },
  statusPill: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusSuccess: {
    backgroundColor: tokens.colors.successSoft,
  },
  statusPending: {
    backgroundColor: tokens.colors.warningSoft,
  },
  statusDanger: {
    backgroundColor: tokens.colors.surfaceSoft,
  },
  statusNeutral: {
    backgroundColor: tokens.colors.surface,
  },
  statusText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontFamily: tokens.font.bold,
  },
  statusTextSuccess: {
    color: tokens.colors.success,
  },
  statusTextPending: {
    color: tokens.colors.warning,
  },
  statusTextDanger: {
    color: tokens.colors.mutedSoft,
  },
  secondaryButton: {
    minHeight: 48,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    padding: 20,
    alignItems: "center",
    gap: 4,
  },
  emptyTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.display,
  },
  emptyBody: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontFamily: tokens.font.regular,
  },
  errorBox: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: "#f3c4c4",
    backgroundColor: tokens.colors.dangerSoft,
    padding: 14,
    gap: 6,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
  errorRetry: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.bold,
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.successSoft,
    padding: 14,
  },
  successText: {
    flex: 1,
    color: tokens.colors.success,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.semibold,
  },
  skeletonBlock: {
    backgroundColor: tokens.colors.border,
    borderWidth: 0,
    borderRadius: 7,
  },
  skeletonLineShort: {
    height: 14,
    width: "55%",
  },
  skeletonLine: {
    height: 12,
    width: "90%",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(16, 39, 72, 0.45)",
  },
  modalSheetWrap: {
    maxHeight: "92%",
  },
  modalSheet: {
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.borderStrong,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 22,
    lineHeight: 26,
    fontFamily: tokens.font.display,
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    marginTop: 6,
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipRail: {
    gap: 8,
    paddingHorizontal: 20,
  },
  chip: {
    height: 40,
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: tokens.colors.inkDeep,
    borderColor: tokens.colors.inkDeep,
  },
  chipText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  chipTextActive: {
    color: "#ffffff",
  },
  textArea: {
    minHeight: 104,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.regular,
  },
  toggleRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleIndicator: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleIndicatorActive: {
    borderColor: tokens.colors.brand,
    backgroundColor: tokens.colors.brand,
  },
  toggleTitle: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.medium,
  },
});

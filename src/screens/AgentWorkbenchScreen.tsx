import { useFocusEffect } from "expo-router/react-navigation";
import { FontAwesome6 } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import { Screen } from "@/src/components/Screen";
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

function formatMoney(value: number, currencyCode = "USD") {
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
    SUBSCRIPTION: "Subscription revenue",
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
      dashboard?.payoutWorkspace.accounts.find((account) => account.status === "ACTIVE")?.id ??
      "",
    agentNote: "",
  };
}

function countStatus<T extends { status: string }>(items: T[], status: string) {
  return items.filter((item) => item.status === status).length;
}

export function AgentWorkbenchScreen() {
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
  const [accountForm, setAccountForm] = useState<AccountFormState>(defaultAccountForm);
  const [banks, setBanks] = useState<PlatformPayoutBankDirectory>([]);
  const [bankLookupLoading, setBankLookupLoading] = useState(false);
  const [resolutionLoading, setResolutionLoading] = useState(false);
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>(null);
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [settingDefaultAccountId, setSettingDefaultAccountId] = useState<string | null>(null);

  const agentName =
    [session.user?.firstName, session.user?.lastName].filter(Boolean).join(" ").trim() ||
    session.user?.email ||
    "BookMiz agent";

  const activeCurrencyCode =
    dashboard?.payoutWorkspace.account?.currencyCode ??
    dashboard?.commissions[0]?.currencyCode ??
    "USD";
  const operatingCountryCode = dashboard?.payoutWorkspace.operatingCountryCode ?? "US";
  const payoutAccounts = dashboard?.payoutWorkspace.accounts ?? [];
  const activePayoutAccounts = payoutAccounts.filter((account) => account.status === "ACTIVE");

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
        buildPayoutFormFromDashboard(nextDashboard, current.payoutAccountId || undefined),
      );
    } catch (nextError) {
      setError(getFriendlyApiError(nextError, "We could not load the agent workspace."));
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
          setError(getFriendlyApiError(nextError, "We could not load payout banks."));
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
        buildAccountFormFromAccount(account ?? dashboard?.payoutWorkspace.account ?? null, operatingCountryCode),
      );
      setAccountModalOpen(true);
    },
    [dashboard?.payoutWorkspace.account, operatingCountryCode],
  );

  const openPayoutRequestModal = useCallback(
    (requestedAccountId?: string) => {
      setError(null);
      setSuccess(null);
      setPayoutForm(buildPayoutFormFromDashboard(dashboard, requestedAccountId));
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
    if (accountForm.countryCode !== "NG" || !accountForm.bankCode || !accountForm.accountNumber) {
      setError("Choose a Nigerian bank and enter the account number to verify it.");
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
      setError(getFriendlyApiError(nextError, "We could not verify that payout account."));
    } finally {
      setResolutionLoading(false);
    }
  }, [accountForm.accountNumber, accountForm.bankCode, accountForm.countryCode, banks]);

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
        accountForm.accountId ? "Payout method updated." : "Payout method added successfully.",
      );
    } catch (nextError) {
      setError(getFriendlyApiError(nextError, "We could not save that payout method."));
    } finally {
      setSavingAccount(false);
    }
  }, [accountForm, banks, loadDashboard]);

  const handleSetDefaultAccount = useCallback(async (accountId: string) => {
    try {
      setSettingDefaultAccountId(accountId);
      setError(null);
      setSuccess(null);
      await setDefaultAgentPayoutAccount(accountId);
      await loadDashboard();
      setSuccess("Default payout method updated.");
    } catch (nextError) {
      setError(getFriendlyApiError(nextError, "We could not update the default payout method."));
    } finally {
      setSettingDefaultAccountId(null);
    }
  }, [loadDashboard]);

  const submitPayoutRequest = useCallback(async () => {
    if (!payoutForm.payoutAccountId) {
      setError("Choose an active payout method before requesting payout.");
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
      setError(getFriendlyApiError(nextError, "We could not submit that payout request."));
    } finally {
      setIsSubmittingPayout(false);
    }
  }, [dashboard, loadDashboard, payoutForm]);

  const heroTopContent = (
    <View style={styles.heroTopRow}>
      <View style={styles.heroPill}>
        <FontAwesome6 name="link" size={12} color={tokens.colors.gold} />
        <Text style={styles.heroPillText}>Platform growth desk</Text>
      </View>
      <View style={styles.heroPill}>
        <FontAwesome6 name="location-dot" size={12} color={tokens.colors.brand} />
        <Text style={styles.heroPillText}>
          {getCountryLabel(operatingCountryCode)} / {activeCurrencyCode}
        </Text>
      </View>
    </View>
  );

  const heroContent = (
    <View style={styles.heroContentWrap}>
      <View style={styles.heroSummaryCard}>
        <Text style={styles.heroSummaryLabel}>Active providers</Text>
        <Text style={styles.heroSummaryValue}>
          {isLoading ? "—" : dashboard?.summary.activeProviderCount ?? 0}
        </Text>
      </View>
      <View style={styles.heroSummaryCard}>
        <Text style={styles.heroSummaryLabel}>Available now</Text>
        <Text style={styles.heroSummaryValue}>
          {isLoading
            ? "—"
            : formatMoney(dashboard?.summary.availableCommissionCents ?? 0, activeCurrencyCode)}
        </Text>
      </View>
      <View style={styles.heroSummaryCard}>
        <Text style={styles.heroSummaryLabel}>Minimum payout</Text>
        <Text style={styles.heroSummaryValue}>
          {isLoading
            ? "—"
            : formatMoney(dashboard?.summary.minimumPayoutCents ?? 0, activeCurrencyCode)}
        </Text>
      </View>
    </View>
  );

  return (
    <Screen
      eyebrow="Agent"
      title="Grow providers and keep commission flow clean"
      subtitle={`${agentName} can track attributed providers, monitor revenue readiness, and manage payout setup from one polished mobile desk.`}
      heroTopContent={heroTopContent}
      heroContent={heroContent}
      contentTopOffset={22}
      heroBottomPadding={32}
      heroMinHeight={320}
    >
      {error ? (
        <View style={styles.bannerError}>
          <FontAwesome6 name="triangle-exclamation" size={14} color={tokens.colors.danger} />
          <Text style={styles.bannerErrorText}>{error}</Text>
        </View>
      ) : null}
      {success ? (
        <View style={styles.bannerSuccess}>
          <FontAwesome6 name="circle-check" size={14} color={tokens.colors.success} />
          <Text style={styles.bannerSuccessText}>{success}</Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {agentTabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <Pressable
              key={tab.id}
              style={[styles.tabChip, active ? styles.tabChipActive : null]}
              onPress={() => setActiveTab(tab.id)}
            >
              <FontAwesome6
                name={tab.icon}
                size={12}
                color={active ? "#fff" : tokens.colors.ink}
              />
              <Text style={[styles.tabChipText, active ? styles.tabChipTextActive : null]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.statGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Expiring soon</Text>
          <Text style={styles.statValue}>
            {dashboard?.summary.expiringAttributionCount ?? 0}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={styles.statValue}>
            {formatMoney(commissionTotals.pending, activeCurrencyCode)}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Requested</Text>
          <Text style={styles.statValue}>
            {formatMoney(commissionTotals.requested, activeCurrencyCode)}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Paid out</Text>
          <Text style={styles.statValue}>
            {formatMoney(commissionTotals.paid, activeCurrencyCode)}
          </Text>
        </View>
      </View>

      {activeTab === "overview" ? (
        <>
          <View style={styles.panel}>
            <View style={styles.panelHeaderRow}>
              <View style={styles.panelHeaderCopy}>
                <Text style={styles.panelEyebrow}>Growth book</Text>
                <Text style={styles.panelTitle}>Your attributed providers</Text>
                <Text style={styles.panelSubtitle}>
                  Active providers, expiring windows, and the provider-side markets they sit in.
                </Text>
              </View>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>
                  {(dashboard?.attributions.length ?? 0).toString()} tracked
                </Text>
              </View>
            </View>

            {(dashboard?.attributions.length ?? 0) > 0 ? (
              (dashboard?.attributions.slice(0, 4) ?? []).map((attribution) => (
                <View key={attribution.id} style={styles.featureCard}>
                  <View style={styles.featureHeader}>
                    <View style={styles.featureCopy}>
                      <Text style={styles.featureTitle}>
                        {attribution.provider?.displayName ?? "Provider removed"}
                      </Text>
                      <Text style={styles.featureMeta}>
                        {providerLocationLabel(attribution)} ·{" "}
                        {attribution.provider?.serviceModel ?? "Service lane pending"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        getStatusTone(
                          isAttributionExpiringSoon(attribution)
                            ? "PENDING"
                            : attribution.status,
                        ),
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {isAttributionExpiringSoon(attribution)
                          ? "Expiring soon"
                          : attribution.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.featureMetricGrid}>
                    <View style={styles.featureMetricCard}>
                      <Text style={styles.featureMetricLabel}>Starts</Text>
                      <Text style={styles.featureMetricValue}>{formatDate(attribution.startsAt)}</Text>
                    </View>
                    <View style={styles.featureMetricCard}>
                      <Text style={styles.featureMetricLabel}>Ends</Text>
                      <Text style={styles.featureMetricValue}>
                        {formatDate(attribution.attributionEndsAt)}
                      </Text>
                    </View>
                    <View style={styles.featureMetricCard}>
                      <Text style={styles.featureMetricLabel}>Email</Text>
                      <Text style={styles.featureMetricValue} numberOfLines={1}>
                        {attribution.provider?.businessEmail ?? "Not set"}
                      </Text>
                    </View>
                  </View>

                  {attribution.notes ? (
                    <Text style={styles.featureNote}>{attribution.notes}</Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.emptyState}>
                Once providers are attributed to your growth book, they will show up here.
              </Text>
            )}
          </View>

          <View style={styles.rowPanels}>
            <View style={[styles.panel, styles.halfPanel]}>
              <Text style={styles.panelEyebrow}>Commission balance</Text>
              <Text style={styles.panelTitle}>Where your revenue stands</Text>
              {[
                { label: "Pending", value: commissionTotals.pending },
                { label: "Available", value: commissionTotals.available },
                { label: "Requested", value: commissionTotals.requested },
                { label: "Paid", value: commissionTotals.paid },
              ].map((item) => (
                <View key={item.label} style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>{item.label}</Text>
                  <Text style={styles.balanceValue}>
                    {formatMoney(item.value, activeCurrencyCode)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.panel, styles.halfPanel]}>
              <Text style={styles.panelEyebrow}>Payout readiness</Text>
              <Text style={styles.panelTitle}>Finance settles against your default method</Text>
              <Text style={styles.panelSubtitle}>
                Keep one active payout account on file so settled commissions can move quickly.
              </Text>

              <View style={styles.defaultMethodCard}>
                <Text style={styles.defaultMethodTitle}>
                  {dashboard?.payoutWorkspace.account
                    ? `${getProcessorLabel(dashboard.payoutWorkspace.account.processor)} default`
                    : "No default payout method"}
                </Text>
                <Text style={styles.defaultMethodBody}>
                  {dashboard?.payoutWorkspace.account
                    ? `${dashboard.payoutWorkspace.account.bankName} • ••••${dashboard.payoutWorkspace.account.accountNumberLast4 ?? "—"}`
                    : "Add a payout method before requesting withdrawal."}
                </Text>
                <View style={styles.inlineActions}>
                  <Pressable style={styles.secondaryButton} onPress={() => openAddAccountModal()}>
                    <FontAwesome6 name="landmark" size={14} color={tokens.colors.ink} />
                    <Text style={styles.secondaryButtonText}>
                      {payoutAccounts.length > 0 ? "Manage methods" : "Add payout method"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.primaryButton,
                      activePayoutAccounts.length === 0 ? styles.buttonDisabled : null,
                    ]}
                    onPress={() => openPayoutRequestModal()}
                    disabled={activePayoutAccounts.length === 0}
                  >
                    <FontAwesome6 name="receipt" size={14} color={tokens.colors.inkDeep} />
                    <Text style={styles.primaryButtonText}>Request payout</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </>
      ) : null}

      {activeTab === "operations" ? <AgentOperationsPanel /> : null}

      {activeTab === "providers" ? (
        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <View style={styles.panelHeaderCopy}>
              <Text style={styles.panelEyebrow}>Attributed providers</Text>
              <Text style={styles.panelTitle}>Provider portfolio under your acquisition window</Text>
              <Text style={styles.panelSubtitle}>
                Each card shows the service lane, country, and attribution timing currently tied to you.
              </Text>
            </View>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>
                {countStatus(dashboard?.attributions ?? [], "ACTIVE")} active
              </Text>
            </View>
          </View>

          {(dashboard?.attributions.length ?? 0) > 0 ? (
            (dashboard?.attributions ?? []).map((attribution) => (
              <View key={attribution.id} style={styles.featureCard}>
                <View style={styles.featureHeader}>
                  <View style={styles.featureCopy}>
                    <Text style={styles.featureTitle}>
                      {attribution.provider?.displayName ?? "Provider removed"}
                    </Text>
                    <Text style={styles.featureMeta}>
                      {attribution.provider?.businessEmail ?? "No business email"}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, getStatusTone(attribution.status)]}>
                    <Text style={styles.statusText}>{attribution.status}</Text>
                  </View>
                </View>

                <View style={styles.featureMetricGrid}>
                  <View style={styles.featureMetricCard}>
                    <Text style={styles.featureMetricLabel}>Service lane</Text>
                    <Text style={styles.featureMetricValue}>
                      {attribution.provider?.serviceModel ?? "—"}
                    </Text>
                  </View>
                  <View style={styles.featureMetricCard}>
                    <Text style={styles.featureMetricLabel}>Country</Text>
                    <Text style={styles.featureMetricValue}>
                      {attribution.provider?.primaryLocation?.countryCode ?? "—"}
                    </Text>
                  </View>
                  <View style={styles.featureMetricCard}>
                    <Text style={styles.featureMetricLabel}>Ends</Text>
                    <Text style={styles.featureMetricValue}>
                      {formatDate(attribution.attributionEndsAt)}
                    </Text>
                  </View>
                </View>

                {attribution.notes ? (
                  <Text style={styles.featureNote}>{attribution.notes}</Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyState}>No attributed providers yet.</Text>
          )}
        </View>
      ) : null}

      {activeTab === "commissions" ? (
        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <View style={styles.panelHeaderCopy}>
              <Text style={styles.panelEyebrow}>Commission ledger</Text>
              <Text style={styles.panelTitle}>Every monetization event tied to your book</Text>
              <Text style={styles.panelSubtitle}>
                Subscription revenue, lead unlocks, reversals, and what is already ready for payout.
              </Text>
            </View>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>
                {(dashboard?.commissions.length ?? 0).toString()} rows
              </Text>
            </View>
          </View>

          {(dashboard?.commissions.length ?? 0) > 0 ? (
            (dashboard?.commissions ?? []).map((commission) => (
              <View key={commission.id} style={styles.featureCard}>
                <View style={styles.featureHeader}>
                  <View style={styles.featureCopy}>
                    <Text style={styles.featureTitle}>
                      {commission.provider?.displayName ?? "Provider removed"}
                    </Text>
                    <Text style={styles.featureMeta}>
                      {commissionSourceLabel(commission.sourceType)} · available {formatDate(commission.availableAt)}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, getStatusTone(commission.status)]}>
                    <Text style={styles.statusText}>{commission.status}</Text>
                  </View>
                </View>

                <View style={styles.metricRows}>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Gross amount</Text>
                    <Text style={styles.metricValue}>
                      {formatMoney(commission.grossAmountCents, commission.currencyCode)}
                    </Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Your commission</Text>
                    <Text style={styles.metricValue}>
                      {formatMoney(commission.commissionAmountCents, commission.currencyCode)}
                    </Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Commission rate</Text>
                    <Text style={styles.metricValue}>{commission.commissionPercent}%</Text>
                  </View>
                </View>

                {commission.note ? <Text style={styles.featureNote}>{commission.note}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyState}>No commissions yet.</Text>
          )}
        </View>
      ) : null}

      {activeTab === "payouts" ? (
        <>
          <View style={styles.panel}>
            <View style={styles.panelHeaderRow}>
              <View style={styles.panelHeaderCopy}>
                <Text style={styles.panelEyebrow}>Payout workspace</Text>
                <Text style={styles.panelTitle}>Method, requests, and payout readiness</Text>
                <Text style={styles.panelSubtitle}>
                  Default account, supported rails, and finance request history in one mobile surface.
                </Text>
              </View>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>
                  {activePayoutAccounts.length} active methods
                </Text>
              </View>
            </View>

            <View style={styles.defaultMethodCard}>
              <Text style={styles.defaultMethodTitle}>
                {dashboard?.payoutWorkspace.account
                  ? `${getProcessorLabel(dashboard.payoutWorkspace.account.processor)} default`
                  : "No default payout method"}
              </Text>
              <Text style={styles.defaultMethodBody}>
                {dashboard?.payoutWorkspace.account
                  ? `${dashboard.payoutWorkspace.account.bankName} • ••••${dashboard.payoutWorkspace.account.accountNumberLast4 ?? "—"}`
                  : "Add an active payout method before requesting withdrawal."}
              </Text>
              <View style={styles.metricRows}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Available entries</Text>
                  <Text style={styles.metricValue}>{availableCommissionCount}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Minimum payout</Text>
                  <Text style={styles.metricValue}>
                    {formatMoney(dashboard?.summary.minimumPayoutCents ?? 0, activeCurrencyCode)}
                  </Text>
                </View>
              </View>
              <View style={styles.inlineActions}>
                <Pressable style={styles.secondaryButton} onPress={() => openAddAccountModal()}>
                  <FontAwesome6 name="building-columns" size={14} color={tokens.colors.ink} />
                  <Text style={styles.secondaryButtonText}>
                    {payoutAccounts.length > 0 ? "Manage payout method" : "Add payout method"}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.primaryButton,
                    activePayoutAccounts.length === 0 ? styles.buttonDisabled : null,
                  ]}
                  onPress={() => openPayoutRequestModal()}
                  disabled={activePayoutAccounts.length === 0}
                >
                  <FontAwesome6 name="money-check-dollar" size={14} color={tokens.colors.inkDeep} />
                  <Text style={styles.primaryButtonText}>Request payout</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Saved payout methods</Text>
            {(dashboard?.payoutWorkspace.accounts.length ?? 0) > 0 ? (
              (dashboard?.payoutWorkspace.accounts ?? []).map((account) => (
                <View key={account.id} style={styles.featureCard}>
                  <View style={styles.featureHeader}>
                    <View style={styles.featureCopy}>
                      <Text style={styles.featureTitle}>
                        {account.destinationLabel || account.bankName}
                      </Text>
                      <Text style={styles.featureMeta}>
                        {getCountryLabel(account.countryCode)} · {account.bankName} · ••••
                        {account.accountNumberLast4 ?? "—"}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, getStatusTone(account.status)]}>
                      <Text style={styles.statusText}>
                        {account.isDefault ? "DEFAULT" : account.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.inlineActions}>
                    <Pressable style={styles.secondaryButton} onPress={() => openAddAccountModal(account)}>
                      <FontAwesome6 name="pen-to-square" size={14} color={tokens.colors.ink} />
                      <Text style={styles.secondaryButtonText}>Edit</Text>
                    </Pressable>
                    {!account.isDefault ? (
                      <Pressable
                        style={styles.secondaryButton}
                        onPress={() => void handleSetDefaultAccount(account.id)}
                        disabled={settingDefaultAccountId === account.id}
                      >
                        <FontAwesome6 name="star" size={14} color={tokens.colors.ink} />
                        <Text style={styles.secondaryButtonText}>
                          {settingDefaultAccountId === account.id ? "Saving..." : "Make default"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyState}>No payout methods on file yet.</Text>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Payout requests</Text>
            {(dashboard?.payoutWorkspace.requests.length ?? 0) > 0 ? (
              (dashboard?.payoutWorkspace.requests ?? []).map((request) => (
                <View key={request.id} style={styles.featureCard}>
                  <View style={styles.featureHeader}>
                    <View style={styles.featureCopy}>
                      <Text style={styles.featureTitle}>
                        {formatMoney(request.amountCents, request.currencyCode)}
                      </Text>
                      <Text style={styles.featureMeta}>
                        Requested {formatDate(request.requestedAt)}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, getStatusTone(request.status)]}>
                      <Text style={styles.statusText}>{request.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.featureNote}>
                    {request.destinationSummary || "Destination summary pending"}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyState}>No payout requests submitted yet.</Text>
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
          <Pressable style={styles.modalBackdrop} onPress={() => setAccountModalOpen(false)} />
          <View style={styles.modalSheetWrap}>
            <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {accountForm.accountId ? "Edit payout method" : "Add payout method"}
                </Text>
                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setAccountModalOpen(false)}
                >
                  <FontAwesome6 name="xmark" size={18} color={tokens.colors.ink} />
                </Pressable>
              </View>
              <Text style={styles.modalSubtitle}>
                Save the destination finance should use for future commission withdrawals.
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalContent}
              >
                <View style={styles.countryRow}>
                  {(["US", "NG"] as const).map((countryCode) => {
                    const active = accountForm.countryCode === countryCode;
                    return (
                      <Pressable
                        key={countryCode}
                        style={[styles.countryChip, active ? styles.countryChipActive : null]}
                        onPress={() => handleAccountCountryChange(countryCode)}
                      >
                        <Text
                          style={[
                            styles.countryChipText,
                            active ? styles.countryChipTextActive : null,
                          ]}
                        >
                          {getCountryLabel(countryCode)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Destination label</Text>
                  <TextInput
                    value={accountForm.destinationLabel}
                    onChangeText={(value) =>
                      setAccountForm((current) => ({ ...current, destinationLabel: value }))
                    }
                    style={styles.input}
                    placeholder="Primary commission payout"
                    placeholderTextColor={tokens.colors.mutedSoft}
                  />
                </View>

                {accountForm.countryCode === "NG" ? (
                  <>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Bank</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.bankRow}
                      >
                        {bankLookupLoading ? (
                          <Text style={styles.helperText}>Loading banks...</Text>
                        ) : (
                          banks.map((bank) => {
                            const active = accountForm.bankCode === bank.code;
                            return (
                              <Pressable
                                key={bank.code}
                                style={[styles.bankChip, active ? styles.bankChipActive : null]}
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
                                    styles.bankChipText,
                                    active ? styles.bankChipTextActive : null,
                                  ]}
                                >
                                  {bank.name}
                                </Text>
                              </Pressable>
                            );
                          })
                        )}
                      </ScrollView>
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Account number</Text>
                      <TextInput
                        value={accountForm.accountNumber}
                        onChangeText={(value) =>
                          setAccountForm((current) => ({ ...current, accountNumber: value }))
                        }
                        style={styles.input}
                        keyboardType="number-pad"
                        placeholder="0123456789"
                        placeholderTextColor={tokens.colors.mutedSoft}
                      />
                    </View>

                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => void handleResolveAccount()}
                      disabled={resolutionLoading}
                    >
                      <FontAwesome6 name="circle-check" size={14} color={tokens.colors.ink} />
                      <Text style={styles.secondaryButtonText}>
                        {resolutionLoading ? "Verifying..." : "Verify account"}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Account holder</Text>
                      <TextInput
                        value={accountForm.accountHolderName}
                        onChangeText={(value) =>
                          setAccountForm((current) => ({ ...current, accountHolderName: value }))
                        }
                        style={styles.input}
                        placeholder="BookMiz Agent"
                        placeholderTextColor={tokens.colors.mutedSoft}
                      />
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Bank name</Text>
                      <TextInput
                        value={accountForm.bankName}
                        onChangeText={(value) =>
                          setAccountForm((current) => ({ ...current, bankName: value }))
                        }
                        style={styles.input}
                        placeholder="Chase"
                        placeholderTextColor={tokens.colors.mutedSoft}
                      />
                    </View>

                    <View style={styles.twoUpRow}>
                      <View style={[styles.fieldGroup, styles.flexField]}>
                        <Text style={styles.fieldLabel}>Routing number</Text>
                        <TextInput
                          value={accountForm.routingNumber}
                          onChangeText={(value) =>
                            setAccountForm((current) => ({ ...current, routingNumber: value }))
                          }
                          style={styles.input}
                          keyboardType="number-pad"
                          placeholder="021000021"
                          placeholderTextColor={tokens.colors.mutedSoft}
                        />
                      </View>
                      <View style={[styles.fieldGroup, styles.flexField]}>
                        <Text style={styles.fieldLabel}>Account number</Text>
                        <TextInput
                          value={accountForm.accountNumber}
                          onChangeText={(value) =>
                            setAccountForm((current) => ({ ...current, accountNumber: value }))
                          }
                          style={styles.input}
                          keyboardType="number-pad"
                          placeholder="000123456789"
                          placeholderTextColor={tokens.colors.mutedSoft}
                        />
                      </View>
                    </View>
                  </>
                )}

                {resolvedAccountName ? (
                  <View style={styles.resolutionCard}>
                    <FontAwesome6 name="badge-check" size={14} color={tokens.colors.success} />
                    <Text style={styles.resolutionText}>{resolvedAccountName}</Text>
                  </View>
                ) : null}

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Finance notes</Text>
                  <TextInput
                    value={accountForm.payoutNotes}
                    onChangeText={(value) =>
                      setAccountForm((current) => ({ ...current, payoutNotes: value }))
                    }
                    style={styles.textArea}
                    placeholder="Optional operating note for this payout destination"
                    placeholderTextColor={tokens.colors.mutedSoft}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <Pressable
                  style={styles.toggleRow}
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
                      accountForm.setAsDefault ? styles.toggleIndicatorActive : null,
                    ]}
                  >
                    {accountForm.setAsDefault ? (
                      <FontAwesome6 name="check" size={10} color={tokens.colors.inkDeep} />
                    ) : null}
                  </View>
                  <View style={styles.toggleCopy}>
                    <Text style={styles.toggleTitle}>Set as default payout method</Text>
                    <Text style={styles.toggleBody}>
                      Future payout requests will use this destination first.
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.primaryButton}
                  onPress={() => void handleSubmitAccount()}
                  disabled={savingAccount}
                >
                  <FontAwesome6 name="floppy-disk" size={14} color={tokens.colors.inkDeep} />
                  <Text style={styles.primaryButtonText}>
                    {savingAccount ? "Saving..." : "Save payout method"}
                  </Text>
                </Pressable>
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
          <Pressable style={styles.modalBackdrop} onPress={() => setPayoutModalOpen(false)} />
          <View style={styles.modalSheetWrap}>
            <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Request payout</Text>
                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setPayoutModalOpen(false)}
                >
                  <FontAwesome6 name="xmark" size={18} color={tokens.colors.ink} />
                </Pressable>
              </View>
              <Text style={styles.modalSubtitle}>
                Submit the full settled available balance to finance using one of your active payout methods.
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalContent}
              >
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Destination</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.bankRow}
                  >
                    {activePayoutAccounts.map((account) => {
                      const active = payoutForm.payoutAccountId === account.id;
                      return (
                        <Pressable
                          key={account.id}
                          style={[styles.bankChip, active ? styles.bankChipActive : null]}
                          onPress={() =>
                            setPayoutForm((current) => ({
                              ...current,
                              payoutAccountId: account.id,
                            }))
                          }
                        >
                          <Text
                            style={[
                              styles.bankChipText,
                              active ? styles.bankChipTextActive : null,
                            ]}
                          >
                            {account.destinationLabel || account.bankName}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={styles.metricRows}>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Available now</Text>
                    <Text style={styles.metricValue}>
                      {formatMoney(dashboard?.summary.availableCommissionCents ?? 0, activeCurrencyCode)}
                    </Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Minimum payout</Text>
                    <Text style={styles.metricValue}>
                      {formatMoney(dashboard?.summary.minimumPayoutCents ?? 0, activeCurrencyCode)}
                    </Text>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Note for finance</Text>
                  <TextInput
                    value={payoutForm.agentNote}
                    onChangeText={(value) =>
                      setPayoutForm((current) => ({ ...current, agentNote: value }))
                    }
                    style={styles.textArea}
                    placeholder="Optional note for payout review"
                    placeholderTextColor={tokens.colors.mutedSoft}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <Pressable
                  style={styles.primaryButton}
                  onPress={() => void submitPayoutRequest()}
                  disabled={isSubmittingPayout}
                >
                  <FontAwesome6 name="receipt" size={14} color={tokens.colors.inkDeep} />
                  <Text style={styles.primaryButtonText}>
                    {isSubmittingPayout ? "Submitting..." : "Submit payout request"}
                  </Text>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bannerError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#f5c7c4",
    backgroundColor: "#fff2f0",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerErrorText: {
    flex: 1,
    color: tokens.colors.danger,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  bannerSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#cce7d7",
    backgroundColor: "#edf8f1",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerSuccessText: {
    flex: 1,
    color: tokens.colors.success,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  heroTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroPillText: {
    color: "#eff5ff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  heroContentWrap: {
    flexDirection: "row",
    gap: 10,
  },
  heroSummaryCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 8,
  },
  heroSummaryLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroSummaryValue: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  tabRow: {
    gap: 10,
    paddingRight: 18,
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  tabChipActive: {
    backgroundColor: tokens.colors.ink,
    borderColor: tokens.colors.ink,
  },
  tabChipText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  tabChipTextActive: {
    color: "#fff",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "47%",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 8,
  },
  statLabel: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statValue: {
    color: tokens.colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  rowPanels: {
    gap: 20,
  },
  halfPanel: {
    flex: 1,
  },
  panel: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    padding: 20,
    gap: 16,
  },
  panelHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  panelHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  panelEyebrow: {
    color: tokens.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  panelTitle: {
    color: tokens.colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  panelSubtitle: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 21,
  },
  countPill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#edf2fa",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  countPillText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  featureCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fbfdff",
    padding: 16,
    gap: 14,
  },
  featureHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  featureCopy: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
  },
  featureMeta: {
    color: tokens.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  featureMetricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  featureMetricCard: {
    minWidth: "31%",
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    padding: 12,
    gap: 6,
  },
  featureMetricLabel: {
    color: tokens.colors.mutedSoft,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  featureMetricValue: {
    color: tokens.colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  featureNote: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  statusPill: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusSuccess: {
    borderColor: "#cce7d7",
    backgroundColor: "#edf8f1",
  },
  statusPending: {
    borderColor: "#f3ddb6",
    backgroundColor: "#fff5e8",
  },
  statusDanger: {
    borderColor: "#f5c7c4",
    backgroundColor: "#fff2f0",
  },
  statusNeutral: {
    borderColor: tokens.colors.border,
    backgroundColor: "#f4f6fb",
  },
  statusText: {
    color: tokens.colors.ink,
    fontSize: 11,
    fontWeight: "800",
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fbfdff",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  balanceLabel: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  balanceValue: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  defaultMethodCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fbfdff",
    padding: 16,
    gap: 14,
  },
  defaultMethodTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  defaultMethodBody: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  metricRows: {
    gap: 10,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricLabel: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  metricValue: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: tokens.colors.inkDeep,
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  emptyState: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(9, 18, 33, 0.42)",
  },
  modalSheetWrap: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  modalSheet: {
    maxHeight: "90%",
    borderRadius: 30,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
  },
  modalHandle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#d5deec",
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
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: -0.9,
  },
  modalCloseButton: {
    width: 42,
    height: 42,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubtitle: {
    marginTop: 10,
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  modalContent: {
    paddingTop: 18,
    paddingBottom: 24,
    gap: 16,
  },
  countryRow: {
    flexDirection: "row",
    gap: 10,
  },
  countryChip: {
    flex: 1,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  countryChipActive: {
    backgroundColor: tokens.colors.ink,
    borderColor: tokens.colors.ink,
  },
  countryChipText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  countryChipTextActive: {
    color: "#fff",
  },
  fieldGroup: {
    gap: 8,
  },
  twoUpRow: {
    flexDirection: "row",
    gap: 12,
  },
  flexField: {
    flex: 1,
  },
  fieldLabel: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fbfdff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "600",
  },
  textArea: {
    minHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fbfdff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "600",
  },
  bankRow: {
    gap: 10,
    paddingRight: 18,
  },
  bankChip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bankChipActive: {
    backgroundColor: tokens.colors.ink,
    borderColor: tokens.colors.ink,
  },
  bankChipText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  bankChipTextActive: {
    color: "#fff",
  },
  helperText: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  resolutionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cce7d7",
    backgroundColor: "#edf8f1",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resolutionText: {
    color: tokens.colors.success,
    fontSize: 13,
    fontWeight: "800",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fbfdff",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  toggleIndicator: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  toggleIndicatorActive: {
    borderColor: tokens.colors.brand,
    backgroundColor: tokens.colors.brand,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  toggleBody: {
    color: tokens.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});

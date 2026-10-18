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

import { AuthButton } from "@/src/components/auth/AuthButton";
import {
  getAgentOperationsRequestDetail,
  getAgentOperationsRequests,
} from "@/src/lib/api/agent";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import type {
  AgentOperationsQueueResponse,
  AgentOperationsRequestDetail,
} from "@/src/lib/api/types";
import { tokens } from "@/src/theme/tokens";

const statusFilters = [
  { id: "ALL", label: "All" },
  { id: "OPEN", label: "Open" },
  { id: "MATCHED", label: "Matched" },
  { id: "ACCEPTED", label: "Accepted" },
] as const;

const serviceModelFilters = [
  { id: "ALL", label: "All lanes" },
  { id: "LOCAL", label: "Local" },
  { id: "PROFESSIONAL", label: "Professional" },
] as const;

type StatusFilterId = (typeof statusFilters)[number]["id"];
type ServiceModelFilterId = (typeof serviceModelFilters)[number]["id"];

function formatMoney(value?: number | null, currencyCode = "USD") {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
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

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLocation(
  city?: string | null,
  stateCode?: string | null,
  countryCode?: string | null,
) {
  return [city, stateCode, countryCode].filter(Boolean).join(", ");
}

function statusTone(status: string) {
  switch (status) {
    case "ACCEPTED":
    case "PAID":
    case "AVAILABLE":
      return styles.statusSuccess;
    case "MATCHED":
    case "OPEN":
    case "REQUESTED":
      return styles.statusPending;
    case "CANCELLED":
    case "EXPIRED":
    case "DECLINED":
      return styles.statusDanger;
    default:
      return styles.statusNeutral;
  }
}

function statusTextTone(status: string) {
  switch (status) {
    case "ACCEPTED":
    case "PAID":
    case "AVAILABLE":
      return styles.statusTextSuccess;
    case "MATCHED":
      return styles.statusTextMatched;
    case "OPEN":
    case "REQUESTED":
      return styles.statusTextPending;
    case "CANCELLED":
    case "EXPIRED":
    case "DECLINED":
      return styles.statusTextDanger;
    default:
      return null;
  }
}

function formatStatusLabel(status: string) {
  const lower = status.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function StatusPill({ status }: { status: string }) {
  const matched = status === "MATCHED";
  return (
    <View
      style={[
        styles.statusPill,
        matched ? styles.statusMatched : statusTone(status),
      ]}
    >
      <Text style={[styles.statusText, statusTextTone(status)]}>
        {formatStatusLabel(status)}
      </Text>
    </View>
  );
}

function SkeletonCards({ count = 3 }: { count?: number }) {
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

  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <Animated.View key={index} style={[styles.requestCard, { opacity }]}>
          <View style={[styles.skeletonBlock, styles.skeletonTitle]} />
          <View style={[styles.skeletonBlock, styles.skeletonLine]} />
          <View style={[styles.skeletonBlock, styles.skeletonLineShort]} />
        </Animated.View>
      ))}
    </View>
  );
}

export function AgentOperationsPanel() {
  const [queue, setQueue] = useState<AgentOperationsQueueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterId>("ALL");
  const [serviceModelFilter, setServiceModelFilter] =
    useState<ServiceModelFilterId>("ALL");
  const [searchDraft, setSearchDraft] = useState("");
  const [stateDraft, setStateDraft] = useState("");
  const [countryDraft, setCountryDraft] = useState("US");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [submittedState, setSubmittedState] = useState("");
  const [submittedCountry, setSubmittedCountry] = useState("US");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [detail, setDetail] = useState<AgentOperationsRequestDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);

  const [page, setPage] = useState(1);
  const queueGeneration = useRef(0);
  const detailGeneration = useRef(0);
  useEffect(() => {
    setPage(1);
  }, [
    serviceModelFilter,
    statusFilter,
    submittedCountry,
    submittedSearch,
    submittedState,
  ]);
  const loadQueue = useCallback(async () => {
    const generation = ++queueGeneration.current;
    try {
      setIsLoading(true);
      setError(null);

      const nextQueue = await getAgentOperationsRequests({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        serviceModel:
          serviceModelFilter === "ALL" ? undefined : serviceModelFilter,
        search: submittedSearch || undefined,
        stateCode: submittedState || undefined,
        countryCode: submittedCountry || undefined,
        page,
        pageSize: 20,
      });

      if (generation === queueGeneration.current) setQueue(nextQueue);
    } catch (nextError) {
      if (generation === queueGeneration.current)
        setError(
          getFriendlyApiError(
            nextError,
            "We could not load the operations queue.",
          ),
        );
    } finally {
      if (generation === queueGeneration.current) setIsLoading(false);
    }
  }, [
    page,
    serviceModelFilter,
    statusFilter,
    submittedCountry,
    submittedSearch,
    submittedState,
  ]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const openDetail = useCallback(async (quoteRequestId: string) => {
    const generation = ++detailGeneration.current;
    try {
      setSelectedRequestId(quoteRequestId);
      setDetailOpen(true);
      setDetailLoading(true);
      setDetail(null);
      const nextDetail = await getAgentOperationsRequestDetail(quoteRequestId);
      if (generation === detailGeneration.current) setDetail(nextDetail);
    } catch (nextError) {
      if (generation === detailGeneration.current) {
        setError(
          getFriendlyApiError(
            nextError,
            "We could not load that request detail.",
          ),
        );
        setDetailOpen(false);
      }
    } finally {
      if (generation === detailGeneration.current) setDetailLoading(false);
    }
  }, []);

  const locationSummary = useMemo(
    () => [submittedState, submittedCountry].filter(Boolean).join(" · "),
    [submittedCountry, submittedState],
  );

  return (
    <>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
          <Pressable
            onPress={() => void loadQueue()}
            accessibilityRole="button"
          >
            <Text style={styles.errorRetry}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.summaryGrid}>
          {[
            { label: "Open", value: queue?.summary.openCount ?? 0 },
            { label: "Matched", value: queue?.summary.matchedCount ?? 0 },
            { label: "Accepted", value: queue?.summary.acceptedCount ?? 0 },
            {
              label: "Closed",
              value:
                (queue?.summary.cancelledCount ?? 0) +
                (queue?.summary.expiredCount ?? 0),
            },
          ].map((item) => (
            <View key={item.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.searchCard}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Search</Text>
            <View style={styles.inputShell}>
              <FontAwesome6
                name="magnifying-glass"
                size={16}
                color={tokens.colors.muted}
              />
              <TextInput
                value={searchDraft}
                onChangeText={setSearchDraft}
                style={styles.input}
                placeholder="Service, requester, city"
                placeholderTextColor={tokens.colors.muted}
                accessibilityLabel="Search requests"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>State</Text>
            <View style={styles.inputShell}>
              <TextInput
                value={stateDraft}
                onChangeText={setStateDraft}
                style={styles.input}
                autoCapitalize="characters"
                placeholder="Any"
                placeholderTextColor={tokens.colors.muted}
                accessibilityLabel="State code"
              />
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Country</Text>
            <View style={styles.inputShell}>
              <TextInput
                value={countryDraft}
                onChangeText={setCountryDraft}
                style={styles.input}
                autoCapitalize="characters"
                placeholder="US"
                placeholderTextColor={tokens.colors.muted}
                accessibilityLabel="Country code"
              />
            </View>
          </View>

          <View style={styles.searchActions}>
            <AuthButton
              label="Apply"
              variant="navy"
              style={styles.applyButton}
              onPress={() => {
                setSubmittedSearch(searchDraft.trim());
                setSubmittedState(stateDraft.trim().toUpperCase());
                setSubmittedCountry(countryDraft.trim().toUpperCase() || "US");
              }}
            />
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setSearchDraft("");
                setStateDraft("");
                setCountryDraft("US");
                setSubmittedSearch("");
                setSubmittedState("");
                setSubmittedCountry("US");
              }}
            >
              <Text style={styles.linkText}>Reset</Text>
            </Pressable>
          </View>
          <Text style={styles.metaText}>
            Scope: {locationSummary || "All markets"}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.railScroll}
          contentContainerStyle={styles.filterRow}
        >
          {statusFilters.map((filter) => {
            const active = filter.id === statusFilter;
            return (
              <Pressable
                key={filter.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.filterChip,
                  active ? styles.filterChipActive : null,
                ]}
                onPress={() => setStatusFilter(filter.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active ? styles.filterChipTextActive : null,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
          <View style={styles.chipDivider} />
          {serviceModelFilters.map((filter) => {
            const active = filter.id === serviceModelFilter;
            return (
              <Pressable
                key={filter.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.filterChip,
                  active ? styles.filterChipActive : null,
                ]}
                onPress={() => setServiceModelFilter(filter.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active ? styles.filterChipTextActive : null,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Requests</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>
              {queue?.pagination.total ?? 0} of {queue?.summary.total ?? 0}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <SkeletonCards />
        ) : queue?.items.length ? (
          <View style={styles.list}>
            {queue.items.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.requestCard,
                  pressed ? styles.cardPressed : null,
                ]}
                onPress={() => void openDetail(item.id)}
              >
                <View style={styles.requestHeader}>
                  <View style={styles.requestHeaderCopy}>
                    <Text style={styles.requestTitle} numberOfLines={1}>
                      {item.requestedServiceName}
                    </Text>
                    <Text style={styles.requestMeta} numberOfLines={1}>
                      {item.requestedCategoryName || "General request"} ·{" "}
                      {item.requesterName}
                    </Text>
                  </View>
                  <StatusPill status={item.status} />
                </View>

                <Text style={styles.requestMeta} numberOfLines={1}>
                  {formatLocation(item.city, item.stateCode, item.countryCode)}{" "}
                  · {item.matchCount}{" "}
                  {item.matchCount === 1 ? "match" : "matches"} ·{" "}
                  {item.conversationCount}{" "}
                  {item.conversationCount === 1 ? "chat" : "chats"}
                </Text>

                <View style={styles.inlineMeta}>
                  <Text style={styles.metaText}>
                    {item.budgetMinCents || item.budgetMaxCents
                      ? `${formatMoney(item.budgetMinCents, item.currencyCode)} - ${formatMoney(item.budgetMaxCents, item.currencyCode)}`
                      : "Budget flexible"}
                  </Text>
                  <Text style={styles.metaTextRight}>
                    Updated {formatDate(item.updatedAt)}
                  </Text>
                  <FontAwesome6
                    name="chevron-right"
                    size={14}
                    color={tokens.colors.mutedSoft}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No requests match</Text>
            <Text style={styles.emptyBody}>
              Widen the lane or location filters to see more.
            </Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 16, paddingVertical: 12 }}>
        <AuthButton
          label="Previous"
          variant="secondary"
          disabled={page <= 1 || isLoading}
          onPress={() => setPage((current) => current - 1)}
        />
        <Text>
          Page {page} of {queue?.pagination.totalPages || 1}
        </Text>
        <AuthButton
          label="Next"
          variant="secondary"
          disabled={isLoading || page >= (queue?.pagination.totalPages || 1)}
          onPress={() => setPage((current) => current + 1)}
        />
      </View>
      <Modal
        visible={detailOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => setDetailOpen(false)}
          />
          <View style={styles.modalSheetWrap}>
            <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
              <View style={styles.modalHandle} />
              <View style={styles.headerRow}>
                <View style={styles.headerCopy}>
                  <Text style={styles.modalTitle}>Request detail</Text>
                  <Text style={styles.subtitle}>
                    Read-only view of matches and chats.
                  </Text>
                </View>
                <Pressable
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setDetailOpen(false)}
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
              >
                {detailLoading ? (
                  <SkeletonCards count={2} />
                ) : detail ? (
                  <>
                    <View style={styles.sectionCard}>
                      <Text style={styles.detailTitle}>
                        {detail.requestedServiceName}
                      </Text>
                      <Text style={styles.sectionLine}>
                        {detail.description}
                      </Text>
                      <Text style={styles.requestMeta}>
                        {formatLocation(
                          detail.city,
                          detail.stateCode,
                          detail.countryCode,
                        )}{" "}
                        ·{" "}
                        {detail.serviceModel === "PROFESSIONAL"
                          ? "Professional"
                          : "Local"}
                      </Text>
                    </View>

                    <View style={styles.metricGrid}>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Matches</Text>
                        <Text style={styles.metricValue}>
                          {detail.matchCount}
                        </Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Unlocked</Text>
                        <Text style={styles.metricValue}>
                          {detail.unlockedMatchCount}
                        </Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Chats</Text>
                        <Text style={styles.metricValue}>
                          {detail.conversationCount}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionTitle}>Scope</Text>
                      <Text style={styles.sectionLine}>
                        Date: {formatDate(detail.desiredDate)}
                      </Text>
                      <Text style={styles.sectionLine}>
                        Time window: {detail.desiredWindowStart || "Any"} -{" "}
                        {detail.desiredWindowEnd || "Any"}
                      </Text>
                      <Text style={styles.sectionLine}>
                        Budget:{" "}
                        {detail.budgetMinCents || detail.budgetMaxCents
                          ? `${formatMoney(detail.budgetMinCents, detail.currencyCode)} - ${formatMoney(detail.budgetMaxCents, detail.currencyCode)}`
                          : "Flexible"}
                      </Text>
                      <Text style={styles.sectionLine}>
                        Channels:{" "}
                        {detail.requestedChannels.length
                          ? detail.requestedChannels.join(", ")
                          : "Not set"}
                      </Text>
                      <Text style={styles.sectionLine}>
                        Documents:{" "}
                        {detail.requestedDocumentLabels.length
                          ? detail.requestedDocumentLabels.join(", ")
                          : "None"}
                      </Text>
                    </View>

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionTitle}>Provider matches</Text>
                      {detail.matches.length ? (
                        detail.matches.map((match) => (
                          <View key={match.id} style={styles.subCard}>
                            <View style={styles.requestHeader}>
                              <View style={styles.requestHeaderCopy}>
                                <Text
                                  style={styles.requestTitle}
                                  numberOfLines={1}
                                >
                                  {match.provider?.displayName || "Provider"}
                                </Text>
                                <Text
                                  style={styles.requestMeta}
                                  numberOfLines={1}
                                >
                                  {match.provider?.primaryLocation
                                    ? formatLocation(
                                        match.provider.primaryLocation.city,
                                        match.provider.primaryLocation
                                          .stateCode,
                                        match.provider.primaryLocation
                                          .countryCode,
                                      )
                                    : "Location pending"}
                                </Text>
                              </View>
                              <StatusPill status={match.status} />
                            </View>

                            <View style={styles.metricGrid}>
                              <View style={styles.metricCardWhite}>
                                <Text style={styles.metricLabel}>Score</Text>
                                <Text style={styles.metricValue}>
                                  {match.score.toFixed(2)}
                                </Text>
                              </View>
                              <View style={styles.metricCardWhite}>
                                <Text style={styles.metricLabel}>Unlock</Text>
                                <Text style={styles.metricValue}>
                                  {formatMoney(match.unlockPriceCents)}
                                </Text>
                              </View>
                              <View style={styles.metricCardWhite}>
                                <Text style={styles.metricLabel}>Distance</Text>
                                <Text style={styles.metricValue}>
                                  {match.distanceMiles
                                    ? `${match.distanceMiles.toFixed(1)} mi`
                                    : "—"}
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.sectionLine}>
                              Chat:{" "}
                              {match.conversation
                                ? `${match.conversation.messageCount} messages`
                                : "Not unlocked yet"}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyBody}>
                          No provider matches yet.
                        </Text>
                      )}
                    </View>

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionTitle}>Conversations</Text>
                      {detail.conversations.length ? (
                        detail.conversations.map((conversation) => (
                          <View key={conversation.id} style={styles.subCard}>
                            <View style={styles.requestHeader}>
                              <View style={styles.requestHeaderCopy}>
                                <Text
                                  style={styles.requestTitle}
                                  numberOfLines={1}
                                >
                                  {conversation.provider?.displayName ||
                                    "Provider"}
                                </Text>
                                <Text
                                  style={styles.requestMeta}
                                  numberOfLines={1}
                                >
                                  {conversation.messageCount} messages · updated{" "}
                                  {formatDateTime(conversation.updatedAt)}
                                </Text>
                              </View>
                              <StatusPill status={conversation.status} />
                            </View>

                            <Text style={styles.sectionLine} numberOfLines={2}>
                              Latest:{" "}
                              {conversation.lastMessage?.content ||
                                "No message yet"}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyBody}>
                          No conversations on this request yet.
                        </Text>
                      )}
                    </View>
                  </>
                ) : null}
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  list: {
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 19,
    fontFamily: tokens.font.display,
    letterSpacing: -0.4,
  },
  modalTitle: {
    color: tokens.colors.ink,
    fontSize: 22,
    fontFamily: tokens.font.display,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
  countPill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  countPillText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontFamily: tokens.font.bold,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryCard: {
    minWidth: "46%",
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  summaryLabel: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.semibold,
  },
  summaryValue: {
    color: tokens.colors.ink,
    fontSize: 22,
    fontFamily: tokens.font.display,
    letterSpacing: -0.4,
  },
  searchCard: {
    gap: 12,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 14,
  },
  searchActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  applyButton: {
    flex: 1,
    minHeight: 48,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  inputShell: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: 50,
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.regular,
  },
  railScroll: {
    marginHorizontal: -20,
  },
  filterRow: {
    gap: 8,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  chipDivider: {
    width: 1,
    height: 24,
    backgroundColor: tokens.colors.borderStrong,
    marginHorizontal: 4,
  },
  filterChip: {
    height: 40,
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.inkDeep,
    borderColor: tokens.colors.inkDeep,
  },
  filterChipText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  requestCard: {
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#ffffff",
    padding: 14,
  },
  cardPressed: {
    backgroundColor: tokens.colors.surfaceSoft,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  requestHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  requestTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.bold,
  },
  requestMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
  },
  metricGrid: {
    flexDirection: "row",
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 2,
  },
  metricCardWhite: {
    flex: 1,
    borderRadius: tokens.radius.sm,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 2,
  },
  metricLabel: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontFamily: tokens.font.medium,
  },
  metricValue: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.bold,
  },
  inlineMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metaText: {
    flex: 1,
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
  },
  metaTextRight: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
    textAlign: "right",
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
  statusMatched: {
    backgroundColor: tokens.colors.brandSoft,
  },
  statusPending: {
    backgroundColor: tokens.colors.surface,
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
  statusTextMatched: {
    color: tokens.colors.brandDeep,
  },
  statusTextPending: {
    color: tokens.colors.ink,
  },
  statusTextDanger: {
    color: tokens.colors.mutedSoft,
  },
  skeletonBlock: {
    backgroundColor: tokens.colors.border,
    borderRadius: 7,
  },
  skeletonTitle: {
    height: 16,
    width: "60%",
  },
  skeletonLine: {
    height: 12,
    width: "90%",
  },
  skeletonLineShort: {
    height: 12,
    width: "40%",
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
    gap: 12,
  },
  detailTitle: {
    color: tokens.colors.ink,
    fontSize: 19,
    lineHeight: 24,
    fontFamily: tokens.font.display,
    letterSpacing: -0.4,
  },
  sectionCard: {
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#ffffff",
    padding: 14,
  },
  sectionTitle: {
    color: tokens.colors.ink,
    fontSize: 17,
    fontFamily: tokens.font.display,
    letterSpacing: -0.3,
  },
  sectionLine: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
  subCard: {
    gap: 10,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: 12,
  },
});

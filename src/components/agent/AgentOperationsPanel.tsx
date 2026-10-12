import { FontAwesome6 } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
    maximumFractionDigits: 0,
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

export function AgentOperationsPanel() {
  const [queue, setQueue] = useState<AgentOperationsQueueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterId>("ALL");
  const [serviceModelFilter, setServiceModelFilter] = useState<ServiceModelFilterId>("ALL");
  const [searchDraft, setSearchDraft] = useState("");
  const [stateDraft, setStateDraft] = useState("");
  const [countryDraft, setCountryDraft] = useState("US");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [submittedState, setSubmittedState] = useState("");
  const [submittedCountry, setSubmittedCountry] = useState("US");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentOperationsRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const nextQueue = await getAgentOperationsRequests({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        serviceModel: serviceModelFilter === "ALL" ? undefined : serviceModelFilter,
        search: submittedSearch || undefined,
        stateCode: submittedState || undefined,
        countryCode: submittedCountry || undefined,
        page: 1,
        pageSize: 20,
      });

      setQueue(nextQueue);
    } catch (nextError) {
      setError(getFriendlyApiError(nextError, "We could not load the operations queue."));
    } finally {
      setIsLoading(false);
    }
  }, [serviceModelFilter, statusFilter, submittedCountry, submittedSearch, submittedState]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const openDetail = useCallback(async (quoteRequestId: string) => {
    try {
      setSelectedRequestId(quoteRequestId);
      setDetailOpen(true);
      setDetailLoading(true);
      setDetail(null);
      const nextDetail = await getAgentOperationsRequestDetail(quoteRequestId);
      setDetail(nextDetail);
    } catch (nextError) {
      setError(getFriendlyApiError(nextError, "We could not load that request detail."));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const locationSummary = useMemo(
    () => [submittedState, submittedCountry].filter(Boolean).join(" · "),
    [submittedCountry, submittedState],
  );

  return (
    <>
      {error ? (
        <View style={styles.errorBanner}>
          <FontAwesome6 name="triangle-exclamation" size={14} color={tokens.colors.danger} />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Operations queue</Text>
            <Text style={styles.title}>Read-only request oversight</Text>
            <Text style={styles.subtitle}>
              Watch live quote demand, see match progress, and inspect conversation readiness without
              stepping into provider actions yet.
            </Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{queue?.summary.total ?? 0} total</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          {[
            { label: "Open", value: queue?.summary.openCount ?? 0 },
            { label: "Matched", value: queue?.summary.matchedCount ?? 0 },
            { label: "Accepted", value: queue?.summary.acceptedCount ?? 0 },
            { label: "Closed", value: (queue?.summary.cancelledCount ?? 0) + (queue?.summary.expiredCount ?? 0) },
          ].map((item) => (
            <View key={item.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.searchCard}>
          <Text style={styles.searchLabel}>Queue search</Text>
          <View style={styles.searchRow}>
            <TextInput
              value={searchDraft}
              onChangeText={setSearchDraft}
              style={[styles.input, styles.flexInput]}
              placeholder="Service, requester, city..."
              placeholderTextColor={tokens.colors.mutedSoft}
            />
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                setSubmittedSearch(searchDraft.trim());
                setSubmittedState(stateDraft.trim().toUpperCase());
                setSubmittedCountry(countryDraft.trim().toUpperCase() || "US");
              }}
            >
              <FontAwesome6 name="magnifying-glass" size={14} color={tokens.colors.inkDeep} />
              <Text style={styles.primaryButtonText}>Apply</Text>
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <TextInput
              value={stateDraft}
              onChangeText={setStateDraft}
              style={[styles.input, styles.flexInput]}
              autoCapitalize="characters"
              placeholder="State"
              placeholderTextColor={tokens.colors.mutedSoft}
            />
            <TextInput
              value={countryDraft}
              onChangeText={setCountryDraft}
              style={[styles.input, styles.countryInput]}
              autoCapitalize="characters"
              placeholder="US"
              placeholderTextColor={tokens.colors.mutedSoft}
            />
          </View>

          <View style={styles.inlineMeta}>
            <Text style={styles.metaText}>
              Scope: {locationSummary || "All active BookMiz markets"}
            </Text>
            <Pressable
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
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {statusFilters.map((filter) => {
            const active = filter.id === statusFilter;
            return (
              <Pressable
                key={filter.id}
                style={[styles.filterChip, active ? styles.filterChipActive : null]}
                onPress={() => setStatusFilter(filter.id)}
              >
                <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {serviceModelFilters.map((filter) => {
            const active = filter.id === serviceModelFilter;
            return (
              <Pressable
                key={filter.id}
                style={[styles.filterChip, active ? styles.filterChipActive : null]}
                onPress={() => setServiceModelFilter(filter.id)}
              >
                <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Live requests</Text>
            <Text style={styles.title}>Queue detail</Text>
            <Text style={styles.subtitle}>
              Requests are ordered by the most recent marketplace activity.
            </Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{queue?.pagination.total ?? 0} visible</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={tokens.colors.brand} />
            <Text style={styles.loadingText}>Loading operations queue...</Text>
          </View>
        ) : queue?.items.length ? (
          queue.items.map((item) => (
            <Pressable
              key={item.id}
              style={styles.requestCard}
              onPress={() => void openDetail(item.id)}
            >
              <View style={styles.requestHeader}>
                <View style={styles.requestHeaderCopy}>
                  <Text style={styles.requestTitle}>{item.requestedServiceName}</Text>
                  <Text style={styles.requestMeta}>
                    {item.requestedCategoryName || "General request"} · {item.requesterName}
                  </Text>
                </View>
                <View style={[styles.statusPill, statusTone(item.status)]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>

              <Text style={styles.requestLocation}>
                {formatLocation(item.city, item.stateCode, item.countryCode)}
              </Text>
              <Text style={styles.requestBody} numberOfLines={2}>
                {item.description}
              </Text>

              <View style={styles.metricGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Matches</Text>
                  <Text style={styles.metricValue}>{item.matchCount}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Unlocked</Text>
                  <Text style={styles.metricValue}>{item.unlockedMatchCount}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Conversations</Text>
                  <Text style={styles.metricValue}>{item.conversationCount}</Text>
                </View>
              </View>

              <View style={styles.inlineMeta}>
                <Text style={styles.metaText}>
                  {item.budgetMinCents || item.budgetMaxCents
                    ? `${formatMoney(item.budgetMinCents)} - ${formatMoney(item.budgetMaxCents)}`
                    : "Budget flexible"}
                </Text>
                <Text style={styles.metaText}>Updated {formatDate(item.updatedAt)}</Text>
              </View>
            </Pressable>
          ))
        ) : (
          <Text style={styles.emptyState}>
            No requests matched the current filters. Widen the lane or location scope to see more of
            the marketplace queue.
          </Text>
        )}
      </View>

      <Modal
        visible={detailOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDetailOpen(false)} />
          <View style={styles.modalSheetWrap}>
            <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
              <View style={styles.modalHandle} />
              <View style={styles.headerRow}>
                <View style={styles.headerCopy}>
                  <Text style={styles.title}>Request detail</Text>
                  <Text style={styles.subtitle}>
                    Read-only oversight for live provider matches and conversations.
                  </Text>
                </View>
                <Pressable style={styles.closeButton} onPress={() => setDetailOpen(false)}>
                  <FontAwesome6 name="xmark" size={18} color={tokens.colors.ink} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
                {detailLoading ? (
                  <View style={styles.loadingState}>
                    <ActivityIndicator color={tokens.colors.brand} />
                    <Text style={styles.loadingText}>Loading request detail...</Text>
                  </View>
                ) : detail ? (
                  <>
                    <View style={styles.detailHero}>
                      <Text style={styles.eyebrow}>Marketplace request</Text>
                      <Text style={styles.detailTitle}>{detail.requestedServiceName}</Text>
                      <Text style={styles.detailSubtitle}>{detail.description}</Text>
                      <View style={styles.inlineMeta}>
                        <Text style={styles.metaText}>
                          {formatLocation(detail.city, detail.stateCode, detail.countryCode)}
                        </Text>
                        <Text style={styles.metaText}>{detail.serviceModel}</Text>
                      </View>
                    </View>

                    <View style={styles.metricGrid}>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Matches</Text>
                        <Text style={styles.metricValue}>{detail.matchCount}</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Unlocked</Text>
                        <Text style={styles.metricValue}>{detail.unlockedMatchCount}</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Chats</Text>
                        <Text style={styles.metricValue}>{detail.conversationCount}</Text>
                      </View>
                    </View>

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionTitle}>Request scope</Text>
                      <Text style={styles.sectionLine}>
                        Desired date: {formatDate(detail.desiredDate)}
                      </Text>
                      <Text style={styles.sectionLine}>
                        Time window: {detail.desiredWindowStart || "Any"} - {detail.desiredWindowEnd || "Any"}
                      </Text>
                      <Text style={styles.sectionLine}>
                        Budget: {detail.budgetMinCents || detail.budgetMaxCents
                          ? `${formatMoney(detail.budgetMinCents)} - ${formatMoney(detail.budgetMaxCents)}`
                          : "Flexible"}
                      </Text>
                      <Text style={styles.sectionLine}>
                        Channels: {detail.requestedChannels.length ? detail.requestedChannels.join(", ") : "Not specified"}
                      </Text>
                      <Text style={styles.sectionLine}>
                        Requested documents: {detail.requestedDocumentLabels.length ? detail.requestedDocumentLabels.join(", ") : "None"}
                      </Text>
                    </View>

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionTitle}>Provider matches</Text>
                      {detail.matches.length ? (
                        detail.matches.map((match) => (
                          <View key={match.id} style={styles.subCard}>
                            <View style={styles.requestHeader}>
                              <View style={styles.requestHeaderCopy}>
                                <Text style={styles.requestTitle}>
                                  {match.provider?.displayName || "Provider"}
                                </Text>
                                <Text style={styles.requestMeta}>
                                  {match.provider?.primaryLocation
                                    ? formatLocation(
                                        match.provider.primaryLocation.city,
                                        match.provider.primaryLocation.stateCode,
                                        match.provider.primaryLocation.countryCode,
                                      )
                                    : "Location pending"}
                                </Text>
                              </View>
                              <View style={[styles.statusPill, statusTone(match.status)]}>
                                <Text style={styles.statusText}>{match.status}</Text>
                              </View>
                            </View>

                            <View style={styles.metricGrid}>
                              <View style={styles.metricCard}>
                                <Text style={styles.metricLabel}>Score</Text>
                                <Text style={styles.metricValue}>{match.score.toFixed(2)}</Text>
                              </View>
                              <View style={styles.metricCard}>
                                <Text style={styles.metricLabel}>Unlock</Text>
                                <Text style={styles.metricValue}>{formatMoney(match.unlockPriceCents)}</Text>
                              </View>
                              <View style={styles.metricCard}>
                                <Text style={styles.metricLabel}>Distance</Text>
                                <Text style={styles.metricValue}>
                                  {match.distanceMiles ? `${match.distanceMiles.toFixed(1)} mi` : "—"}
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.sectionLine}>
                              Conversation: {match.conversation ? `${match.conversation.messageCount} messages` : "Not unlocked yet"}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyState}>No provider matches yet.</Text>
                      )}
                    </View>

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionTitle}>Conversation activity</Text>
                      {detail.conversations.length ? (
                        detail.conversations.map((conversation) => (
                          <View key={conversation.id} style={styles.subCard}>
                            <View style={styles.requestHeader}>
                              <View style={styles.requestHeaderCopy}>
                                <Text style={styles.requestTitle}>
                                  {conversation.provider?.displayName || "Provider"}
                                </Text>
                                <Text style={styles.requestMeta}>
                                  {conversation.messageCount} messages · updated {formatDateTime(conversation.updatedAt)}
                                </Text>
                              </View>
                              <View style={[styles.statusPill, statusTone(conversation.status)]}>
                                <Text style={styles.statusText}>{conversation.status}</Text>
                              </View>
                            </View>

                            <Text style={styles.sectionLine}>
                              Latest: {conversation.lastMessage?.content || "No message preview"}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyState}>No conversation threads on this request yet.</Text>
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
  panel: {
    gap: 16,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    padding: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.9,
  },
  subtitle: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  countPill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countPillText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryCard: {
    minWidth: "47%",
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#f6f9fd",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  summaryLabel: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  summaryValue: {
    color: tokens.colors.ink,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  searchCard: {
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fbfdff",
    padding: 14,
  },
  searchLabel: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "600",
  },
  flexInput: {
    flex: 1,
  },
  countryInput: {
    width: 82,
  },
  filterRow: {
    gap: 10,
    paddingRight: 18,
  },
  filterChip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.ink,
    borderColor: tokens.colors.ink,
  },
  filterChipText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  requestCard: {
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    padding: 16,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  requestHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  requestTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  requestMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  requestLocation: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  requestBody: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    minWidth: "30%",
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#f6f9fd",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  metricLabel: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricValue: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  inlineMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  metaText: {
    flex: 1,
    color: tokens.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  linkText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  statusPill: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusSuccess: {
    backgroundColor: "#edf8f1",
    borderColor: "#cce7d7",
  },
  statusPending: {
    backgroundColor: "#fff6df",
    borderColor: "#f0de9b",
  },
  statusDanger: {
    backgroundColor: "#fff1f1",
    borderColor: "#f1c9c9",
  },
  statusNeutral: {
    backgroundColor: "#f5f7fa",
    borderColor: tokens.colors.border,
  },
  statusText: {
    color: tokens.colors.ink,
    fontSize: 11,
    fontWeight: "900",
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 24,
  },
  loadingText: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#f1c9c9",
    backgroundColor: "#fff3f2",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorBannerText: {
    flex: 1,
    color: tokens.colors.danger,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
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
    maxHeight: "92%",
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
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    paddingTop: 18,
    paddingBottom: 24,
    gap: 16,
  },
  detailHero: {
    gap: 10,
    borderRadius: 24,
    backgroundColor: tokens.colors.ink,
    padding: 18,
  },
  detailTitle: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.9,
  },
  detailSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    lineHeight: 22,
  },
  sectionCard: {
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    padding: 16,
  },
  sectionTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sectionLine: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  subCard: {
    gap: 10,
    borderRadius: 18,
    backgroundColor: "#f8fbff",
    padding: 14,
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
});

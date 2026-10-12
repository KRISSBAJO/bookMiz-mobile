import { useFocusEffect } from "expo-router/react-navigation";
import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/src/components/Screen";
import { SectionHeader } from "@/src/components/SectionHeader";
import { listCustomerBookings } from "@/src/lib/api/bookings";
import type { CustomerBookingRecord } from "@/src/lib/api/types";
import {
  canCancelBooking,
  canRescheduleBooking,
  formatBookingDateLabel,
  formatBookingDateTime,
  formatBookingMoney,
  formatMeetingProvider,
  hasActiveMeetingLink,
  isBookingLiveNow,
} from "@/src/lib/booking-display";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import { tokens } from "@/src/theme/tokens";

type AppointmentFilter = "ALL" | "LIVE" | "UPCOMING" | "PAST" | "CANCELLED";

const filterLabels: Array<{ id: AppointmentFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "LIVE", label: "Live now" },
  { id: "UPCOMING", label: "Upcoming" },
  { id: "PAST", label: "Past" },
  { id: "CANCELLED", label: "Cancelled" },
];

function statusTone(status: CustomerBookingRecord["status"]) {
  switch (status) {
    case "CONFIRMED":
      return styles.statusConfirmed;
    case "PENDING":
      return styles.statusPending;
    case "COMPLETED":
      return styles.statusCompleted;
    case "CANCELLED":
      return styles.statusCancelled;
    case "CHECKED_IN":
      return styles.statusLive;
    default:
      return styles.statusDefault;
  }
}

export function AppointmentsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<CustomerBookingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<AppointmentFilter>("UPCOMING");

  const loadBookings = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const nextBookings = await listCustomerBookings();
      setBookings(
        [...nextBookings].sort(
          (left, right) =>
            new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
        ),
      );
    } catch (nextError) {
      setError(
        getFriendlyApiError(
          nextError,
          "We could not load your appointments right now.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadBookings();
    }, [loadBookings]),
  );

  const bookingBuckets = useMemo(() => {
    const now = Date.now();

    const live = bookings.filter((booking) => isBookingLiveNow(booking));
    const cancelled = bookings.filter((booking) => booking.status === "CANCELLED");
    const upcoming = bookings.filter(
      (booking) =>
        booking.status !== "CANCELLED" &&
        booking.status !== "COMPLETED" &&
        new Date(booking.startsAt).getTime() > now,
    );
    const past = bookings.filter(
      (booking) =>
        booking.status === "COMPLETED" ||
        (booking.status !== "CANCELLED" &&
          new Date(booking.endsAt).getTime() <= now),
    );

    return {
      live,
      upcoming,
      past,
      cancelled,
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    switch (activeFilter) {
      case "LIVE":
        return bookingBuckets.live;
      case "UPCOMING":
        return bookingBuckets.upcoming;
      case "PAST":
        return bookingBuckets.past;
      case "CANCELLED":
        return bookingBuckets.cancelled;
      default:
        return bookings;
    }
  }, [activeFilter, bookingBuckets, bookings]);

  return (
    <Screen
      eyebrow="Appointment center"
      title="See what is booked, live, and finished"
      subtitle="Keep upcoming sessions, past visits, cancellations, and reschedules in one real customer booking hub."
      heroTopContent={
        <View style={styles.heroTopRow}>
          <Pressable style={styles.heroBackButton} onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left-long" size={16} color="#fff" />
            <Text style={styles.heroBackLabel}>Back</Text>
          </Pressable>
          <Pressable
            style={styles.heroGhostButton}
            onPress={() => router.push("/(tabs)/explore")}
          >
            <Text style={styles.heroGhostLabel}>Book another</Text>
          </Pressable>
        </View>
      }
      heroContent={
        <View style={styles.metricRail}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{bookingBuckets.live.length}</Text>
            <Text style={styles.metricLabel}>Live now</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{bookingBuckets.upcoming.length}</Text>
            <Text style={styles.metricLabel}>Upcoming</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{bookingBuckets.past.length}</Text>
            <Text style={styles.metricLabel}>Past visits</Text>
          </View>
        </View>
      }
      contentTopOffset={24}
      heroBottomPadding={32}
      heroMinHeight={284}
    >
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <View style={styles.filterPanel}>
        <SectionHeader
          title="Appointments"
          subtitle="Open any booking for directions, join links, cancellation, or reschedule options."
        />
        <View style={styles.filterRail}>
          {filterLabels.map((filter) => {
            const isActive = filter.id === activeFilter;
            return (
              <Pressable
                key={filter.id}
                style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                onPress={() => setActiveFilter(filter.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive ? styles.filterChipTextActive : null,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.listPanel}>
        {isLoading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Loading appointments...</Text>
            <Text style={styles.emptyCaption}>
              Pulling the same live customer booking feed your web account uses.
            </Text>
          </View>
        ) : filteredBookings.length > 0 ? (
          filteredBookings.map((booking) => (
            <Pressable
              key={booking.id}
              style={styles.bookingCard}
              onPress={() =>
                router.push({
                  pathname: "/appointments/[bookingId]",
                  params: { bookingId: booking.id },
                })
              }
            >
              <View style={styles.bookingCardHeader}>
                <View style={styles.bookingCardCopy}>
                  <Text style={styles.bookingService}>{booking.service.name}</Text>
                  <Text style={styles.bookingProvider}>
                    {booking.provider.displayName}
                  </Text>
                </View>
                <View style={[styles.statusPill, statusTone(booking.status)]}>
                  <Text style={styles.statusText}>
                    {booking.status.replaceAll("_", " ")}
                  </Text>
                </View>
              </View>

              <View style={styles.bookingMetaGrid}>
                <View style={styles.bookingMetaItem}>
                  <FontAwesome6 name="calendar-days" size={14} color={tokens.colors.muted} />
                  <Text style={styles.bookingMetaText}>
                    {formatBookingDateLabel(booking.startsAt)}
                  </Text>
                </View>
                <View style={styles.bookingMetaItem}>
                  <FontAwesome6 name="clock" size={14} color={tokens.colors.muted} />
                  <Text style={styles.bookingMetaText}>
                    {formatBookingDateTime(booking.startsAt)}
                  </Text>
                </View>
                <View style={styles.bookingMetaItem}>
                  <FontAwesome6
                    name={booking.channel === "VIDEO" ? "video" : "location-dot"}
                    size={14}
                    color={tokens.colors.muted}
                  />
                  <Text style={styles.bookingMetaText}>
                    {booking.channel === "VIDEO"
                      ? formatMeetingProvider(booking.meeting.provider)
                      : booking.location?.name ||
                        booking.location?.city ||
                        "Provider location"}
                  </Text>
                </View>
              </View>

              <View style={styles.bookingFooter}>
                <Text style={styles.bookingPrice}>
                  {formatBookingMoney(booking.totalPriceCents, booking.currencyCode)}
                </Text>
                <View style={styles.bookingFooterBadges}>
                  {hasActiveMeetingLink(booking.meeting) ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Join link ready</Text>
                    </View>
                  ) : null}
                  {canRescheduleBooking(booking) ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Reschedulable</Text>
                    </View>
                  ) : null}
                  {canCancelBooking(booking) ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Cancelable</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No appointments in this view</Text>
            <Text style={styles.emptyCaption}>
              Book a provider from the marketplace, then come back here to manage the appointment.
            </Text>
            <Pressable
              style={styles.emptyAction}
              onPress={() => router.push("/(tabs)/explore")}
            >
              <Text style={styles.emptyActionText}>Open marketplace</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  heroBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroBackLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  heroGhostButton: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroGhostLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  metricRail: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: tokens.radius.md,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 3,
  },
  metricValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  metricLabel: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "600",
  },
  errorBanner: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: "#f5c7c4",
    backgroundColor: "#fff2f0",
    color: tokens.colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  filterPanel: {
    gap: 14,
  },
  filterRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterChipActive: {
    borderColor: tokens.colors.ink,
    backgroundColor: tokens.colors.ink,
  },
  filterChipText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  listPanel: {
    gap: 14,
  },
  bookingCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    padding: 18,
    gap: 15,
  },
  bookingCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  bookingCardCopy: {
    flex: 1,
    gap: 4,
  },
  bookingService: {
    color: tokens.colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  bookingProvider: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  statusPill: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusConfirmed: {
    backgroundColor: "#e6f7ec",
  },
  statusPending: {
    backgroundColor: "#fff4de",
  },
  statusCompleted: {
    backgroundColor: "#eef2f7",
  },
  statusCancelled: {
    backgroundColor: "#fde9e6",
  },
  statusLive: {
    backgroundColor: "#e1f7f0",
  },
  statusDefault: {
    backgroundColor: "#edf2fa",
  },
  statusText: {
    color: tokens.colors.ink,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  bookingMetaGrid: {
    gap: 10,
  },
  bookingMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bookingMetaText: {
    flex: 1,
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  bookingFooter: {
    gap: 10,
  },
  bookingPrice: {
    color: tokens.colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  bookingFooterBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#f2f6dc",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: "#5f7d16",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  emptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderStyle: "dashed",
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingVertical: 24,
    gap: 8,
  },
  emptyTitle: {
    color: tokens.colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  emptyCaption: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  emptyAction: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyActionText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
});

import { appointmentDayKey, appointmentDayLabel, upcomingAppointments } from '../lib/appointment-feed';
import { useFocusEffect } from "expo-router/react-navigation";
import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/src/components/Screen";
import { listCustomerBookings } from "@/src/lib/api/bookings";
import type { CustomerBookingRecord } from "@/src/lib/api/types";
import {
  formatBookingMoney,
  formatBookingTimeLabel,
  formatMeetingProvider,
  hasActiveMeetingLink,
  isBookingLiveNow,
} from "@/src/lib/booking-display";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import { tokens } from "@/src/theme/tokens";

type AppointmentFilter = "ALL" | "LIVE" | "UPCOMING" | "PAST" | "CANCELLED";

const filterLabels: Array<{ id: AppointmentFilter; label: string }> = [
  { id: "UPCOMING", label: "Upcoming" },
  { id: "PAST", label: "Past" },
  { id: "LIVE", label: "Live now" },
  { id: "CANCELLED", label: "Cancelled" },
  { id: "ALL", label: "All" },
];

function statusTone(status: CustomerBookingRecord["status"]) {
  switch (status) {
    case "CONFIRMED":
      return { pill: styles.statusConfirmed, text: styles.statusTextConfirmed };
    case "PENDING":
      return { pill: styles.statusPending, text: styles.statusTextPending };
    case "CANCELLED":
      return { pill: styles.statusCancelled, text: styles.statusTextCancelled };
    case "CHECKED_IN":
      return { pill: styles.statusLive, text: styles.statusTextLive };
    default:
      return { pill: styles.statusDefault, text: styles.statusTextDefault };
  }
}

function statusLabel(status: CustomerBookingRecord["status"]) {
  switch (status) {
    case "CONFIRMED":
      return "Confirmed";
    case "PENDING":
      return "Pending";
    case "CHECKED_IN":
      return "Checked in";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function dateTileParts(value: string) {
  const date = new Date(value);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
    day: String(date.getDate()),
    month: date.toLocaleDateString(undefined, { month: "short" }),
  };
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
    const upcoming = upcomingAppointments(bookings, now);
    const past = bookings.filter(
      (booking) =>
        booking.status === "COMPLETED" || booking.status === "NO_SHOW" ||
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

  const countFor = (filter: AppointmentFilter) => {
    switch (filter) {
      case "LIVE":
        return bookingBuckets.live.length;
      case "UPCOMING":
        return bookingBuckets.upcoming.length;
      case "PAST":
        return bookingBuckets.past.length;
      case "CANCELLED":
        return bookingBuckets.cancelled.length;
      default:
        return bookings.length;
    }
  };

  return (
    <Screen
      title="Appointments"
      subtitle={`Times shown in ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
      eyebrow={!isLoading && bookingBuckets.upcoming.length > 0 ? `${bookingBuckets.upcoming.length} upcoming` : undefined}
      refreshing={isLoading && bookings.length > 0}
      onRefresh={() => void loadBookings()}
      action={
        <Pressable
          style={styles.headerAction}
          onPress={() => router.push("/(tabs)/explore")}
          accessibilityRole="button"
          accessibilityLabel="Book an appointment"
        >
          <FontAwesome6 name="plus" size={14} color={tokens.colors.inkDeep} />
          <Text style={styles.headerActionText}>Book</Text>
        </Pressable>
      }
      heroContent={
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRailScroll}
          contentContainerStyle={styles.chipRail}
        >
          {filterLabels.map((filter) => {
            const isActive = filter.id === activeFilter;
            const count = countFor(filter.id);
            return (
              <Pressable
                key={filter.id}
                style={[styles.chip, isActive ? styles.chipActive : null]}
                onPress={() => setActiveFilter(filter.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.chipText, isActive ? styles.chipTextActive : null]}>
                  {filter.label}
                </Text>
                {count > 0 ? (
                  <Text style={[styles.chipCount, isActive ? styles.chipCountActive : null]}>
                    {count}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      }
    >
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
          <Pressable onPress={() => void loadBookings()} accessibilityRole="button">
            <Text style={styles.errorRetry}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.list}>
        {isLoading ? (
          [0, 1, 2].map((index) => (
            <View key={index} style={[styles.skeletonCard, { opacity: 1 - index * 0.25 }]}>
              <View style={styles.skeletonTile} />
              <View style={styles.skeletonBody}>
                <View style={styles.skeletonLineWide} />
                <View style={styles.skeletonLine} />
              </View>
            </View>
          ))
        ) : filteredBookings.length > 0 ? (
          filteredBookings.map((booking, index) => {
            const tile = dateTileParts(booking.startsAt);
            const tone = statusTone(booking.status);
            const live = isBookingLiveNow(booking);
            const showDay = index === 0 || appointmentDayKey(filteredBookings[index - 1].startsAt) !== appointmentDayKey(booking.startsAt);
            return (
              <View key={booking.id}>
              {showDay ? <Text accessibilityRole="header" style={{color:tokens.colors.inkDeep,fontFamily:tokens.font.bold,fontSize:14,marginTop:index?16:0,marginBottom:10}}>{appointmentDayLabel(booking.startsAt)}</Text> : null}
              <Pressable
                style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/appointments/[bookingId]",
                    params: { bookingId: booking.id },
                  })
                }
              >
                <View style={styles.dateTile}>
                  <Text style={styles.dateTileWeekday}>{tile.weekday}</Text>
                  <Text style={styles.dateTileDay}>{tile.day}</Text>
                  <Text style={styles.dateTileMonth}>{tile.month}</Text>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {booking.service.name}
                    </Text>
                    {live ? (
                      <View style={styles.livePill}>
                        <Text style={styles.livePillText}>Live</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusPill, tone.pill]}>
                        <Text style={[styles.statusText, tone.text]}>
                          {statusLabel(booking.status)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {booking.provider.displayName} · {formatBookingTimeLabel(booking.startsAt)}
                  </Text>
                  <View style={styles.cardFooter}>
                    <View style={styles.cardPlace}>
                      <FontAwesome6
                        name={booking.channel === "VIDEO" ? "video" : "location-dot"}
                        size={12}
                        color={tokens.colors.muted}
                      />
                      <Text style={styles.cardPlaceText} numberOfLines={1}>
                        {booking.channel === "VIDEO"
                          ? hasActiveMeetingLink(booking.meeting)
                            ? `${formatMeetingProvider(booking.meeting.provider)} · link ready`
                            : formatMeetingProvider(booking.meeting.provider)
                          : booking.location?.name ||
                            booking.location?.city ||
                            "Provider location"}
                      </Text>
                    </View>
                    <Text style={styles.cardPrice}>
                      {formatBookingMoney(booking.totalPriceCents, booking.currencyCode)}
                    </Text>
                  </View>
                </View>
              </Pressable>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {activeFilter === "UPCOMING" ? "Nothing booked yet" : "No appointments here"}
            </Text>
            <Text style={styles.emptyBody}>
              {activeFilter === "UPCOMING"
                ? "Find a provider and book a time."
                : "Switch the filter or book a new appointment."}
            </Text>
            <Pressable
              style={styles.emptyAction}
              onPress={() => router.push("/(tabs)/explore")}
              accessibilityRole="button"
            >
              <Text style={styles.emptyActionText}>Find a provider</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
  },
  headerActionText: {
    color: tokens.colors.inkDeep,
    fontSize: 14,
    fontFamily: tokens.font.bold,
  },
  chipRailScroll: {
    marginHorizontal: -20,
  },
  chipRail: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
  },
  chipActive: {
    borderColor: tokens.colors.inkDeep,
    backgroundColor: tokens.colors.inkDeep,
  },
  chipText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  chipTextActive: {
    color: "#ffffff",
  },
  chipCount: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontFamily: tokens.font.semibold,
  },
  chipCountActive: {
    color: tokens.colors.onNavyMuted,
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
  list: {
    gap: 12,
  },
  skeletonCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  skeletonTile: {
    width: 56,
    height: 64,
    borderRadius: 12,
    backgroundColor: tokens.colors.border,
  },
  skeletonBody: {
    flex: 1,
    justifyContent: "center",
    gap: 10,
  },
  skeletonLineWide: {
    height: 14,
    width: "70%",
    borderRadius: 7,
    backgroundColor: tokens.colors.border,
  },
  skeletonLine: {
    height: 12,
    width: "45%",
    borderRadius: 6,
    backgroundColor: tokens.colors.border,
  },
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  cardPressed: {
    opacity: 0.8,
  },
  dateTile: {
    width: 56,
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: tokens.colors.inkDeep,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  dateTileWeekday: {
    color: tokens.colors.onNavyMuted,
    fontSize: 11,
    fontFamily: tokens.font.semibold,
  },
  dateTileDay: {
    color: "#ffffff",
    fontSize: 20,
    lineHeight: 24,
    fontFamily: tokens.font.display,
  },
  dateTileMonth: {
    color: tokens.colors.onNavyMuted,
    fontSize: 11,
    fontFamily: tokens.font.semibold,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    justifyContent: "center",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.display,
    letterSpacing: -0.2,
  },
  cardMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
  },
  cardPlace: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardPlaceText: {
    flex: 1,
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  cardPrice: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.bold,
  },
  statusPill: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: tokens.font.bold,
  },
  statusConfirmed: {
    backgroundColor: tokens.colors.successSoft,
  },
  statusTextConfirmed: {
    color: tokens.colors.success,
  },
  statusPending: {
    backgroundColor: tokens.colors.warningSoft,
  },
  statusTextPending: {
    color: tokens.colors.warning,
  },
  statusCancelled: {
    backgroundColor: tokens.colors.dangerSoft,
  },
  statusTextCancelled: {
    color: tokens.colors.danger,
  },
  statusLive: {
    backgroundColor: tokens.colors.brandSoft,
  },
  statusTextLive: {
    color: tokens.colors.brandDeep,
  },
  statusDefault: {
    backgroundColor: tokens.colors.surfaceSoft,
  },
  statusTextDefault: {
    color: tokens.colors.muted,
  },
  livePill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  livePillText: {
    color: tokens.colors.inkDeep,
    fontSize: 12,
    fontFamily: tokens.font.bold,
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
    textAlign: "center",
    fontFamily: tokens.font.regular,
  },
  emptyAction: {
    marginTop: 10,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyActionText: {
    color: tokens.colors.inkDeep,
    fontSize: 14,
    fontFamily: tokens.font.bold,
  },
});

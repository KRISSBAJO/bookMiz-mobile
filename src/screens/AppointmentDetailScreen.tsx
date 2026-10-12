import { useFocusEffect } from "expo-router/react-navigation";
import { FontAwesome6 } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
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
  cancelCustomerBooking,
  getCustomerBooking,
  getPublicBookingAvailability,
  getPublicBookingAvailabilityMonth,
  rescheduleCustomerBooking,
} from "@/src/lib/api/bookings";
import type {
  CustomerBookingRecord,
  PublicAvailabilityMonthDaySummary,
  PublicAvailabilitySlot,
} from "@/src/lib/api/types";
import {
  canCancelBooking,
  canRescheduleBooking,
  formatBookingDateLabel,
  formatBookingDateTime,
  formatBookingMoney,
  formatBookingTimeLabel,
  formatMeetingProvider,
  formatSecureDocumentSize,
  hasActiveMeetingLink,
  isBookingLiveNow,
} from "@/src/lib/booking-display";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import { bookingPaymentLabel, shouldRefreshBookingPayment } from "@/src/lib/booking-payment-display";
import { tokens } from "@/src/theme/tokens";

type BookingCalendarDay = {
  value: string;
  label: number;
  inMonth: boolean;
  isPast: boolean;
  isSelected: boolean;
};

function normalizeBookingId(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toInputDateValue(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthStartInputValue(value: string) {
  const [year, month] = value.split("-");
  return `${year}-${month}-01`;
}

function shiftMonthInputValue(value: string, offset: number) {
  const [year, month] = value.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, month - 1 + offset, 1));
  return getMonthStartInputValue(toInputDateValue(nextMonth));
}

function toAvailabilityDate(value: string) {
  return `${value}T12:00:00.000Z`;
}

function formatCalendarMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function formatCalendarDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function formatSlotLabel(slot: PublicAvailabilitySlot) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${formatter.format(new Date(slot.startAt))} - ${formatter.format(
    new Date(slot.endAt),
  )}`;
}

function buildCalendarDays(
  monthStartValue: string,
  selectedValue: string,
): BookingCalendarDay[] {
  const [year, month] = monthStartValue.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(firstOfMonth.getUTCDate() - firstOfMonth.getUTCDay());
  const todayValue = getTodayInputValue();

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const value = toInputDateValue(date);

    return {
      value,
      label: date.getUTCDate(),
      inMonth: date.getUTCMonth() === firstOfMonth.getUTCMonth(),
      isPast: value < todayValue,
      isSelected: value === selectedValue,
    };
  });
}

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

export function AppointmentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = normalizeBookingId(params.bookingId);

  const [booking, setBooking] = useState<CustomerBookingRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(
    getMonthStartInputValue(getTodayInputValue()),
  );
  const [selectedDate, setSelectedDate] = useState(getTodayInputValue());
  const [monthAvailabilityLoading, setMonthAvailabilityLoading] = useState(false);
  const [monthAvailabilityDays, setMonthAvailabilityDays] = useState<
    PublicAvailabilityMonthDaySummary[]
  >([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [selectedSlotStartAt, setSelectedSlotStartAt] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"cancel" | "reschedule" | null>(null);

  const loadBooking = useCallback(async () => {
    if (!bookingId) {
      setError("We could not find that appointment.");
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      const nextBooking = await getCustomerBooking(bookingId);
      setBooking(nextBooking);
    } catch (nextError) {
      setError(
        getFriendlyApiError(
          nextError,
          "We could not load this appointment right now.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      void loadBooking();
    }, [loadBooking]),
  );

  const paymentRefreshId = booking && shouldRefreshBookingPayment(booking) ? booking.id : null;
  useEffect(() => {
    if (!paymentRefreshId) return;
    let active = true;
    let attempts = 0;
    const timer = setInterval(async () => {
      if (++attempts >= 20) clearInterval(timer);
      try {
        const updated = await getCustomerBooking(paymentRefreshId);
        if (!active) return;
        setBooking(current => current?.id === updated.id ? updated : current);
        if (!shouldRefreshBookingPayment(updated)) clearInterval(timer);
      } catch { /* Retain the last confirmed payment status. */ }
    }, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [paymentRefreshId]);

  const bootstrapReschedule = useCallback(() => {
    if (!booking) {
      return;
    }

    const nextDate = toInputDateValue(
      new Date(Math.max(Date.now(), new Date(booking.startsAt).getTime())),
    );
    setCalendarMonth(getMonthStartInputValue(nextDate));
    setSelectedDate(nextDate);
    setMonthAvailabilityDays([]);
    setSlots([]);
    setSelectedSlotStartAt(null);
    setRescheduleReason("");
    setError(null);
    setRescheduleOpen(true);
  }, [booking]);

  const availabilityLocationId =
    booking?.channel === "IN_PERSON" ? booking.location?.id : undefined;
  const availabilityStaffMemberId = booking?.assignedStaff?.id;

  const availableMonthDays = useMemo(
    () =>
      monthAvailabilityDays
        .map((day) => ({
          ...day,
          inputDate: toInputDateValue(new Date(day.date)),
        }))
        .sort((a, b) => a.inputDate.localeCompare(b.inputDate)),
    [monthAvailabilityDays],
  );

  const monthAvailabilityByDate = useMemo(
    () =>
      new Map(
        availableMonthDays.map((day) => [
          day.inputDate,
          { slotCount: day.slotCount, inputDate: day.inputDate },
        ]),
      ),
    [availableMonthDays],
  );

  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth, selectedDate),
    [calendarMonth, selectedDate],
  );

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.startAt === selectedSlotStartAt) ?? null,
    [selectedSlotStartAt, slots],
  );

  useEffect(() => {
    if (!rescheduleOpen || !booking) {
      return;
    }

    const currentBooking = booking;
    let active = true;

    async function loadMonthAvailability() {
      try {
        setMonthAvailabilityLoading(true);
        const availability = await getPublicBookingAvailabilityMonth({
          providerId: currentBooking.provider.id,
          serviceId: currentBooking.service.id,
          month: toAvailabilityDate(calendarMonth),
          locationId: availabilityLocationId,
          staffMemberId: availabilityStaffMemberId,
        });

        if (!active) {
          return;
        }

        setMonthAvailabilityDays(availability.days);
      } catch (nextError) {
        if (active) {
          setMonthAvailabilityDays([]);
          setError(
            getFriendlyApiError(
              nextError,
              "We could not load provider availability for that month.",
            ),
          );
        }
      } finally {
        if (active) {
          setMonthAvailabilityLoading(false);
        }
      }
    }

    void loadMonthAvailability();

    return () => {
      active = false;
    };
  }, [
    availabilityLocationId,
    availabilityStaffMemberId,
    booking,
    calendarMonth,
    rescheduleOpen,
  ]);

  useEffect(() => {
    if (!rescheduleOpen) {
      return;
    }

    const selectedMonth = getMonthStartInputValue(selectedDate);

    if (selectedMonth !== calendarMonth) {
      setSelectedDate(calendarMonth);
      setSelectedSlotStartAt(null);
      return;
    }

    const hasSelectedAvailability = availableMonthDays.some(
      (day) => day.inputDate === selectedDate,
    );

    if (!hasSelectedAvailability && availableMonthDays.length > 0) {
      setSelectedDate(availableMonthDays[0].inputDate);
      setSelectedSlotStartAt(null);
    }
  }, [availableMonthDays, calendarMonth, rescheduleOpen, selectedDate]);

  useEffect(() => {
    if (!rescheduleOpen || !booking) {
      return;
    }

    const currentBooking = booking;
    const daySummary = monthAvailabilityByDate.get(selectedDate);

    if (!daySummary) {
      setSlots([]);
      setSelectedSlotStartAt(null);
      return;
    }

    let active = true;

    async function loadSlots() {
      try {
        setSlotsLoading(true);
        const availability = await getPublicBookingAvailability({
          providerId: currentBooking.provider.id,
          serviceId: currentBooking.service.id,
          date: toAvailabilityDate(selectedDate),
          locationId: availabilityLocationId,
          staffMemberId: availabilityStaffMemberId,
        });

        if (!active) {
          return;
        }

        setSlots(availability.slots);
        setSelectedSlotStartAt((current) => {
          if (current && availability.slots.some((slot) => slot.startAt === current)) {
            return current;
          }

          return availability.slots[0]?.startAt ?? null;
        });
      } catch (nextError) {
        if (active) {
          setSlots([]);
          setSelectedSlotStartAt(null);
          setError(
            getFriendlyApiError(
              nextError,
              "We could not load open times for that day.",
            ),
          );
        }
      } finally {
        if (active) {
          setSlotsLoading(false);
        }
      }
    }

    void loadSlots();

    return () => {
      active = false;
    };
  }, [
    availabilityLocationId,
    availabilityStaffMemberId,
    booking,
    monthAvailabilityByDate,
    rescheduleOpen,
    selectedDate,
  ]);

  const stepMonth = useCallback((offset: number) => {
    const nextMonth = shiftMonthInputValue(calendarMonth, offset);
    setCalendarMonth(nextMonth);
    setSelectedDate(nextMonth);
    setSelectedSlotStartAt(null);
    setSlots([]);
    setError(null);
  }, [calendarMonth]);

  const handleCancel = useCallback(async () => {
    if (!booking) {
      return;
    }

    try {
      setBusyAction("cancel");
      setError(null);
      const updated = await cancelCustomerBooking(
        booking.id,
        cancelReason.trim() || undefined,
      );
      setBooking(updated);
      setCancelOpen(false);
      setCancelReason("");
    } catch (nextError) {
      setError(
        getFriendlyApiError(
          nextError,
          "We could not cancel this appointment.",
        ),
      );
    } finally {
      setBusyAction(null);
    }
  }, [booking, cancelReason]);

  const handleReschedule = useCallback(async () => {
    if (!booking || !selectedSlotStartAt) {
      return;
    }

    try {
      setBusyAction("reschedule");
      setError(null);
      const updated = await rescheduleCustomerBooking(booking.id, {
        startsAt: selectedSlotStartAt,
        reason: rescheduleReason.trim() || undefined,
      });
      setBooking(updated);
      setRescheduleOpen(false);
      setSelectedSlotStartAt(null);
    } catch (nextError) {
      setError(
        getFriendlyApiError(
          nextError,
          "We could not reschedule this appointment.",
        ),
      );
    } finally {
      setBusyAction(null);
    }
  }, [booking, rescheduleReason, selectedSlotStartAt]);

  const actionHints = useMemo(() => {
    if (!booking) {
      return [];
    }

    const nextHints: string[] = [];

    if (hasActiveMeetingLink(booking.meeting)) {
      nextHints.push("Join link ready");
    }
    if (canRescheduleBooking(booking)) {
      nextHints.push("Reschedule available");
    }
    if (canCancelBooking(booking)) {
      nextHints.push("Cancellation available");
    }

    return nextHints;
  }, [booking]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {booking ? (
        <>
          <View style={styles.hero}>
            <View style={styles.heroOverlay} />
            <SafeAreaView style={styles.heroSafeArea} edges={["top"]}>
              <View style={styles.heroChrome}>
                <Pressable style={styles.heroButton} onPress={() => router.back()}>
                  <FontAwesome6 name="arrow-left-long" size={16} color="#fff" />
                  <Text style={styles.heroButtonText}>Back</Text>
                </Pressable>
                <Pressable
                  style={styles.heroButton}
                  onPress={() => router.push(`/providers/${booking.provider.slug}`)}
                >
                  <FontAwesome6 name="shop" size={14} color="#fff" />
                  <Text style={styles.heroButtonText}>Provider</Text>
                </Pressable>
              </View>
            </SafeAreaView>

            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>Customer appointment</Text>
              <Text style={styles.heroTitle}>{booking.service.name}</Text>
              <Text style={styles.heroSubtitle}>
                {booking.provider.displayName} · {formatBookingDateLabel(booking.startsAt)}
              </Text>

              <View style={styles.statusRow}>
                <View style={[styles.statusPill, statusTone(booking.status)]}>
                  <Text style={styles.statusText}>
                    {booking.status.replaceAll("_", " ")}
                  </Text>
                </View>
                {isBookingLiveNow(booking) ? (
                  <View style={styles.livePill}>
                    <Text style={styles.livePillText}>Live now</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            {booking.paymentStatus ? <Text>Payment: {booking.paymentStatus.toLowerCase().replaceAll('_', ' ')}{booking.paymentMode === 'test' ? ' (sandbox)' : ''}</Text> : null}
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>When</Text>
                <Text style={styles.metricValue}>{formatBookingTimeLabel(booking.startsAt)}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Value</Text>
                <Text style={styles.metricValue}>
                  {formatBookingMoney(booking.totalPriceCents, booking.currencyCode)}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Channel</Text>
                <Text style={styles.metricValue}>
                  {booking.channel === "VIDEO"
                    ? formatMeetingProvider(booking.meeting.provider)
                    : "In person"}
                </Text>
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Appointment actions</Text>
              <Text style={styles.panelSubtitle}>
                Manage the booking from the same live customer record the web account uses.
              </Text>

              <View style={styles.actionHintsRow}>
                {actionHints.length > 0 ? (
                  actionHints.map((hint) => (
                    <View key={hint} style={styles.hintBadge}>
                      <Text style={styles.hintBadgeText}>{hint}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.hintBadgeMuted}>
                    <Text style={styles.hintBadgeMutedText}>
                      This booking is locked to its current state.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.actionButtons}>
                {hasActiveMeetingLink(booking.meeting) ? (
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => void Linking.openURL(booking.meeting.joinUrl!)}
                  >
                    <Text style={styles.primaryButtonText}>Join session</Text>
                  </Pressable>
                ) : null}
                {canRescheduleBooking(booking) ? (
                  <Pressable style={styles.secondaryButton} onPress={bootstrapReschedule}>
                    <Text style={styles.secondaryButtonText}>Reschedule</Text>
                  </Pressable>
                ) : null}
                {canCancelBooking(booking) ? (
                  <Pressable
                    style={styles.destructiveButton}
                    onPress={() => setCancelOpen(true)}
                  >
                    <Text style={styles.destructiveButtonText}>Cancel appointment</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Booking details</Text>
              <Text accessibilityRole="text" style={styles.panelSubtitle}>Payment: {bookingPaymentLabel(booking)}{booking.paymentMode === "test" ? " · Sandbox" : ""}</Text>
              <View style={styles.detailGrid}>
                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>Provider</Text>
                  <Text style={styles.detailValue}>{booking.provider.displayName}</Text>
                </View>
                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>Date and time</Text>
                  <Text style={styles.detailValue}>
                    {formatBookingDateTime(booking.startsAt)}
                  </Text>
                </View>
                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>Staff</Text>
                  <Text style={styles.detailValue}>
                    {booking.assignedStaff?.displayName || "Provider team"}
                  </Text>
                </View>
                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>
                    {booking.channel === "VIDEO"
                      ? formatMeetingProvider(booking.meeting.provider)
                      : booking.location?.name ||
                        `${booking.location?.city ?? ""}${booking.location?.stateCode ? `, ${booking.location.stateCode}` : ""}` ||
                        "Provider location"}
                  </Text>
                </View>
              </View>

              {booking.notes ? (
                <View style={styles.copyBlock}>
                  <Text style={styles.copyBlockTitle}>Notes</Text>
                  <Text style={styles.copyBlockBody}>{booking.notes}</Text>
                </View>
              ) : null}

              {booking.cancelledReason ? (
                <View style={styles.cancelledBlock}>
                  <Text style={styles.copyBlockTitle}>Cancellation reason</Text>
                  <Text style={styles.copyBlockBody}>{booking.cancelledReason}</Text>
                </View>
              ) : null}
            </View>

            {booking.documents.length > 0 ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Uploaded documents</Text>
                <Text style={styles.panelSubtitle}>
                  Files already attached to this appointment.
                </Text>

                <View style={styles.documentList}>
                  {booking.documents.map((document) => (
                    <View key={document.id} style={styles.documentCard}>
                      <View style={styles.documentIconWrap}>
                        <FontAwesome6 name="file-lines" size={16} color={tokens.colors.ink} />
                      </View>
                      <View style={styles.documentCopy}>
                        <Text style={styles.documentLabel}>
                          {document.label || document.fileName}
                        </Text>
                        <Text style={styles.documentMeta}>
                          {document.fileName} · {formatSecureDocumentSize(document.sizeBytes)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </>
      ) : (
        <SafeAreaView style={styles.loadingState} edges={["top", "bottom"]}>
          <Pressable style={styles.heroButton} onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left-long" size={16} color="#fff" />
            <Text style={styles.heroButtonText}>Back</Text>
          </Pressable>
          <Text style={styles.loadingTitle}>
            {isLoading ? "Loading appointment..." : "Appointment unavailable"}
          </Text>
          {error ? <Text style={styles.loadingCaption}>{error}</Text> : null}
        </SafeAreaView>
      )}

      <Modal
        visible={cancelOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCancelOpen(false)} />
          <View style={styles.modalSheetWrap}>
            <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>Cancel appointment</Text>
                  <Text style={styles.modalSubtitle}>
                    This will update the live booking record and retire any active session access.
                  </Text>
                </View>
                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setCancelOpen(false)}
                >
                  <FontAwesome6 name="xmark" size={18} color={tokens.colors.ink} />
                </Pressable>
              </View>
              <TextInput
                value={cancelReason}
                onChangeText={setCancelReason}
                style={styles.textArea}
                placeholder="Optional reason for cancellation"
                placeholderTextColor={tokens.colors.mutedSoft}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.modalFooter}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setCancelOpen(false)}
                >
                  <Text style={styles.secondaryButtonText}>Keep booking</Text>
                </Pressable>
                <Pressable
                  style={styles.destructiveButton}
                  onPress={() => void handleCancel()}
                >
                  <Text style={styles.destructiveButtonText}>
                    {busyAction === "cancel" ? "Cancelling..." : "Confirm cancellation"}
                  </Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={rescheduleOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRescheduleOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setRescheduleOpen(false)} />
          <View style={styles.modalSheetWrap}>
            <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>Reschedule appointment</Text>
                  <Text style={styles.modalSubtitle}>
                    Choose only from the provider's live open days and times.
                  </Text>
                </View>
                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setRescheduleOpen(false)}
                >
                  <FontAwesome6 name="xmark" size={18} color={tokens.colors.ink} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.rescheduleContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.selectionCard}>
                  <Text style={styles.selectionEyebrow}>Current booking</Text>
                  <Text style={styles.selectionTitle}>
                    {booking ? formatBookingDateLabel(booking.startsAt) : ""}
                  </Text>
                  <Text style={styles.selectionBody}>
                    {booking ? formatBookingTimeLabel(booking.startsAt) : ""}
                    {booking?.assignedStaff?.displayName
                      ? ` · ${booking.assignedStaff.displayName}`
                      : ""}
                  </Text>
                </View>

                <View style={styles.availabilityCard}>
                  <View style={styles.availabilityHeader}>
                    <View>
                      <Text style={styles.selectorLabel}>Pick a day</Text>
                      <Text style={styles.availabilityTitle}>
                        {formatCalendarMonth(calendarMonth)}
                      </Text>
                    </View>
                    <View style={styles.monthControls}>
                      <Pressable
                        style={styles.monthButton}
                        onPress={() => stepMonth(-1)}
                      >
                        <FontAwesome6
                          name="chevron-left"
                          size={14}
                          color={tokens.colors.ink}
                        />
                      </Pressable>
                      <Pressable
                        style={styles.monthButton}
                        onPress={() => stepMonth(1)}
                      >
                        <FontAwesome6
                          name="chevron-right"
                          size={14}
                          color={tokens.colors.ink}
                        />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.weekdayRow}>
                    {["S", "M", "T", "W", "T", "F", "S"].map((label) => (
                      <Text key={label} style={styles.weekdayLabel}>
                        {label}
                      </Text>
                    ))}
                  </View>

                  {monthAvailabilityLoading ? (
                    <Text style={styles.loadingCopy}>Loading availability...</Text>
                  ) : (
                    <View style={styles.calendarGrid}>
                      {calendarDays.map((day) => {
                        const daySummary = monthAvailabilityByDate.get(day.value);
                        const isAvailable = Boolean(day.inMonth && !day.isPast && daySummary);
                        return (
                          <Pressable
                            key={day.value}
                            style={[
                              styles.dayCell,
                              !day.inMonth ? styles.dayCellMuted : null,
                              isAvailable ? styles.dayCellAvailable : null,
                              day.isSelected && isAvailable ? styles.dayCellSelected : null,
                            ]}
                            disabled={!isAvailable}
                            onPress={() => {
                              setSelectedDate(day.value);
                              setSelectedSlotStartAt(null);
                              setError(null);
                            }}
                          >
                            <Text
                              style={[
                                styles.dayCellLabel,
                                !day.inMonth ? styles.dayCellLabelMuted : null,
                                isAvailable ? styles.dayCellLabelAvailable : null,
                                day.isSelected && isAvailable
                                  ? styles.dayCellLabelSelected
                                  : null,
                              ]}
                            >
                              {day.label}
                            </Text>
                            {daySummary ? (
                              <View
                                style={[
                                  styles.dayAvailabilityDot,
                                  day.isSelected ? styles.dayAvailabilityDotSelected : null,
                                ]}
                              />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={styles.availabilityCard}>
                  <Text style={styles.selectorLabel}>Pick a time</Text>
                  <Text style={styles.availabilityTitle}>
                    {formatCalendarDate(selectedDate)}
                  </Text>
                  <Text style={styles.panelSubtitle}>
                    {selectedSlot
                      ? `Selected ${formatSlotLabel(selectedSlot)}`
                      : "Choose from the provider's open times for this day."}
                  </Text>

                  {slotsLoading ? (
                    <Text style={styles.loadingCopy}>Loading times...</Text>
                  ) : slots.length > 0 ? (
                    <View style={styles.slotGrid}>
                      {slots.map((slot) => {
                        const isSelected = slot.startAt === selectedSlotStartAt;
                        return (
                          <Pressable
                            key={slot.startAt}
                            style={[
                              styles.slotButton,
                              isSelected ? styles.slotButtonSelected : null,
                            ]}
                            onPress={() => setSelectedSlotStartAt(slot.startAt)}
                          >
                            <Text
                              style={[
                                styles.slotLabel,
                                isSelected ? styles.slotLabelSelected : null,
                              ]}
                            >
                              {formatSlotLabel(slot)}
                            </Text>
                            {(slot.staffOptions?.length ?? 0) > 1 ? (
                              <Text
                                style={[
                                  styles.slotMeta,
                                  isSelected ? styles.slotMetaSelected : null,
                                ]}
                              >
                                {slot.staffOptions?.length ?? 0} team options
                              </Text>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.emptyAvailabilityState}>
                      <Text style={styles.emptyAvailabilityTitle}>
                        No open slots for this selection
                      </Text>
                      <Text style={styles.emptyAvailabilityBody}>
                        Try a different day or month to find the next available opening.
                      </Text>
                    </View>
                  )}
                </View>

                <TextInput
                  value={rescheduleReason}
                  onChangeText={setRescheduleReason}
                  style={styles.textArea}
                  placeholder="Optional note for the provider"
                  placeholderTextColor={tokens.colors.mutedSoft}
                  multiline
                  textAlignVertical="top"
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setRescheduleOpen(false)}
                >
                  <Text style={styles.secondaryButtonText}>Keep current time</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.primaryButton,
                    !selectedSlotStartAt ? styles.buttonDisabled : null,
                  ]}
                  disabled={!selectedSlotStartAt}
                  onPress={() => void handleReschedule()}
                >
                  <Text style={styles.primaryButtonText}>
                    {busyAction === "reschedule" ? "Saving..." : "Save new slot"}
                  </Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  hero: {
    minHeight: 276,
    backgroundColor: tokens.colors.ink,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(12,29,54,0.92)",
  },
  heroSafeArea: {
    paddingHorizontal: 20,
  },
  heroChrome: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 12,
  },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  heroCopy: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 28,
    gap: 12,
  },
  heroEyebrow: {
    color: tokens.colors.gold,
    fontSize: 12,
    letterSpacing: 2.8,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -1.1,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
    lineHeight: 23,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
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
  livePill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(142,227,15,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  livePillText: {
    color: "#c9ff67",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  scroll: {
    flex: 1,
    marginTop: -18,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: tokens.colors.surfaceSoft,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 20,
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
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  metricLabel: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  metricValue: {
    color: tokens.colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  panel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    padding: 18,
    gap: 14,
  },
  panelTitle: {
    color: tokens.colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  panelSubtitle: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  actionHintsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hintBadge: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#f2f6dc",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hintBadgeText: {
    color: "#5f7d16",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  hintBadgeMuted: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#eef2f7",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hintBadgeMutedText: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  actionButtons: {
    gap: 10,
  },
  primaryButton: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  destructiveButton: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#d65146",
    paddingHorizontal: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  destructiveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  detailGrid: {
    gap: 12,
  },
  detailCard: {
    borderRadius: tokens.radius.md,
    backgroundColor: "#fbfdff",
    borderWidth: 1,
    borderColor: "#edf1f6",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  detailLabel: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  detailValue: {
    color: tokens.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  copyBlock: {
    borderRadius: tokens.radius.md,
    backgroundColor: "#fbfdff",
    borderWidth: 1,
    borderColor: "#edf1f6",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  cancelledBlock: {
    borderRadius: tokens.radius.md,
    backgroundColor: "#fff2f0",
    borderWidth: 1,
    borderColor: "#f5c7c4",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  copyBlockTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  copyBlockBody: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  documentList: {
    gap: 10,
  },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: "#edf1f6",
    backgroundColor: "#fbfdff",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  documentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2f7",
  },
  documentCopy: {
    flex: 1,
    gap: 3,
  },
  documentLabel: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  documentMeta: {
    color: tokens.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  loadingState: {
    flex: 1,
    backgroundColor: tokens.colors.ink,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 18,
  },
  loadingTitle: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.9,
  },
  loadingCaption: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    lineHeight: 21,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(12,29,54,0.42)",
  },
  modalSheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    width: "100%",
    minHeight: "52%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 16,
  },
  modalHandle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cfd8e6",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    paddingTop: 8,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  modalTitle: {
    color: tokens.colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  modalSubtitle: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  modalCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  textArea: {
    minHeight: 110,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    color: tokens.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalScroll: {
    flexGrow: 0,
  },
  rescheduleContent: {
    gap: 14,
    paddingBottom: 8,
  },
  selectionCard: {
    borderRadius: 24,
    backgroundColor: tokens.colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  selectorLabel: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  selectionEyebrow: {
    color: tokens.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  selectionTitle: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
  },
  selectionBody: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    lineHeight: 20,
  },
  availabilityCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  availabilityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  availabilityTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  monthControls: {
    flexDirection: "row",
    gap: 8,
  },
  monthButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fbfdff",
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  weekdayLabel: {
    width: "14.285%",
    textAlign: "center",
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayCell: {
    width: "12.8%",
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#edf1f6",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dayCellMuted: {
    opacity: 0.32,
  },
  dayCellAvailable: {
    backgroundColor: "#fff",
    borderColor: "#dbe4ef",
  },
  dayCellSelected: {
    backgroundColor: tokens.colors.ink,
    borderColor: tokens.colors.ink,
  },
  dayCellLabel: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  dayCellLabelMuted: {
    color: "#a8b6c8",
  },
  dayCellLabelAvailable: {
    color: tokens.colors.ink,
  },
  dayCellLabelSelected: {
    color: "#fff",
  },
  dayAvailabilityDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: tokens.colors.brand,
  },
  dayAvailabilityDotSelected: {
    backgroundColor: "#fff",
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  slotButton: {
    minWidth: "48%",
    flexGrow: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e4ebf4",
    backgroundColor: "#fbfdff",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  slotButtonSelected: {
    backgroundColor: tokens.colors.ink,
    borderColor: tokens.colors.ink,
  },
  slotLabel: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  slotLabelSelected: {
    color: "#fff",
  },
  slotMeta: {
    color: tokens.colors.muted,
    fontSize: 12,
  },
  slotMetaSelected: {
    color: "rgba(255,255,255,0.72)",
  },
  emptyAvailabilityState: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#edf1f6",
    backgroundColor: "#fbfdff",
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 6,
  },
  emptyAvailabilityTitle: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  emptyAvailabilityBody: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  modalFooter: {
    gap: 10,
  },
  loadingCopy: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
});

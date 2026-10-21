import { useFocusEffect } from "expo-router/react-navigation";
import { FontAwesome6 } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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

import { AuthButton } from "@/src/components/auth/AuthButton";
import { Screen } from "@/src/components/Screen";
import {
  cancelCustomerBooking,
  getCustomerBooking,
  getCustomerRescheduleOptions,
  getCustomerRescheduleMonth,
  rescheduleCustomerBooking,
  resumeCustomerPayment,
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
  formatBookingMoney,
  formatBookingTimeLabel,
  formatMeetingProvider,
  formatSecureDocumentSize,
  hasActiveMeetingLink,
  isBookingLiveNow,
} from "@/src/lib/booking-display";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import {
  bookingPaymentLabel,
  shouldRefreshBookingPayment,
} from "@/src/lib/booking-payment-display";
import { tokens } from "@/src/theme/tokens";
import { openBookingCheckout } from "@/src/lib/open-booking-checkout";
import {
  addBookingDocument,
  openBookingDocument,
} from "@/src/lib/booking-documents";

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

function formatSlotLabel(slot: PublicAvailabilitySlot, timeZone?: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });

  return `${formatter.format(new Date(slot.startAt))} - ${formatter.format(
    new Date(slot.endAt),
  )}`;
}

function formatSlotStart(slot: PublicAvailabilitySlot, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(slot.startAt));
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

function paymentTone(label: string) {
  if (label === "Paid")
    return { pill: styles.statusConfirmed, text: styles.statusTextConfirmed };
  if (label === "Unpaid" || label === "Refund pending") {
    return { pill: styles.statusPending, text: styles.statusTextPending };
  }
  return { pill: styles.statusDefault, text: styles.statusTextDefault };
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
  const [monthAvailabilityLoading, setMonthAvailabilityLoading] =
    useState(false);
  const [monthAvailabilityDays, setMonthAvailabilityDays] = useState<
    PublicAvailabilityMonthDaySummary[]
  >([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [selectedSlotStartAt, setSelectedSlotStartAt] = useState<string | null>(
    null,
  );
  const [busyAction, setBusyAction] = useState<
    "cancel" | "reschedule" | "payment" | null
  >(null);
  const [documentBusy, setDocumentBusy] = useState(false);
  const handleDocument = async (
    document?: CustomerBookingRecord["documents"][number],
  ) => {
    if (!booking || documentBusy) return;
    setDocumentBusy(true);
    setError(null);
    try {
      if (document) await openBookingDocument(booking.id, document);
      else await addBookingDocument(booking.id);
      setBooking(await getCustomerBooking(booking.id));
    } catch (reason) {
      setError(
        getFriendlyApiError(reason, "Could not open or upload this document."),
      );
    } finally {
      setDocumentBusy(false);
    }
  };

  async function continuePayment() {
    if (!booking || busyAction) return;
    setBusyAction("payment");
    setError(null);
    try {
      const payment = await resumeCustomerPayment(booking.id);
      if (payment?.authorizationUrl)
        await openBookingCheckout(payment.authorizationUrl);
      setBooking(await getCustomerBooking(booking.id));
    } catch (reason) {
      setError(
        getFriendlyApiError(
          reason,
          "Could not reopen checkout. Please try again.",
        ),
      );
    } finally {
      setBusyAction(null);
    }
  }

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

  const paymentRefreshId =
    booking && shouldRefreshBookingPayment(booking) ? booking.id : null;
  useEffect(() => {
    if (!paymentRefreshId) return;
    let active = true;
    let attempts = 0;
    const timer = setInterval(async () => {
      if (++attempts >= 20) clearInterval(timer);
      try {
        const updated = await getCustomerBooking(paymentRefreshId);
        if (!active) return;
        setBooking((current) =>
          current?.id === updated.id ? updated : current,
        );
        if (!shouldRefreshBookingPayment(updated)) clearInterval(timer);
      } catch {
        /* Retain the last confirmed payment status. */
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
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

  const businessTimezone = booking?.customerPolicy?.timezone ?? booking?.provider.timezone ?? 'UTC';
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
        const availability = await getCustomerRescheduleMonth(currentBooking.id, {
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
        const availability = await getCustomerRescheduleOptions(currentBooking.id, {
          date: toAvailabilityDate(selectedDate),
          locationId: availabilityLocationId,
          staffMemberId: availabilityStaffMemberId,
        });

        if (!active) {
          return;
        }

        setSlots(availability.slots);
        setSelectedSlotStartAt((current) => {
          if (
            current &&
            availability.slots.some((slot) => slot.startAt === current)
          ) {
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

  const stepMonth = useCallback(
    (offset: number) => {
      const nextMonth = shiftMonthInputValue(calendarMonth, offset);
      setCalendarMonth(nextMonth);
      setSelectedDate(nextMonth);
      setSelectedSlotStartAt(null);
      setSlots([]);
      setError(null);
    },
    [calendarMonth],
  );

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
        getFriendlyApiError(nextError, "We could not cancel this appointment."),
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
        assignedStaffId: slots.find(slot => slot.startAt === selectedSlotStartAt)?.staffOptions?.[0]?.staffMemberId,
        locationId: slots.find(slot => slot.startAt === selectedSlotStartAt)?.locationId,
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
  }, [booking, rescheduleReason, selectedSlotStartAt, slots]);

  const paymentLabel = booking ? bookingPaymentLabel(booking) : "";
  const paymentPill = paymentTone(paymentLabel);
  const tone = booking ? statusTone(booking.status) : null;
  const startDate = booking ? new Date(booking.startsAt) : null;
  const locationLine =
    booking?.channel === "VIDEO"
      ? formatMeetingProvider(booking.meeting.provider)
      : booking?.location?.name ||
        `${booking?.location?.city ?? ""}${booking?.location?.stateCode ? `, ${booking.location.stateCode}` : ""}` ||
        "Provider location";
  const addressLine =
    booking?.channel !== "VIDEO" && booking?.location
      ? [
          booking.location.line1,
          [booking.location.city, booking.location.stateCode]
            .filter(Boolean)
            .join(", "),
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  const headerAction = booking ? (
    <Pressable
      style={styles.headerAction}
      onPress={() => router.push(`/providers/${booking.provider.slug}`)}
      accessibilityRole="button"
      accessibilityLabel="Open provider"
    >
      <Text style={styles.headerActionText}>Provider</Text>
      <FontAwesome6 name="arrow-right" size={13} color={tokens.colors.ink} />
    </Pressable>
  ) : null;

  const showPaymentAction = Boolean(
    booking &&
    booking.paymentMode &&
    booking.paymentStatus === "UNPAID" &&
    ["PENDING", "CONFIRMED"].includes(booking.status),
  );

  return (
    <View style={styles.root}>
      <Screen
        title="Appointment"
        eyebrow={booking ? formatBookingDateLabel(booking.startsAt, businessTimezone) : undefined}
        action={headerAction}
        refreshing={isLoading && Boolean(booking)}
        onRefresh={() => void loadBooking()}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
            {!booking ? (
              <Pressable
                onPress={() => void loadBooking()}
                accessibilityRole="button"
              >
                <Text style={styles.errorRetry}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {booking && startDate && tone ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroCardRow}>
                <View style={styles.dateTile}>
                  <Text style={styles.dateTileWeekday}>
                    {startDate.toLocaleDateString(undefined, {
                      weekday: "short",
                    })}
                  </Text>
                  <Text style={styles.dateTileDay}>{startDate.getDate()}</Text>
                  <Text style={styles.dateTileWeekday}>
                    {startDate.toLocaleDateString(undefined, {
                      month: "short",
                    })}
                  </Text>
                </View>
                <View style={styles.heroCardBody}>
                  <Text style={styles.heroCardTitle} numberOfLines={2}>
                    {booking.service.name}
                  </Text>
                  <Text style={styles.heroCardMeta} numberOfLines={1}>
                    {booking.provider.displayName}
                  </Text>
                  <Text style={styles.heroCardMeta} numberOfLines={1}>
                    {formatBookingTimeLabel(booking.startsAt, businessTimezone)} ·{" "}
                    {booking.service.durationMinutes} min
                    {booking.assignedStaff
                      ? ` · ${booking.assignedStaff.displayName ?? booking.assignedStaff.firstName}`
                      : ""}
                  </Text>
                </View>
              </View>
              <View style={styles.heroPills}>
                <View style={[styles.statusPill, tone.pill]}>
                  <Text style={[styles.statusText, tone.text]}>
                    {statusLabel(booking.status)}
                  </Text>
                </View>
                {isBookingLiveNow(booking) ? (
                  <View style={styles.livePill}>
                    <Text style={styles.livePillText}>Live now</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {showPaymentAction ? (
              <AuthButton
                label={
                  busyAction === "payment"
                    ? "Opening checkout…"
                    : "Continue payment"
                }
                disabled={Boolean(busyAction)}
                loading={busyAction === "payment"}
                onPress={() => void continuePayment()}
              />
            ) : null}
            {hasActiveMeetingLink(booking.meeting) ? (
              <AuthButton
                label="Join video"
                icon="video"
                variant={showPaymentAction ? "navy" : "primary"}
                onPress={() => void Linking.openURL(booking.meeting.joinUrl!)}
              />
            ) : null}
            {canRescheduleBooking(booking) || canCancelBooking(booking) ? (
              <View style={styles.actionRow}>
                {canRescheduleBooking(booking) ? (
                  <AuthButton
                    label="Reschedule"
                    variant="secondary"
                    style={styles.actionButton}
                    onPress={bootstrapReschedule}
                  />
                ) : null}
                {canCancelBooking(booking) ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.dangerGhost,
                      styles.actionButton,
                      pressed ? styles.pressed : null,
                    ]}
                    onPress={() => setCancelOpen(true)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.dangerGhostText}>Cancel</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FontAwesome6
                  name={booking.channel === "VIDEO" ? "video" : "location-dot"}
                  size={16}
                  color={tokens.colors.ink}
                />
                <Text style={styles.sectionTitle}>
                  {booking.channel === "VIDEO" ? "Video call" : "Location"}
                </Text>
              </View>
              <Text style={styles.sectionValue}>{locationLine}</Text>
              {addressLine ? (
                <Text style={styles.sectionCaption}>{addressLine}</Text>
              ) : null}
              {booking.channel === "VIDEO" &&
              !hasActiveMeetingLink(booking.meeting) ? (
                <Text style={styles.sectionCaption}>
                  The join link appears here once it is ready.
                </Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FontAwesome6
                  name="credit-card"
                  size={16}
                  color={tokens.colors.ink}
                />
                <Text style={styles.sectionTitle}>Payment</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentAmount}>
                  {formatBookingMoney(
                    booking.totalPriceCents,
                    booking.currencyCode,
                  )}
                </Text>
                <View style={[styles.statusPill, paymentPill.pill]}>
                  <Text style={[styles.statusText, paymentPill.text]}>
                    {paymentLabel}
                    {booking.paymentMode === "test" ? " (sandbox)" : ""}
                  </Text>
                </View>
              </View>
              {booking.depositCents ? (
                <Text style={styles.sectionCaption}>
                  Deposit{" "}
                  {formatBookingMoney(
                    booking.depositCents,
                    booking.currencyCode,
                  )}
                </Text>
              ) : null}
            </View>

            {booking.notes ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <FontAwesome6
                    name="note-sticky"
                    size={16}
                    color={tokens.colors.ink}
                  />
                  <Text style={styles.sectionTitle}>Notes</Text>
                </View>
                <Text style={styles.sectionBody}>{booking.notes}</Text>
              </View>
            ) : null}

            <AuthButton
              label={
                documentBusy
                  ? "Working on document…"
                  : "Upload appointment document"
              }
              variant="secondary"
              disabled={documentBusy}
              onPress={() => handleDocument()}
            />
            {booking.customerPolicy ? (
              <View style={styles.documentCopy}>
                <Text style={styles.sectionTitle}>
                  Cancellation and rescheduling
                </Text>
                <Text style={styles.sectionBody}>
                  Cancel by {new Date(booking.customerPolicy.cancellationDeadline ?? booking.customerPolicy.changeDeadline).toLocaleString(undefined, { timeZone: booking.customerPolicy.timezone ?? booking.provider.timezone ?? 'UTC' })}{'\n'}
                  Reschedule by {new Date(booking.customerPolicy.rescheduleDeadline ?? booking.customerPolicy.changeDeadline).toLocaleString(undefined, { timeZone: booking.customerPolicy.timezone ?? booking.provider.timezone ?? 'UTC' })}{'\n'}
                  {booking.customerPolicy.timezone ?? booking.provider.timezone ?? 'UTC'}. After the deadline, contact the business. Cancellation does not automatically confirm a refund.
                </Text>
                {booking.customerPolicy.cancellationPolicy ? (
                  <Text style={styles.sectionBody}>
                    {booking.customerPolicy.cancellationPolicy}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {booking.cancelledReason ? (
              <View style={[styles.section, styles.sectionDanger]}>
                <View style={styles.sectionHeader}>
                  <FontAwesome6
                    name="xmark"
                    size={16}
                    color={tokens.colors.danger}
                  />
                  <Text
                    style={[styles.sectionTitle, styles.sectionTitleDanger]}
                  >
                    Cancellation reason
                  </Text>
                </View>
                <Text style={styles.sectionBody}>
                  {booking.cancelledReason}
                </Text>
              </View>
            ) : null}

            {booking.documents.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <FontAwesome6
                    name="file-lines"
                    size={16}
                    color={tokens.colors.ink}
                  />
                  <Text style={styles.sectionTitle}>Documents</Text>
                </View>
                {booking.documents.map((document, index) => (
                  <View
                    key={document.id}
                    style={[
                      styles.documentRow,
                      index < booking.documents.length - 1
                        ? styles.rowDivider
                        : null,
                    ]}
                  >
                    <View style={styles.documentCopy}>
                      <Text style={styles.documentLabel} numberOfLines={1}>
                        {document.label || document.fileName}
                      </Text>
                      <Text style={styles.documentMeta} numberOfLines={1}>
                        {document.fileName} ·{" "}
                        {formatSecureDocumentSize(document.sizeBytes)}
                      </Text>
                      <AuthButton
                        label="Open document"
                        variant="secondary"
                        disabled={documentBusy}
                        onPress={() => handleDocument(document)}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : isLoading ? (
          <>
            <View style={styles.skeletonHero}>
              <View style={styles.skeletonTile} />
              <View style={styles.skeletonBody}>
                <View style={styles.skeletonLineWide} />
                <View style={styles.skeletonLine} />
              </View>
            </View>
            <View style={styles.skeletonButton} />
            <View style={[styles.skeletonSection, { opacity: 0.7 }]} />
            <View style={[styles.skeletonSection, { opacity: 0.45 }]} />
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Appointment unavailable</Text>
            <Text style={styles.emptyBody}>
              It may have been removed or the link is wrong.
            </Text>
            <Pressable
              style={styles.emptyAction}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={styles.emptyActionText}>Go back</Text>
            </Pressable>
          </View>
        )}
      </Screen>

      <Modal
        visible={cancelOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setCancelOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View style={styles.modalSheetWrap}>
            <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>Cancel appointment</Text>
                  <Text style={styles.modalSubtitle}>
                    The provider is told right away. Any video link stops
                    working.
                  </Text>
                </View>
                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setCancelOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <FontAwesome6
                    name="xmark"
                    size={18}
                    color={tokens.colors.ink}
                  />
                </Pressable>
              </View>
              <TextInput
                value={cancelReason}
                onChangeText={setCancelReason}
                style={styles.textArea}
                placeholder="Reason (optional)"
                placeholderTextColor={tokens.colors.muted}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Reason for cancelling"
              />
              <View style={styles.modalFooter}>
                <AuthButton
                  label="Keep booking"
                  variant="secondary"
                  onPress={() => setCancelOpen(false)}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.dangerFilled,
                    pressed ? styles.pressed : null,
                  ]}
                  onPress={() => void handleCancel()}
                  disabled={busyAction === "cancel"}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busyAction === "cancel" }}
                >
                  <Text style={styles.dangerFilledText}>
                    {busyAction === "cancel"
                      ? "Cancelling…"
                      : "Cancel appointment"}
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
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setRescheduleOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View style={styles.modalSheetWrap}>
            <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>Reschedule</Text>
                  <Text style={styles.modalSubtitle}>
                    Now{" "}
                    {booking ? formatBookingDateLabel(booking.startsAt, businessTimezone) : ""}
                    {booking
                      ? ` at ${formatBookingTimeLabel(booking.startsAt, businessTimezone)}`
                      : ""}
                  </Text>
                </View>
                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setRescheduleOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <FontAwesome6
                    name="xmark"
                    size={18}
                    color={tokens.colors.ink}
                  />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.rescheduleContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.calendarCard}>
                  <View style={styles.calendarHeader}>
                    <Text style={styles.calendarTitle}>
                      {formatCalendarMonth(calendarMonth)}
                    </Text>
                    <View style={styles.monthControls}>
                      <Pressable
                        style={styles.monthButton}
                        onPress={() => stepMonth(-1)}
                        accessibilityRole="button"
                        accessibilityLabel="Previous month"
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
                        accessibilityRole="button"
                        accessibilityLabel="Next month"
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
                    {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
                      <Text
                        key={`${label}-${index}`}
                        style={styles.weekdayLabel}
                      >
                        {label}
                      </Text>
                    ))}
                  </View>

                  {monthAvailabilityLoading ? (
                    <View style={styles.calendarGrid}>
                      {calendarDays.map((day) => (
                        <View
                          key={day.value}
                          style={[styles.dayCell, styles.dayCellSkeleton]}
                        />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.calendarGrid}>
                      {calendarDays.map((day) => {
                        const daySummary = monthAvailabilityByDate.get(
                          day.value,
                        );
                        const isAvailable = Boolean(
                          day.inMonth && !day.isPast && daySummary,
                        );
                        const isSelected = day.isSelected && isAvailable;
                        return (
                          <Pressable
                            key={day.value}
                            style={[
                              styles.dayCell,
                              !day.inMonth ? styles.dayCellMuted : null,
                              isAvailable ? styles.dayCellAvailable : null,
                              isSelected ? styles.dayCellSelected : null,
                            ]}
                            disabled={!isAvailable}
                            accessibilityRole="button"
                            accessibilityState={{
                              disabled: !isAvailable,
                              selected: isSelected,
                            }}
                            accessibilityLabel={formatCalendarDate(day.value)}
                            onPress={() => {
                              setSelectedDate(day.value);
                              setSelectedSlotStartAt(null);
                              setError(null);
                            }}
                          >
                            <Text
                              style={[
                                styles.dayCellLabel,
                                isAvailable
                                  ? styles.dayCellLabelAvailable
                                  : null,
                                isSelected ? styles.dayCellLabelSelected : null,
                              ]}
                            >
                              {day.label}
                            </Text>
                            {daySummary && day.inMonth ? (
                              <View
                                style={[
                                  styles.dayDot,
                                  isSelected ? styles.dayDotSelected : null,
                                ]}
                              />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={styles.slotsBlock}>
                  <Text style={styles.slotsTitle}>
                    {formatCalendarDate(selectedDate)}
                  </Text>
                  {slotsLoading ? (
                    <View style={styles.slotGrid}>
                      {[0, 1, 2, 3].map((index) => (
                        <View
                          key={index}
                          style={[styles.slotChip, styles.slotChipSkeleton]}
                        />
                      ))}
                    </View>
                  ) : slots.length > 0 ? (
                    <View style={styles.slotGrid}>
                      {slots.map((slot) => {
                        const isSelected = slot.startAt === selectedSlotStartAt;
                        return (
                          <Pressable
                            key={slot.startAt}
                            style={[
                              styles.slotChip,
                              isSelected ? styles.slotChipSelected : null,
                            ]}
                            onPress={() => setSelectedSlotStartAt(slot.startAt)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={formatSlotLabel(slot, businessTimezone)}
                          >
                            <Text
                              style={[
                                styles.slotLabel,
                                isSelected ? styles.slotLabelSelected : null,
                              ]}
                            >
                              {formatSlotStart(slot, businessTimezone)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>No open times</Text>
                      <Text style={styles.emptyBody}>Pick another day.</Text>
                    </View>
                  )}
                  {selectedSlot ? (
                    <Text style={styles.slotSummary}>
                      New time: {formatSlotLabel(selectedSlot, businessTimezone)}
                      {(selectedSlot.staffOptions?.length ?? 0) > 1
                        ? ` · ${selectedSlot.staffOptions?.length} staff available`
                        : ""}
                    </Text>
                  ) : null}
                </View>

                {selectedSlot && booking?.customerPolicy ? (
                  <View style={styles.documentCopy}>
                    <Text style={styles.sectionTitle}>Deadlines for the new time</Text>
                    <Text style={styles.sectionBody}>Cancel by {new Date(Date.parse(selectedSlot.startAt) - (booking.customerPolicy.cancellationNoticeHours ?? 0) * 3600000).toLocaleString(undefined, { timeZone: businessTimezone })}</Text>
                    <Text style={styles.sectionBody}>Reschedule by {new Date(Date.parse(selectedSlot.startAt) - (booking.customerPolicy.rescheduleNoticeHours ?? 0) * 3600000).toLocaleString(undefined, { timeZone: businessTimezone })}</Text>
                    <Text style={styles.sectionBody}>{businessTimezone}. Your original price and currency stay the same.</Text>
                  </View>
                ) : null}

                <TextInput
                  value={rescheduleReason}
                  onChangeText={setRescheduleReason}
                  style={styles.textArea}
                  placeholder="Note for the provider (optional)"
                  placeholderTextColor={tokens.colors.muted}
                  multiline
                  textAlignVertical="top"
                  accessibilityLabel="Note for the provider"
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <AuthButton
                  label={
                    busyAction === "reschedule" ? "Saving…" : "Confirm new time"
                  }
                  disabled={!selectedSlotStartAt || busyAction === "reschedule"}
                  loading={busyAction === "reschedule"}
                  onPress={() => void handleReschedule()}
                />
                <AuthButton
                  label="Keep current time"
                  variant="secondary"
                  onPress={() => setRescheduleOpen(false)}
                />
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
  headerAction: {
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
  headerActionText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontFamily: tokens.font.semibold,
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
  heroCard: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 12,
  },
  heroCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  dateTile: {
    width: 60,
    minHeight: 68,
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
    fontSize: 22,
    lineHeight: 26,
    fontFamily: tokens.font.display,
  },
  heroCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  heroCardTitle: {
    color: tokens.colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: tokens.font.display,
    letterSpacing: -0.3,
  },
  heroCardMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  heroPills: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  statusPill: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    paddingVertical: 5,
  },
  livePillText: {
    color: tokens.colors.inkDeep,
    fontSize: 12,
    fontFamily: tokens.font.bold,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
  },
  pressed: {
    opacity: 0.8,
  },
  dangerGhost: {
    minHeight: 48,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: "#f3c4c4",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  dangerGhostText: {
    color: tokens.colors.danger,
    fontSize: 16,
    fontFamily: tokens.font.bold,
  },
  dangerFilled: {
    minHeight: 56,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  dangerFilledText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: tokens.font.bold,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 6,
  },
  sectionDanger: {
    borderColor: "#f3c4c4",
    backgroundColor: tokens.colors.dangerSoft,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  sectionTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.display,
    letterSpacing: -0.2,
  },
  sectionTitleDanger: {
    color: tokens.colors.danger,
  },
  sectionValue: {
    color: tokens.colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: tokens.font.semibold,
  },
  sectionCaption: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
  },
  sectionBody: {
    color: tokens.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: tokens.font.regular,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  paymentAmount: {
    color: tokens.colors.ink,
    fontSize: 17,
    fontFamily: tokens.font.display,
    letterSpacing: -0.3,
  },
  documentRow: {
    paddingVertical: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  documentCopy: {
    gap: 2,
  },
  documentLabel: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.semibold,
  },
  documentMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  skeletonHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: tokens.radius.lg,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  skeletonTile: {
    width: 60,
    height: 68,
    borderRadius: 12,
    backgroundColor: tokens.colors.border,
  },
  skeletonBody: {
    flex: 1,
    gap: 10,
  },
  skeletonLineWide: {
    height: 16,
    width: "75%",
    borderRadius: 8,
    backgroundColor: tokens.colors.border,
  },
  skeletonLine: {
    height: 12,
    width: "50%",
    borderRadius: 6,
    backgroundColor: tokens.colors.border,
  },
  skeletonButton: {
    height: 56,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.border,
    opacity: 0.85,
  },
  skeletonSection: {
    height: 88,
    borderRadius: 16,
    backgroundColor: tokens.colors.border,
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
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(16,39,72,0.45)",
  },
  modalSheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    width: "100%",
    maxHeight: "92%",
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    backgroundColor: tokens.colors.surface,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.borderStrong,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  modalTitle: {
    color: tokens.colors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontFamily: tokens.font.display,
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  textArea: {
    minHeight: 96,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    color: tokens.colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: tokens.font.regular,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalScroll: {
    flexGrow: 0,
  },
  rescheduleContent: {
    gap: 14,
    paddingBottom: 8,
  },
  modalFooter: {
    gap: 10,
  },
  calendarCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 10,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  calendarTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.display,
    letterSpacing: -0.2,
  },
  monthControls: {
    flexDirection: "row",
    gap: 6,
  },
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.surfaceSoft,
  },
  weekdayRow: {
    flexDirection: "row",
  },
  weekdayLabel: {
    width: "14.285%",
    textAlign: "center",
    color: tokens.colors.muted,
    fontSize: 12,
    fontFamily: tokens.font.semibold,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.285%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: tokens.radius.sm,
  },
  dayCellSkeleton: {
    transform: [{ scale: 0.7 }],
    backgroundColor: tokens.colors.border,
    opacity: 0.6,
  },
  dayCellMuted: {
    opacity: 0.3,
  },
  dayCellAvailable: {
    backgroundColor: tokens.colors.surfaceSoft,
  },
  dayCellSelected: {
    backgroundColor: tokens.colors.inkDeep,
  },
  dayCellLabel: {
    color: tokens.colors.mutedSoft,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  dayCellLabelAvailable: {
    color: tokens.colors.ink,
  },
  dayCellLabelSelected: {
    color: "#ffffff",
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
  },
  dayDotSelected: {
    backgroundColor: tokens.colors.brand,
  },
  slotsBlock: {
    gap: 10,
  },
  slotsTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.display,
    letterSpacing: -0.2,
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotChip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  slotChipSkeleton: {
    width: 84,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.border,
    opacity: 0.6,
  },
  slotChipSelected: {
    backgroundColor: tokens.colors.inkDeep,
    borderColor: tokens.colors.inkDeep,
  },
  slotLabel: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  slotLabelSelected: {
    color: "#ffffff",
  },
  slotSummary: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
  },
});

import type {
  BookingMeetingRecord,
  CustomerBookingRecord,
} from "@/src/lib/api/types";

export function formatBookingDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatBookingDateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatBookingTimeLabel(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatBookingMoney(amount: number, currency?: string) {
  if (!currency) return "Currency unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export function formatMeetingProvider(
  provider: BookingMeetingRecord["provider"],
) {
  if (provider === "ZOOM") {
    return "Zoom";
  }

  if (provider === "GOOGLE_MEET") {
    return "Google Meet";
  }

  return "Video session";
}

export function hasActiveMeetingLink(
  meeting: BookingMeetingRecord | null | undefined,
) {
  return Boolean(meeting?.status === "ACTIVE" && meeting.joinUrl);
}

export function formatSecureDocumentSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function canCancelBooking(booking: CustomerBookingRecord) {
  return (
    ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(booking.status) &&
    (!booking.customerPolicy ||
      new Date(booking.customerPolicy.changeDeadline).getTime() >= Date.now())
  );
}

export function canRescheduleBooking(booking: CustomerBookingRecord) {
  return (
    ["PENDING", "CONFIRMED"].includes(booking.status) &&
    (!booking.customerPolicy ||
      new Date(booking.customerPolicy.changeDeadline).getTime() >=
        Date.now()) &&
    new Date(booking.startsAt).getTime() > Date.now()
  );
}

export function isBookingLiveNow(booking: CustomerBookingRecord) {
  const now = Date.now();
  return (
    booking.status !== "CANCELLED" &&
    booking.status !== "COMPLETED" &&
    new Date(booking.startsAt).getTime() <= now &&
    new Date(booking.endsAt).getTime() > now
  );
}

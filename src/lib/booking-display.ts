import type {
  BookingMeetingRecord,
  CustomerBookingRecord,
} from "@/src/lib/api/types";

export function formatBookingDateTime(value: string, timeZone?: string) {
  return new Date(value).toLocaleString(undefined, {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatBookingDateLabel(value: string, timeZone?: string) {
  return new Date(value).toLocaleDateString(undefined, {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatBookingTimeLabel(value: string, timeZone?: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    timeZone,
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
  const policy = booking.customerPolicy;
  return ['PENDING', 'CONFIRMED'].includes(booking.status) && Boolean(policy && !policy.requiresReview && policy.canCancel !== false && Date.now() < new Date(policy.cancellationDeadline ?? policy.changeDeadline).getTime());
}

export function canRescheduleBooking(booking: CustomerBookingRecord) {
  const policy = booking.customerPolicy;
  return ['PENDING', 'CONFIRMED'].includes(booking.status) && Boolean(policy && !policy.requiresReview && policy.canReschedule !== false && Date.now() < new Date(policy.rescheduleDeadline ?? policy.changeDeadline).getTime());
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

import { mobileEnv } from "@/src/lib/mobile-env";
import { requestJson } from "@/src/lib/api/client";
import type {
  CustomerBookingRecord,
  MessageResponseData,
  PublicAvailabilityMonthResponse,
  PublicAvailabilityResponse,
  RescheduleCustomerBookingPayload,
} from "@/src/lib/api/types";

const bookingsUrl = `${mobileEnv.bookingApiUrl}/bookings`;

export type CreatedMobileBooking = { id: string; payment?: { method?: string; authorizationUrl?: string; message?: string } | null };

export function createCustomerBooking(payload: { providerId: string; serviceId: string; startsAt: string; firstName: string; lastName?: string; email?: string; phone?: string; assignedStaffId?: string; locationId?: string; channel?: string; notes?: string; intakeResponses?: Array<Record<string, unknown>>; requestedDocumentLabels?: string[] }) {
  return requestJson<CreatedMobileBooking>(`${bookingsUrl}/customer`, { method: "POST", auth: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `?${query}` : "";
}

export function listCustomerBookings() {
  return requestJson<CustomerBookingRecord[]>(`${bookingsUrl}/customer`, {
    method: "GET",
    auth: true,
  });
}

export function getCustomerBooking(bookingId: string) {
  return requestJson<CustomerBookingRecord>(`${bookingsUrl}/customer/${bookingId}`, {
    method: "GET",
    auth: true,
  });
}

export function getPublicBookingAvailability(params: {
  providerId: string;
  serviceId: string;
  date: string;
  locationId?: string;
  staffMemberId?: string;
  slotIntervalMinutes?: number;
}) {
  return requestJson<PublicAvailabilityResponse>(
    `${bookingsUrl}/availability/public${buildQuery(params)}`,
    {
      method: "GET",
      auth: true,
    },
  );
}

export function getPublicBookingAvailabilityMonth(params: {
  providerId: string;
  serviceId: string;
  month: string;
  locationId?: string;
  staffMemberId?: string;
  slotIntervalMinutes?: number;
}) {
  return requestJson<PublicAvailabilityMonthResponse>(
    `${bookingsUrl}/availability/public/month${buildQuery(params)}`,
    {
      method: "GET",
      auth: true,
    },
  );
}

export function cancelCustomerBooking(bookingId: string, reason?: string) {
  return requestJson<MessageResponseData>(`${bookingsUrl}/${bookingId}/cancel`, {
    method: "PATCH",
    auth: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  }).then(() => getCustomerBooking(bookingId));
}

export function rescheduleCustomerBooking(
  bookingId: string,
  payload: RescheduleCustomerBookingPayload,
) {
  return requestJson<CustomerBookingRecord>(
    `${bookingsUrl}/customer/${bookingId}/reschedule`,
    {
      method: "PATCH",
      auth: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}

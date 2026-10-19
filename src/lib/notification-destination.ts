import type { InboxNotification } from "@/src/lib/api/types";

export function notificationDestination(item: InboxNotification) {
  if (!item.actionUrl) return null;
  try {
    const url = new URL(item.actionUrl, "https://www.bookmiz.com");
    if (url.protocol !== "https:" || !["bookmiz.com", "www.bookmiz.com"].includes(url.hostname) || url.port || url.username || url.password) return null;
    const path = url.pathname;
    const booking = url.searchParams.get("booking") || url.searchParams.get("bookingId");
    if (/^\/customer\/(appointments|bookings)\/?$/.test(path)) return { route: booking && /^[0-9a-f-]{36}$/i.test(booking) ? `/appointments/${booking}` : "/appointments", label: "View booking", native: true };
    if (/^\/customer\/(quotes|requests|service-request)\/?$/.test(path)) {
      const requestId = url.searchParams.get("quoteRequestId") || url.searchParams.get("requestId");
      return { route: `/(tabs)/workbench${requestId ? `?requestId=${encodeURIComponent(requestId)}` : ""}`, label: "View request", native: true };
    }
    if (/^\/customer\/(settings|account)\/?$/.test(path)) return { route: "/(tabs)/account", label: "View account", native: true };
    const provider = path.match(/^\/marketplace\/providers\/([a-z0-9-]+)\/?$/i);
    if (provider) return { route: `/providers/${encodeURIComponent(provider[1]!)}`, label: "View provider", native: true };
    return { route: url.toString(), label: "Open BookMiz website", native: false };
  } catch { return null; }
}

export function notificationCategory(eventKey: string) {
  if (/quote|request|match|conversation/.test(eventKey)) return { label: "Service request", icon: "comments" as const };
  if (/booking|appointment/.test(eventKey)) return { label: "Booking update", icon: "calendar-check" as const };
  if (/payout|payment|refund/.test(eventKey)) return { label: "Payment update", icon: "wallet" as const };
  if (/security|account|auth/.test(eventKey)) return { label: "Account update", icon: "shield-halved" as const };
  return { label: "BookMiz update", icon: "bell" as const };
}

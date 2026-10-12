import { mobileEnv } from "@/src/lib/mobile-env";
import { requestJson } from "@/src/lib/api/client";
import type { InboxResponse, MessageResponseData } from "@/src/lib/api/types";

const notificationsUrl = `${mobileEnv.bookingApiUrl}/notifications`;

export function listInboxNotifications(options?: {
  limit?: number;
  unreadOnly?: boolean;
}) {
  const search = new URLSearchParams();

  if (options?.limit) {
    search.set("limit", String(options.limit));
  }

  if (options?.unreadOnly) {
    search.set("unreadOnly", "true");
  }

  const query = search.toString();

  return requestJson<InboxResponse>(
    `${notificationsUrl}/inbox${query ? `?${query}` : ""}`,
    {
      method: "GET",
      auth: true,
    },
  );
}

export function markInboxNotificationRead(notificationId: string) {
  return requestJson<MessageResponseData>(
    `${notificationsUrl}/inbox/${notificationId}/read`,
    {
      method: "POST",
      auth: true,
    },
  );
}

export function markAllInboxNotificationsRead() {
  return requestJson<MessageResponseData>(
    `${notificationsUrl}/inbox/read-all`,
    {
      method: "POST",
      auth: true,
    },
  );
}

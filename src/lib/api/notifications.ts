import { mobileEnv } from "@/src/lib/mobile-env";
import { requestJson } from "@/src/lib/api/client";
import type {
  InboxNotification,
  InboxResponse,
  MessageResponseData,
} from "@/src/lib/api/types";

const notificationsUrl = `${mobileEnv.bookingApiUrl}/notifications`;
export function getInboxNotification(id: string) {
  return requestJson<InboxNotification>(
    `${notificationsUrl}/inbox/${encodeURIComponent(id)}`,
    { auth: true },
  );
}
export function registerPushDevice(
  token: string,
  platform: string,
  accessToken?: string,
) {
  return requestJson(`${notificationsUrl}/push-device`, {
    method: "POST",
    auth: !accessToken,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ token, platform }),
  });
}
export function unregisterPushDevice(
  token: string,
  platform: string,
  accessToken?: string,
) {
  return requestJson(`${notificationsUrl}/push-device`, {
    method: "DELETE",
    auth: !accessToken,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ token, platform }),
  });
}

export function listInboxNotifications(options?: {
  limit?: number;
  unreadOnly?: boolean;
  cursor?: string;
}) {
  const search = new URLSearchParams();

  if (options?.limit) {
    search.set("limit", String(options.limit));
  }

  if (options?.unreadOnly) {
    search.set("unreadOnly", "true");
  }

  if (options?.cursor) search.set("cursor", options.cursor);
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

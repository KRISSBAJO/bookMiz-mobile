import { useFocusEffect } from "expo-router/react-navigation";
import { FontAwesome6 } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/src/components/Screen";
import { SectionHeader } from "@/src/components/SectionHeader";
import {
  listInboxNotifications,
  markAllInboxNotificationsRead,
  markInboxNotificationRead,
} from "@/src/lib/api/notifications";
import type { InboxNotification } from "@/src/lib/api/types";
import { tokens } from "@/src/theme/tokens";

function formatDateLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function InboxScreen() {
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const inbox = await listInboxNotifications({ limit: 20 });
      setNotifications(inbox.items);
      setUnreadCount(inbox.unreadCount);
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "We could not load your inbox right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadInbox();
    }, [loadInbox]),
  );

  const handleMarkAllRead = useCallback(async () => {
    await markAllInboxNotificationsRead();
    await loadInbox();
  }, [loadInbox]);

  const handleMarkRead = useCallback(async (notificationId: string) => {
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      await markInboxNotificationRead(notificationId);
    } catch {
      await loadInbox();
    }
  }, [loadInbox]);

  return (
    <Screen
      eyebrow="Inbox"
      title="Everything that needs a reply"
      subtitle="Live notifications from requests, bookings, and account activity."
    >
      <View style={styles.panel}>
        <SectionHeader
          title="Notification center"
          subtitle={`${unreadCount} unread ${unreadCount === 1 ? "update" : "updates"} waiting in your live inbox.`}
        />
        <AuthActions unreadCount={unreadCount} onMarkAllRead={handleMarkAllRead} />

        {notifications.map((notification) => (
          <Pressable
            key={notification.id}
            style={styles.card}
            onPress={() =>
              notification.readAt ? undefined : void handleMarkRead(notification.id)
            }
          >
            <View style={styles.iconWrap}>
              <FontAwesome6
                name={notification.readAt ? "bell" : "bell-concierge"}
                size={16}
                color={tokens.colors.ink}
              />
            </View>
            <View style={styles.body}>
              <View style={styles.headlineRow}>
                <Text style={styles.title}>{notification.title}</Text>
                {!notification.readAt ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text style={styles.message}>{notification.body}</Text>
              <Text style={styles.time}>{formatDateLabel(notification.createdAt)}</Text>
            </View>
          </Pressable>
        ))}

        {!isLoading && notifications.length === 0 ? (
          <Text style={styles.emptyText}>Your inbox is quiet right now.</Text>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {isLoading ? <Text style={styles.loadingText}>Refreshing your live inbox…</Text> : null}
    </Screen>
  );
}

function AuthActions({
  unreadCount,
  onMarkAllRead,
}: {
  unreadCount: number;
  onMarkAllRead: () => void | Promise<void>;
}) {
  if (unreadCount === 0) {
    return null;
  }

  return (
    <Pressable style={styles.markAllButton} onPress={onMarkAllRead}>
      <Text style={styles.markAllButtonText}>Mark all as read</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
    gap: 14,
  },
  markAllButton: {
    alignSelf: "flex-start",
    borderRadius: tokens.radius.pill,
    backgroundColor: "#eef3fb",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  markAllButtonText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  card: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: tokens.colors.surfaceSoft,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecf8d1",
  },
  body: {
    flex: 1,
    gap: 7,
  },
  headlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: tokens.colors.brand,
  },
  message: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  time: {
    color: tokens.colors.mutedSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyText: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  errorText: {
    color: "#d44c3f",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  loadingText: {
    color: tokens.colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
});

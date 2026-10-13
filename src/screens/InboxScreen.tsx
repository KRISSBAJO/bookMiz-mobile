import { useFocusEffect } from "expo-router/react-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

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

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initialsFor(value: string) {
  const letters = value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "B";
}

function SkeletonRows() {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.list}>
      {[0, 1, 2].map((index) => (
        <Animated.View key={index} style={[styles.row, { opacity }]}>
          <View style={[styles.avatar, styles.skeletonBlock]} />
          <View style={styles.body}>
            <View style={[styles.skeletonBlock, styles.skeletonLineShort]} />
            <View style={[styles.skeletonBlock, styles.skeletonLine]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
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
      title="Inbox"
      showBack={false}
      refreshing={isLoading && notifications.length > 0}
      onRefresh={() => void loadInbox()}
      subtitle={
        unreadCount > 0
          ? `${unreadCount} unread ${unreadCount === 1 ? "message" : "messages"}`
          : "Updates from requests, bookings and your account."
      }
    >
      <SectionHeader
        title="Messages"
        actionLabel={unreadCount > 0 ? "Mark all read" : undefined}
        onAction={unreadCount > 0 ? () => void handleMarkAllRead() : undefined}
      />

      {isLoading && notifications.length === 0 ? <SkeletonRows /> : null}

      {notifications.length > 0 ? (
        <View style={styles.list}>
          {notifications.map((notification) => {
            const unread = !notification.readAt;
            return (
              <Pressable
                key={notification.id}
                accessibilityRole="button"
                accessibilityLabel={`${notification.title}${unread ? ", unread" : ""}`}
                style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
                onPress={() =>
                  notification.readAt ? undefined : void handleMarkRead(notification.id)
                }
              >
                <View style={[styles.avatar, unread ? styles.avatarUnread : null]}>
                  <Text style={[styles.avatarText, unread ? styles.avatarTextUnread : null]}>
                    {initialsFor(notification.title)}
                  </Text>
                </View>
                <View style={styles.body}>
                  <View style={styles.headlineRow}>
                    <Text
                      style={[styles.title, unread ? styles.titleUnread : null]}
                      numberOfLines={1}
                    >
                      {notification.title}
                    </Text>
                    <Text style={styles.time}>{formatDateLabel(notification.createdAt)}</Text>
                  </View>
                  <View style={styles.messageRow}>
                    <Text style={styles.message} numberOfLines={2}>
                      {notification.body}
                    </Text>
                    {unread ? <View style={styles.unreadDot} /> : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!isLoading && notifications.length === 0 && !error ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyBody}>Replies to your requests and booking updates land here.</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
          <Pressable onPress={() => void loadInbox()} accessibilityRole="button">
            <Text style={styles.errorRetry}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: tokens.colors.surfaceSoft,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarUnread: {
    backgroundColor: tokens.colors.inkDeep,
    borderColor: tokens.colors.inkDeep,
  },
  avatarText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.bold,
  },
  avatarTextUnread: {
    color: "#ffffff",
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  headlineRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  title: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.semibold,
  },
  titleUnread: {
    fontFamily: tokens.font.bold,
  },
  time: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontFamily: tokens.font.medium,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  message: {
    flex: 1,
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.colors.brand,
  },
  skeletonBlock: {
    backgroundColor: tokens.colors.border,
    borderWidth: 0,
  },
  skeletonLineShort: {
    height: 14,
    width: "55%",
    borderRadius: 7,
  },
  skeletonLine: {
    height: 12,
    width: "90%",
    borderRadius: 6,
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
});

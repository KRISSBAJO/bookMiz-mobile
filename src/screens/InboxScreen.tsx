import { useFocusEffect } from "expo-router/react-navigation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome6 } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthButton } from "@/src/components/auth/AuthButton";
import { notificationCategory, notificationDestination } from "@/src/lib/notification-destination";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  DeviceEventEmitter,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Screen } from "@/src/components/Screen";
import { SectionHeader } from "@/src/components/SectionHeader";
import {
  listInboxNotifications,
  markAllInboxNotificationsRead,
  markInboxNotificationRead,
  getInboxNotification,
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
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
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
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
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
  const router = useRouter();
  const [detailError, setDetailError] = useState<string | null>(null);
  const { notificationId } = useLocalSearchParams<{
    notificationId?: string;
  }>();
  const [opened, setOpened] = useState<InboxNotification | null>(null);
  const cursorRef = useRef<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const loadingRef = useRef(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = useCallback(async (append = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setError(null);
      setIsLoading(true);
      const inbox = await listInboxNotifications({
        limit: 20,
        cursor: append ? (cursorRef.current ?? undefined) : undefined,
      });
      setNotifications((current) =>
        append
          ? [
              ...current,
              ...inbox.items.filter(
                (item) => !current.some((existing) => existing.id === item.id),
              ),
            ]
          : inbox.items,
      );
      cursorRef.current = inbox.nextCursor ?? null;
      setHasMore(Boolean(inbox.nextCursor));
      setUnreadCount(inbox.unreadCount);
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "We could not load your inbox right now.";
      setError(message);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadInbox();
    }, [loadInbox]),
  );

  const handleMarkAllRead = useCallback(async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await markAllInboxNotificationsRead();
      await loadInbox();
    } catch {
      setError("Could not mark notifications as read. Please try again.");
    } finally {
      setMarkingAll(false);
    }
  }, [loadInbox, markingAll]);
  useEffect(() => {
    const listener = DeviceEventEmitter.addListener("bookmiz-inbox-updated", () => { void loadInbox(); });
    return () => listener.remove();
  }, [loadInbox]);

  const handleMarkRead = useCallback(
    async (notificationId: string) => {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId
            ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
            : item,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));

      try {
        await markInboxNotificationRead(notificationId);
      } catch {
        setDetailError("Could not mark this update as read. Your message is still available.");
        await loadInbox();
      }
    },
    [loadInbox],
  );

  useEffect(() => {
    if (!notificationId) return;
    let active = true;
    void getInboxNotification(notificationId)
      .then((item) => {
        if (active) {
          setOpened(item);
          setDetailError(null);
          if (!item.readAt) void handleMarkRead(item.id);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "This notification is no longer available for your account.",
          );
      });
    return () => {
      active = false;
    };
  }, [notificationId]);

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
                style={({ pressed }) => [
                  styles.row,
                  pressed ? styles.rowPressed : null,
                ]}
                onPress={() => {
                  setDetailError(null);
                  setOpened(notification);
                  if (!notification.readAt)
                    void handleMarkRead(notification.id);
                }}
              >
                <View
                  style={[styles.avatar, unread ? styles.avatarUnread : null]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      unread ? styles.avatarTextUnread : null,
                    ]}
                  >
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
                    <Text style={styles.time}>
                      {formatDateLabel(notification.createdAt)}
                    </Text>
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

      {hasMore ? (
        <Pressable
          accessibilityRole="button"
          disabled={isLoading}
          onPress={() => void loadInbox(true)}
        >
          <Text style={styles.errorRetry}>Load older notifications</Text>
        </Pressable>
      ) : null}
      <Modal
        visible={Boolean(opened)}
        animationType="slide"
        onRequestClose={() => setOpened(null)}
      >
        <SafeAreaView style={styles.detailSafe}>
          <View style={styles.detailShell}>
            <View style={styles.detailHeader}>
              <Pressable accessibilityRole="button" accessibilityLabel="Close notification" style={styles.detailBack} onPress={() => setOpened(null)}><FontAwesome6 name="arrow-left" size={18} color={tokens.colors.ink} /></Pressable>
              <View><Text style={styles.detailEyebrow}>INBOX</Text><Text style={styles.detailHeaderTitle}>Notification</Text></View>
            </View>
            <ScrollView contentContainerStyle={styles.detailContent}>
              <View style={styles.detailCard}>
                <View style={styles.detailIcon}><FontAwesome6 name={notificationCategory(opened?.eventKey ?? "").icon} size={24} color={tokens.colors.inkDeep} /></View>
                <Text style={styles.detailCategory}>{notificationCategory(opened?.eventKey ?? "").label}</Text>
                <Text accessibilityRole="header" style={styles.detailTitle}>{opened?.title}</Text>
                <View style={styles.detailDate}><FontAwesome6 name="clock" size={12} color={tokens.colors.muted} /><Text style={styles.time}>{opened ? new Date(opened.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</Text></View>
                <View style={styles.detailDivider} />
                <Text selectable style={styles.detailBody}>{opened?.body}</Text>
              </View>
              {detailError ? <Text accessibilityRole="alert" style={styles.errorText}>{detailError}</Text> : null}
            </ScrollView>
            <View style={styles.detailFooter}>
              {opened && notificationDestination(opened) ? <AuthButton label={notificationDestination(opened)!.label} icon="arrow-right" variant="navy" onPress={async () => {
                const destination = notificationDestination(opened);
                if (!destination) return;
                try {
                  if (destination.native) { setOpened(null); router.push(destination.route as never); }
                  else await Linking.openURL(destination.route);
                } catch { setDetailError("Could not open this update. Please try again."); }
              }} /> : <AuthButton label="Back to Inbox" variant="secondary" onPress={() => setOpened(null)} />}
            </View>
          </View>
        </SafeAreaView>
      </Modal>
      {!isLoading && notifications.length === 0 && !error ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyBody}>
            Replies to your requests and booking updates land here.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
          <Pressable
            onPress={() => void loadInbox()}
            accessibilityRole="button"
          >
            <Text style={styles.errorRetry}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  detailSafe: { flex: 1, backgroundColor: tokens.colors.surface },
  detailShell: { flex: 1, width: "100%", maxWidth: 720, alignSelf: "center" },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.colors.border },
  detailBack: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff", borderRadius: 15 },
  detailEyebrow: { color: tokens.colors.muted, fontFamily: tokens.font.semibold, fontSize: 10, letterSpacing: 1 },
  detailHeaderTitle: { color: tokens.colors.ink, fontFamily: tokens.font.semibold, fontSize: 17 },
  detailContent: { padding: 20, gap: 16 },
  detailCard: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 22, padding: 24, gap: 14 },
  detailIcon: { width: 60, height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tokens.colors.brandSoft },
  detailCategory: { color: tokens.colors.muted, fontFamily: tokens.font.medium, fontSize: 12 },
  detailTitle: { color: tokens.colors.ink, fontFamily: tokens.font.semibold, fontSize: 22, lineHeight: 29 },
  detailDate: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailDivider: { height: 1, backgroundColor: tokens.colors.border, marginVertical: 6 },
  detailBody: { color: tokens.colors.ink, fontFamily: tokens.font.regular, fontSize: 15, lineHeight: 25 },
  detailFooter: { padding: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.colors.border, backgroundColor: "#ffffff" },
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

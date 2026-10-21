import { inboxDay, inboxPresentation } from '../lib/inbox-presentation';
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
  const requestVersion = useRef(0), pendingReads = useRef(new Set<string>()), readVersion = useRef(0), locallyRead = useRef(new Map<string,string>());
  const [filter,setFilter] = useState<'ALL'|'UNREAD'|'MESSAGES'|'BOOKINGS'|'PAYMENTS'>('ALL');
  const [markingAll, setMarkingAll] = useState(false);
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = useCallback(async (append = false) => {
    if (append && loadingRef.current) return;
    const version = ++requestVersion.current, readsAtStart = readVersion.current;
    loadingRef.current = true;
    try {
      setError(null);
      setIsLoading(true);
      const inbox = await listInboxNotifications({
        limit: 20,
        unreadOnly: filter === "UNREAD",
        category: ["MESSAGES","BOOKINGS","PAYMENTS"].includes(filter) ? filter as "MESSAGES"|"BOOKINGS"|"PAYMENTS" : undefined,
        cursor: append ? (cursorRef.current ?? undefined) : undefined,
      });
      if(version !== requestVersion.current)return;
      const items=inbox.items.map(item=>locallyRead.current.has(item.id)?{...item,readAt:item.readAt??locallyRead.current.get(item.id)!}:item).filter(item=>filter!=='UNREAD'||!item.readAt);
      setNotifications((current) =>
        append
          ? [
              ...current,
              ...items.filter(
                (item) => !current.some((existing) => existing.id === item.id),
              ),
            ]
          : items,
      );
      cursorRef.current = inbox.nextCursor ?? null;
      setHasMore(Boolean(inbox.nextCursor));
      if(readsAtStart === readVersion.current)setUnreadCount(inbox.unreadCount);
    } catch (nextError) {
      if(version !== requestVersion.current)return;
      const message =
        nextError instanceof Error
          ? nextError.message
          : "We could not load your inbox right now.";
      setError(message);
    } finally {
      if(version === requestVersion.current){setIsLoading(false);loadingRef.current = false;}
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void loadInbox();
      return () => {requestVersion.current++;loadingRef.current=false;};
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
      if(pendingReads.current.has(notificationId))return;
      pendingReads.current.add(notificationId);readVersion.current++;locallyRead.current.set(notificationId,new Date().toISOString());
      if(locallyRead.current.size>500)locallyRead.current.delete(locallyRead.current.keys().next().value!);
      setNotifications((current) =>
        filter === "UNREAD" ? current.filter(item=>item.id!==notificationId) : current.map((item) =>
          item.id === notificationId
            ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
            : item,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));

      try {
        const result=await markInboxNotificationRead(notificationId);
        if(typeof result?.unreadCount === "number")setUnreadCount(result.unreadCount);
      } catch {
        locallyRead.current.delete(notificationId);
        setDetailError("Could not mark this update as read. Your message is still available.");
        await loadInbox();
      } finally {pendingReads.current.delete(notificationId);}
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
      subtitle="Conversations and activity, in one place."
      heroContent={<View style={styles.summary}><View style={styles.summaryIcon}><FontAwesome6 name="inbox" size={22} color={tokens.colors.brand}/></View><View style={styles.body}><Text style={styles.summaryTitle}>{unreadCount ? `${unreadCount} unread updates` : 'You’re all caught up'}</Text><Text style={styles.summaryMeta}>Messages, bookings and payments</Text></View>{unreadCount>0?<Pressable accessibilityRole="button" accessibilityLabel="Mark all updates read" disabled={markingAll} onPress={()=>void handleMarkAllRead()} style={styles.markAll}><FontAwesome6 name="check-double" size={16} color="#fff"/><Text style={styles.markAllText}>{markingAll?'Saving…':'Read all'}</Text></Pressable>:null}</View>}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
       {(['ALL','UNREAD','MESSAGES','BOOKINGS','PAYMENTS'] as const).map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:filter===value}} accessibilityLabel={`Show ${value.toLowerCase()} updates`} style={[styles.filter,filter===value?styles.filterSelected:null]} onPress={()=>{if(value!==filter){setNotifications([]);setFilter(value);}}}><Text style={[styles.filterText,filter===value?styles.filterTextSelected:null]}>{value==='ALL'?'All updates':value[0]+value.slice(1).toLowerCase()}</Text></Pressable>)}
      </ScrollView>

      {isLoading && notifications.length === 0 ? <SkeletonRows /> : null}

      {notifications.length > 0 ? (
        <View style={styles.list}>
          {notifications.map((notification,index) => {
            const unread=!notification.readAt, presentation=inboxPresentation(notification), day=inboxDay(notification.createdAt);
            const first=index===0 || inboxDay(notifications[index-1].createdAt)!==day;
            const last=index===notifications.length-1 || inboxDay(notifications[index+1].createdAt)!==day;
            return <View key={notification.id}>
              {first?<Text accessibilityRole="header" style={styles.dayHeading}>{day}</Text>:null}
              <Pressable accessibilityRole="button" accessibilityLabel={`${notification.title}${unread?', unread':''}`} style={({pressed})=>[styles.row,first?styles.rowFirst:null,last?styles.rowLast:null,unread?styles.rowUnread:null,pressed?styles.rowPressed:null]} onPress={()=>{setDetailError(null);setOpened(notification);if(unread)void handleMarkRead(notification.id);}}>
                <View style={[styles.avatar,{backgroundColor:presentation.tint}]}><FontAwesome6 name={presentation.icon} size={19} color={presentation.color}/></View>
                <View style={styles.body}>
                  <View style={styles.headlineRow}><Text style={[styles.category,{color:presentation.color}]}>{presentation.kind}</Text><Text style={styles.time}>{formatDateLabel(notification.createdAt)}</Text></View>
                  <Text style={[styles.title,unread?styles.titleUnread:null]} numberOfLines={2}>{presentation.title}</Text>
                  {presentation.source?<Text style={styles.source} numberOfLines={1}>{presentation.source}</Text>:null}
                  <Text style={styles.message} numberOfLines={2}>{presentation.preview}</Text>
                </View>
                <View style={styles.rowEnd}>{unread?<View style={styles.unreadDot}/>:null}<FontAwesome6 name="chevron-right" size={10} color={tokens.colors.mutedSoft}/></View>
              </Pressable>
            </View>;
          })}
        </View>
      ) : null}

      {hasMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Load older updates"
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
          <View style={styles.emptyIcon}><FontAwesome6 name="inbox" size={28} color={tokens.colors.inkDeep}/></View>
          <Text style={styles.emptyTitle}>{filter === "UNREAD" ? "All caught up" : filter === "ALL" ? "Your inbox starts here" : `No ${filter.toLowerCase()} updates yet`}</Text>
          <Text style={styles.emptyBody}>
            {filter === "UNREAD" ? "You have read all your updates. Check All updates for your history." : "Updates appear here as you book, message businesses and make payments."}
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
  summary:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:tokens.colors.inkDeep,borderRadius:22,padding:18,flexWrap:'wrap'},
  summaryIcon:{width:44,height:44,borderRadius:15,backgroundColor:tokens.colors.navySoft,alignItems:'center',justifyContent:'center'},summaryTitle:{color:'#fff',fontSize:17,fontFamily:tokens.font.bold},summaryMeta:{color:tokens.colors.onNavyMuted,fontSize:12,fontFamily:tokens.font.regular},
  markAll:{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:12,paddingHorizontal:5},markAllText:{color:'#fff',fontSize:12,fontFamily:tokens.font.semibold},
  filters:{gap:8,paddingVertical:4},filter:{minHeight:40,paddingHorizontal:15,paddingVertical:10,borderRadius:20,backgroundColor:'#fff',borderWidth:1,borderColor:tokens.colors.border},filterSelected:{backgroundColor:tokens.colors.inkDeep,borderColor:tokens.colors.inkDeep},filterText:{fontFamily:tokens.font.medium,color:tokens.colors.muted,fontSize:13},filterTextSelected:{color:'#fff'},
  dayHeading:{fontFamily:tokens.font.semibold,color:tokens.colors.muted,fontSize:12,letterSpacing:0.4,marginTop:18,marginBottom:10},
  rowFirst:{borderTopLeftRadius:20,borderTopRightRadius:20},rowLast:{borderBottomLeftRadius:20,borderBottomRightRadius:20,borderBottomWidth:0},rowUnread:{backgroundColor:'#fbfdf8'},category:{fontFamily:tokens.font.semibold,fontSize:10,textTransform:'uppercase',letterSpacing:0.5,flex:1},source:{fontFamily:tokens.font.medium,fontSize:12,color:tokens.colors.ink},rowEnd:{alignItems:'center',justifyContent:'space-between',gap:18},emptyIcon:{backgroundColor:tokens.colors.brandSoft,width:64,height:64,borderRadius:22,alignItems:'center',justifyContent:'center',marginBottom:10},
  list: {gap:0},
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    borderRadius: 15,
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
    flexShrink: 1,
    color: tokens.colors.ink,
    fontSize: 14,
    lineHeight: 20,
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

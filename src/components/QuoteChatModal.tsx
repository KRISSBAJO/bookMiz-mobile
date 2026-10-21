import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import type { CustomerQuoteConversation, CustomerQuoteMessage } from "@/src/lib/api/types";
import { tokens } from "@/src/theme/tokens";

function dayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier messages";
  if (date.toDateString() === new Date().toDateString()) return "Today";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
}
function timeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function QuoteChatModal({ visible, conversation, conversations, serviceName, draft, sending, error, syncIssue, onClose, onSelect, onDraftChange, onSend, onRefresh, ownRole = "REQUESTER", headingName }: {
  visible: boolean; conversation: CustomerQuoteConversation; conversations: CustomerQuoteConversation[]; serviceName: string;
  ownRole?: "REQUESTER" | "PROVIDER"; headingName?: string;
  draft: string; sending: boolean; error: string | null; syncIssue: string | null;
  onClose: () => void; onSelect: (id: string) => void; onDraftChange: (text: string) => void; onSend: () => void; onRefresh: () => void;
}) {
  const list = useRef<FlatList<CustomerQuoteMessage>>(null);
  const nearBottom = useRef(true);
  const [newBelow, setNewBelow] = useState(false);
  const providerName = headingName || conversation.provider?.displayName || "Your provider";
  const closed = conversation.status === "ARCHIVED";
  const lastId = conversation.messages.at(-1)?.id;
  useEffect(() => { nearBottom.current = true; setNewBelow(false); }, [conversation.id, visible]);
  useEffect(() => { if (!nearBottom.current) setNewBelow(true); }, [lastId]);
  const scrollToLatest = () => { nearBottom.current = true; setNewBelow(false); list.current?.scrollToEnd({ animated: true }); };
  const close = () => { Keyboard.dismiss(); onClose(); };
  const canSend = Boolean(draft.trim()) && !sending && !closed;

  return <Modal visible={visible} animationType="slide" onRequestClose={close}>
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.shell}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close chat" style={styles.close} onPress={close}><FontAwesome6 name="arrow-left" size={18} color={tokens.colors.ink} /></Pressable>
            <View style={styles.avatar}><Text style={styles.avatarText}>{providerName.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase()}</Text></View>
            <View style={styles.headingCopy}>
              <Text accessibilityRole="header" numberOfLines={2} style={styles.name}>{providerName}</Text>
              <Text numberOfLines={1} style={styles.subtitle}>{serviceName || "Your service request"}</Text>
            </View>
          </View>
          {conversations.length > 1 ? <ScrollView horizontal style={styles.railScroll} contentContainerStyle={styles.rail} showsHorizontalScrollIndicator={false}>
            {conversations.map((item) => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: item.id === conversation.id }} style={[styles.tab, item.id === conversation.id && styles.tabActive]} onPress={() => onSelect(item.id)}><Text style={[styles.tabText, item.id === conversation.id && styles.tabTextActive]}>{item.provider?.displayName || "Provider"}</Text></Pressable>)}
          </ScrollView> : null}
          {syncIssue ? <View style={styles.notice}><FontAwesome6 name="rotate" color={tokens.colors.muted} size={13} /><Text style={styles.noticeText}>{syncIssue}</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh conversation" onPress={onRefresh} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View> : null}
          <FlatList ref={list} style={styles.thread} contentContainerStyle={styles.messages} data={conversation.messages} keyExtractor={(item) => item.id}
            initialNumToRender={20} maxToRenderPerBatch={20} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            onScroll={({ nativeEvent: e }) => { nearBottom.current = e.contentSize.height - e.contentOffset.y - e.layoutMeasurement.height < 100; if (nearBottom.current) setNewBelow(false); }} scrollEventThrottle={100}
            onLayout={() => { if (nearBottom.current) list.current?.scrollToEnd({ animated: false }); }}
            onContentSizeChange={() => { if (nearBottom.current) list.current?.scrollToEnd({ animated: false }); }}
            ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><FontAwesome6 name="comments" size={25} color={tokens.colors.ink} /></View><Text style={styles.emptyTitle}>Start the conversation</Text><Text style={styles.emptyText}>Ask {providerName} about your request, timing or service details.</Text></View>}
            renderItem={({ item, index }) => {
              const own = item.senderRole === ownRole || (ownRole === "REQUESTER" && Boolean(conversation.requesterEmail && item.senderEmail === conversation.requesterEmail));
              const previous = conversation.messages[index - 1];
              const showDay = !previous || dayLabel(previous.createdAt) !== dayLabel(item.createdAt);
              return <View>
                {showDay ? <View style={styles.dayRow}><Text style={styles.day}>{dayLabel(item.createdAt)}</Text></View> : null}
                {item.senderRole === "PLATFORM" ? <View style={styles.system}><FontAwesome6 name="circle-info" size={12} color={tokens.colors.muted} /><Text style={styles.systemText}>{item.content}</Text></View> : <View style={[styles.messageRow, own && styles.messageOwn]}>
                  <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                    <Text selectable style={[styles.messageText, own && styles.messageTextOwn]}>{item.content}</Text>
                    <View style={styles.timeRow}><Text style={[styles.time, own && styles.timeOwn]}>{timeLabel(item.createdAt)}</Text>{own ? <FontAwesome6 name="check" size={10} color="#cedaeb" accessibilityLabel="Sent" /> : null}</View>
                  </View>
                </View>}
              </View>;
            }} />
          {newBelow ? <Pressable accessibilityRole="button" accessibilityLabel="Jump to latest messages" style={styles.jump} onPress={scrollToLatest}><Text style={styles.jumpText}>New messages</Text><FontAwesome6 name="arrow-down" size={12} color="#ffffff" /></Pressable> : null}
          <View style={styles.composer}>
            {error ? <View style={styles.errorRow}><FontAwesome6 name="circle-exclamation" size={13} color={tokens.colors.danger} /><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text></View> : null}
            {closed ? <Text style={styles.noticeText}>This conversation is closed. Your messages are still available above.</Text> : <View style={styles.composerRow}>
              <TextInput accessibilityLabel="Reply" value={draft} onChangeText={onDraftChange} placeholder="Message your provider…" placeholderTextColor={tokens.colors.muted} style={styles.input} multiline maxLength={4000} textAlignVertical="top" onFocus={scrollToLatest} />
              <Pressable accessibilityRole="button" accessibilityLabel="Send" accessibilityState={{ disabled: !canSend }} disabled={!canSend} style={[styles.send, !canSend && styles.sendDisabled]} onPress={() => { nearBottom.current = true; onSend(); }}>
                {sending ? <ActivityIndicator color={tokens.colors.inkDeep} /> : <FontAwesome6 name="arrow-up" size={18} color={tokens.colors.inkDeep} />}
              </Pressable>
            </View>}
            {sending ? <Text accessibilityLiveRegion="polite" style={styles.composerHint}>Sending…</Text> : draft.length > 3600 ? <Text style={styles.composerHint}>{draft.length}/4000</Text> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" }, keyboard: { flex: 1 }, shell: { flex: 1, width: "100%", maxWidth: 840, alignSelf: "center", backgroundColor: "#f3f6fb" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.colors.border, backgroundColor: "#ffffff" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: tokens.colors.inkDeep, alignItems: "center", justifyContent: "center" }, avatarText: { color: "#ffffff", fontSize: 14, fontFamily: tokens.font.semibold },
  headingCopy: { flex: 1, minWidth: 0, gap: 3 }, name: { color: tokens.colors.ink, fontSize: 16, fontFamily: tokens.font.semibold }, subtitle: { color: tokens.colors.muted, fontSize: 12, fontFamily: tokens.font.regular },
  railScroll: { flexGrow: 0, maxHeight: 58, backgroundColor: "#ffffff" }, rail: { padding: 10, gap: 8 }, tab: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: tokens.colors.surfaceSoft }, tabActive: { backgroundColor: tokens.colors.inkDeep }, tabText: { fontSize: 12, color: tokens.colors.muted, fontFamily: tokens.font.medium }, tabTextActive: { color: "#ffffff" },
  thread: { flex: 1 }, messages: { padding: 16, paddingBottom: 20, gap: 8, flexGrow: 1 }, dayRow: { alignItems: "center", paddingVertical: 14 }, day: { color: tokens.colors.muted, fontSize: 11, fontFamily: tokens.font.medium, backgroundColor: "#e7edf5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  system: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 8, maxWidth: "92%", paddingHorizontal: 12, paddingVertical: 10, marginVertical: 6 }, systemText: { color: tokens.colors.muted, fontSize: 12, lineHeight: 18, fontFamily: tokens.font.regular, flexShrink: 1, textAlign: "center" },
  messageRow: { flexDirection: "row", marginVertical: 3 }, messageOwn: { justifyContent: "flex-end" }, bubble: { maxWidth: "84%", paddingHorizontal: 14, paddingTop: 11, paddingBottom: 7, borderRadius: 18, gap: 4 }, bubbleOwn: { backgroundColor: tokens.colors.inkDeep, borderBottomRightRadius: 5 }, bubbleOther: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e3e9f2", borderBottomLeftRadius: 5 }, messageText: { color: tokens.colors.ink, fontSize: 15, lineHeight: 22, fontFamily: tokens.font.regular }, messageTextOwn: { color: "#ffffff" }, timeRow: { flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "flex-end" }, time: { color: tokens.colors.muted, fontSize: 10, fontFamily: tokens.font.regular }, timeOwn: { color: "#cedaeb" },
  composer: { paddingHorizontal: 14, paddingVertical: 12, gap: 8, backgroundColor: "#ffffff", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.colors.border }, composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 }, input: { flex: 1, minHeight: 46, maxHeight: 112, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, backgroundColor: "#f0f3f8", borderRadius: 18, color: tokens.colors.ink, fontFamily: tokens.font.regular, fontSize: 15, lineHeight: 21 }, send: { width: 46, height: 46, borderRadius: 17, backgroundColor: tokens.colors.brand, alignItems: "center", justifyContent: "center" }, sendDisabled: { opacity: .4 }, composerHint: { fontSize: 11, color: tokens.colors.muted, fontFamily: tokens.font.regular },
  notice: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, gap: 8, backgroundColor: "#fff4da" }, noticeText: { flex: 1, color: tokens.colors.muted, fontSize: 12, lineHeight: 18, fontFamily: tokens.font.regular }, retry: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6 }, retryText: { color: tokens.colors.ink, fontSize: 12, fontFamily: tokens.font.semibold }, errorRow: { flexDirection: "row", gap: 8, alignItems: "center" }, errorText: { flex: 1, fontSize: 12, lineHeight: 18, color: tokens.colors.danger, fontFamily: tokens.font.regular },
  empty: { flex: 1, minHeight: 200, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 }, emptyIcon: { width: 60, height: 60, borderRadius: 22, backgroundColor: "#e7edf5", alignItems: "center", justifyContent: "center" }, emptyTitle: { fontFamily: tokens.font.semibold, fontSize: 18, color: tokens.colors.ink }, emptyText: { textAlign: "center", color: tokens.colors.muted, fontSize: 14, lineHeight: 21, fontFamily: tokens.font.regular }, jump: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, minHeight: 40, marginBottom: 10, borderRadius: 20, backgroundColor: tokens.colors.inkDeep }, jumpText: { color: "#ffffff", fontSize: 12, fontFamily: tokens.font.medium },
});

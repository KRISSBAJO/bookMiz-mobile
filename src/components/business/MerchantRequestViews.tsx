import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import type { MerchantRequest } from '../../lib/api/business';
import { businessInitials } from '../../lib/merchant-home';
import { conversationIsOpen, conversationTime, requestBudget } from '../../lib/merchant-inbox';
import { tokens as t } from '../../theme/tokens';
import { ui } from './BusinessUI';

const stages: Record<string, string> = { AVAILABLE: 'NEW REQUEST', UNLOCKED: 'IN CONVERSATION', ACCEPTED: 'ACCEPTED', DECLINED: 'DECLINED', EXPIRED: 'EXPIRED' };
export function MerchantRequestBrief({ row, timezone, onReview }: { row: MerchantRequest; timezone: string; onReview: () => void }) {
  const date = row.request.desiredDate && Date.parse(row.request.desiredDate);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Review request: ${row.request.requestedServiceName}, ${row.request.requesterName}, ${row.status}, ${requestBudget(row)}`} onPress={onReview} style={[s.brief, row.status === 'AVAILABLE' && { borderLeftColor: t.colors.brandDeep }]}>
    <View style={ui.row}><Text style={[s.stage, ui.grow]}>{stages[row.status] ?? row.status}</Text><FontAwesome6 name="arrow-right" size={13} color={t.colors.ink} /></View>
    <Text style={s.service}>{row.request.requestedServiceName}</Text>
    <Text numberOfLines={3} style={s.description}>{row.request.description || 'Open this request to review the details.'}</Text>
    <View style={[ui.row, { marginTop: 5 }]}><View style={s.smallAvatar}><Text style={s.initials}>{businessInitials(row.request.requesterName || 'Customer')}</Text></View><View style={ui.grow}><Text style={s.customer}>{row.request.requesterName || 'Customer'}</Text><Text style={ui.muted}>{[row.request.city, row.request.stateCode].filter(Boolean).join(', ') || 'Location not specified'}</Text></View></View>
    <View style={s.briefFooter}><View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={s.caption}>CUSTOMER BUDGET</Text><Text style={s.budget}>{requestBudget(row)}</Text></View><View style={{ flexShrink: 1, gap: 4, alignItems: 'flex-end' }}><Text style={s.caption}>PREFERRED DATE</Text><Text style={s.date}>{date && Number.isFinite(date) ? new Date(date).toLocaleDateString(undefined, { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric' }) : 'Flexible'}</Text></View></View>
  </Pressable>;
}

export function MerchantConversationRow({ row, timezone, canChat, onOpen }: { row: MerchantRequest; timezone: string; canChat: boolean; onOpen: () => void }) {
  const open = conversationIsOpen(row), last = row.conversation?.lastMessage;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${canChat ? 'Open conversation' : 'View linked request'} with ${row.request.requesterName}, ${row.request.requestedServiceName}, ${open ? 'open' : 'closed'}`} onPress={onOpen} style={s.thread}>
    <View style={[s.avatar, !open && { backgroundColor: '#edf0f3' }]}><Text style={s.avatarText}>{businessInitials(row.request.requesterName || 'Customer')}</Text></View>
    <View style={ui.grow}><View style={[ui.row, { alignItems: 'flex-start' }]}><Text style={[s.threadName, ui.grow]}>{row.request.requesterName || 'Customer'}</Text><Text style={s.timestamp}>{conversationTime(row, timezone)}</Text></View><Text numberOfLines={1} style={s.context}>{row.request.requestedServiceName}</Text><Text numberOfLines={2} style={s.preview}>{last ? `${last.senderRole === 'PROVIDER' ? 'You: ' : ''}${last.content}` : 'Start the conversation'}</Text>{!open ? <Text style={s.closed}>Closed conversation</Text> : !canChat ? <Text style={s.closed}>Manager handles replies</Text> : null}</View>
  </Pressable>;
}

const s = StyleSheet.create({
  brief: { backgroundColor: '#fff', borderWidth: 1, borderLeftWidth: 3, borderColor: t.colors.border, borderRadius: 18, padding: 18, gap: 10 }, stage: { color: t.colors.muted, fontFamily: t.font.semibold, fontSize: 9, letterSpacing: 1 }, service: { color: t.colors.ink, fontFamily: t.font.displayBold, fontSize: 23, lineHeight: 29 }, description: { ...ui.text, color: t.colors.muted, fontSize: 13 }, smallAvatar: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.brandSoft }, initials: { ...ui.title, fontSize: 10 }, customer: { ...ui.title, fontSize: 13 }, briefFooter: { ...ui.row, alignItems: 'flex-start', borderTopWidth: 1, borderColor: t.colors.border, paddingTop: 13, marginTop: 3 }, caption: { ...ui.muted, fontSize: 8, letterSpacing: 0.7 }, budget: { ...ui.title, fontSize: 14 }, date: { ...ui.text, fontSize: 12 },
  thread: { ...ui.row, alignItems: 'flex-start', paddingVertical: 18, borderBottomWidth: 1, borderColor: t.colors.border, gap: 13 }, avatar: { width: 47, height: 47, borderRadius: 18, backgroundColor: '#e5eddc', alignItems: 'center', justifyContent: 'center' }, avatarText: { ...ui.title, fontSize: 15 }, threadName: { ...ui.title, fontSize: 16 }, timestamp: { ...ui.muted, fontSize: 10, maxWidth: 95 }, context: { ...ui.text, fontSize: 11, color: t.colors.muted, marginTop: 1 }, preview: { ...ui.text, fontSize: 13, marginTop: 5, color: t.colors.muted }, closed: { ...ui.muted, fontSize: 10, marginTop: 5 },
});

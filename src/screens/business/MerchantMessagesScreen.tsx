import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBusiness } from '../../store/business-context';
import { getMerchantRequests } from '../../lib/api/business';
import { conversationIsOpen, recentConversations } from '../../lib/merchant-inbox';
import { Action, Field, Notice, ui, useBusinessData } from '../../components/business/BusinessUI';
import { MerchantConversationRow } from '../../components/business/MerchantRequestViews';
import { MerchantChat } from '../../components/business/MerchantChat';
import { InboxScreen } from '../InboxScreen';
import { tokens as t } from '../../theme/tokens';

export function MerchantMessagesScreen() {
  const b = useBusiness(), router = useRouter();
  const params = useLocalSearchParams<{ view?: string; notificationId?: string; matchId?: string }>();
  const [alerts, setAlerts] = useState(params.view === 'notifications' || !!params.notificationId);
  const [search, setSearch] = useState(''), [filter, setFilter] = useState('ALL'), [chat, setChat] = useState<string | null>(null);
  const state = useBusinessData(useCallback(() => getMerchantRequests(b.organizationId), [b.organizationId]));
  useEffect(() => { if (params.view === 'notifications' || params.notificationId) setAlerts(true); }, [params.view, params.notificationId]);
  const conversations = recentConversations(state.data?.requests ?? []);
  useEffect(() => {
    if (!params.matchId || !state.data) return;
    const row = state.data.requests.find(item => item.id === params.matchId && item.conversation);
    if (row) {
      setAlerts(false);
      if (b.canManage) setChat(row.id);
      else { router.setParams({ matchId: undefined }); router.push(`/business/requests?matchId=${encodeURIComponent(row.id)}` as never); }
    }
  }, [params.matchId, state.data, b.canManage, router]);
  const rows = conversations.filter(row => (filter === 'ALL' || (filter === 'OPEN' ? conversationIsOpen(row) : !conversationIsOpen(row))) && `${row.request.requesterName} ${row.request.requestedServiceName} ${row.conversation?.lastMessage?.content ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const closeChat = () => { setChat(null); router.setParams({ matchId: undefined }); void state.refresh(); };
  if (alerts) return <View style={{ flex: 1 }}><View style={{ paddingHorizontal: 18, paddingTop: 12 }}><Action label="Back to messages" secondary onPress={() => { setAlerts(false); router.setParams({ view: undefined, notificationId: undefined }); }} /></View><InboxScreen /></View>;
  return <SafeAreaView edges={['top']} style={s.root}>
    <ScrollView refreshControl={<RefreshControl refreshing={state.loading && !!state.data} onRefresh={() => void state.refresh()} />} contentContainerStyle={s.content}>
      <View style={ui.row}><View style={ui.grow}><Text style={ui.muted}>{b.workspace.displayName}</Text><Text accessibilityRole="header" style={s.title}>Messages</Text><Text style={s.subtitle}>Stay close to your clients.</Text></View><Action label="Alerts" secondary icon="bell" onPress={() => setAlerts(true)} /></View>
      <Field label="Search messages" value={search} onChangeText={setSearch} placeholder="Client, service or recent message" />
      <View style={s.tabs}>{[{ id: 'ALL', label: 'All', count: conversations.length }, { id: 'OPEN', label: 'Open', count: conversations.filter(conversationIsOpen).length }, { id: 'CLOSED', label: 'Closed', count: conversations.filter(row => !conversationIsOpen(row)).length }].map(tab => <Pressable key={tab.id} accessibilityRole="button" accessibilityLabel={`${tab.label} conversations`} accessibilityState={{ selected: filter === tab.id }} onPress={() => setFilter(tab.id)} style={[s.tab, filter === tab.id && s.selected]}><Text style={[s.tabLabel, filter === tab.id && { color: t.colors.ink }]}>{tab.label}</Text>{state.data ? <Text style={s.count}>{tab.count}</Text> : null}</Pressable>)}</View>
      {!b.canManage ? <Text style={ui.muted}>You can preview conversations and view their requests. Your manager handles chat replies.</Text> : null}
      {state.error ? <Notice text={`${state.data ? 'Showing your last loaded conversations. ' : ''}${state.error}`} onRetry={() => void state.refresh()} /> : null}
      {params.matchId && state.data && !conversations.some(row => row.id === params.matchId) ? <Notice text="This conversation is not available in the selected business." /> : null}
      {state.loading && !state.data ? <ActivityIndicator accessibilityLabel="Loading conversations" /> : rows.map(row => <MerchantConversationRow key={row.id} row={row} timezone={b.workspace.timezone} canChat={b.canManage} onOpen={() => b.canManage ? setChat(row.id) : router.push(`/business/requests?matchId=${encodeURIComponent(row.id)}` as never)} />)}
      {!state.loading && !state.error && !rows.length ? <View style={s.empty}><View style={s.emptyMark}><Text style={{ fontSize: 25, color: t.colors.ink }}>...</Text></View><Text style={ui.title}>{search || filter !== 'ALL' ? 'No matching conversations' : 'Your conversations start here'}</Text><Text style={[ui.muted, { textAlign: 'center' }]}>{search || filter !== 'ALL' ? 'Try another search or conversation filter.' : 'Once a request has a conversation, you can find it here. Review new opportunities in Requests.'}</Text>{!search && filter === 'ALL' ? <Action label="Browse requests" secondary onPress={() => router.push('/business/requests')} /> : null}</View> : null}
    </ScrollView>
    {chat ? <MerchantChat key={chat} matchId={chat} onClose={closeChat} /> : null}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' }, content: { padding: 20, paddingBottom: 125, gap: 15, width: '100%', maxWidth: 900, alignSelf: 'center' }, title: { fontFamily: t.font.displayBold, color: t.colors.ink, fontSize: 32, lineHeight: 40 }, subtitle: { ...ui.muted, marginTop: 3 }, tabs: { flexDirection: 'row', gap: 20, borderBottomWidth: 1, borderColor: t.colors.border }, tab: { ...ui.row, minHeight: 48, paddingBottom: 10, gap: 6, borderBottomWidth: 2, borderColor: 'transparent' }, selected: { borderColor: t.colors.ink }, tabLabel: { ...ui.text, fontFamily: t.font.semibold, color: t.colors.muted }, count: { ...ui.muted, backgroundColor: t.colors.surface, paddingHorizontal: 6, borderRadius: 5, fontSize: 10 }, empty: { paddingVertical: 35, alignItems: 'center', gap: 12 }, emptyMark: { width: 60, height: 60, backgroundColor: t.colors.brandSoft, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

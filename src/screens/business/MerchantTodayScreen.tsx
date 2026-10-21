import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { BusinessSelector, useBusiness } from '../../store/business-context';
import { businessDate, shiftBusinessDate } from '../../lib/business-policy';
import { getMerchantBookings, getMerchantBootstrap } from '../../lib/api/business';
import { Action, Empty, Notice, ui, useBusinessData } from '../../components/business/BusinessUI';
import { BookingCard } from '../../components/business/BookingCard';
import { BookingEditor } from '../../components/business/BookingEditor';
import { tokens as t } from '../../theme/tokens';
export function MerchantTodayScreen() {
  const b = useBusiness(), router = useRouter(), { width } = useWindowDimensions();
  const [create, setCreate] = useState(false);
  const day = businessDate(new Date(), b.workspace.timezone);
  const state = useBusinessData(useCallback(async () => {
    const [bookings, bootstrap] = await Promise.all([getMerchantBookings(b.organizationId, shiftBusinessDate(day, -1), shiftBusinessDate(day, 1)), getMerchantBootstrap(b.organizationId)]);
    return { bookings: bookings.bookings.filter(item => businessDate(item.startsAt, b.workspace.timezone) === day), stats: bootstrap.stats };
  }, [b.organizationId, b.workspace.timezone, day]));
  const next = state.data?.bookings.filter(item => ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(item.status)) ?? [];
  return <Screen title="Your business, today" eyebrow={b.workspace.displayName} showBack={false} subtitle={new Date().toLocaleDateString(undefined, { timeZone: b.workspace.timezone, weekday: 'long', month: 'long', day: 'numeric' })} refreshing={state.loading} onRefresh={() => void state.refresh()} action={<Pressable accessibilityRole="button" accessibilityLabel="Business notifications" onPress={() => router.push('/business/inbox?view=notifications' as never)} style={{ padding: 12 }}><FontAwesome6 name="bell" size={20} color={t.colors.ink} /></Pressable>}>
    <BusinessSelector />
    <View style={{ backgroundColor: t.colors.inkDeep, borderRadius: 22, padding: 22, gap: 15 }}><View style={ui.row}><View style={ui.grow}><Text style={{ ...ui.muted, color: t.colors.onNavyMuted }}>YOUR DAY AT A GLANCE</Text><Text style={{ fontFamily: t.font.displayBold, fontSize: 34, color: '#fff', marginTop: 8 }}>{state.data ? next.length : '—'} <Text style={{ fontSize: 17 }}>appointments to go</Text></Text></View><View style={{ backgroundColor: t.colors.brand, borderRadius: 16, padding: 15 }}><FontAwesome6 name="calendar-check" size={22} color={t.colors.ink} /></View></View><Text style={{ ...ui.muted, color: t.colors.onNavyMuted }}>All times in {b.workspace.timezone}. Pull down for the latest changes.</Text>{b.canManage ? <Action label="New appointment" icon="plus" secondary onPress={() => setCreate(true)} /> : null}</View>
    <View style={ui.wrap}>{[{ label: 'Requests', count: state.data?.stats.openRequests, route: '/business/requests', icon: 'inbox' }, { label: 'Active services', count: state.data?.stats.activeServices, route: '/business/manage?section=services', icon: 'scissors' }, { label: 'Team members', count: state.data?.stats.activeStaff, route: '/business/manage', icon: 'users' }].map(item => <Pressable key={item.label} onPress={() => router.push(item.route as never)} style={[ui.card, { flexGrow: 1, flexBasis: width < 380 ? '44%' : '28%', padding: 13 }]}><FontAwesome6 name={item.icon} size={16} color={t.colors.muted} /><Text style={{ ...ui.title, fontSize: 24 }}>{item.count ?? '—'}</Text><Text style={ui.muted}>{item.label}</Text></Pressable>)}</View>
    {state.error ? <Notice text={state.error} onRetry={() => void state.refresh()} /> : null}
    <View style={ui.row}><Text style={[ui.title, ui.grow]}>Today’s appointments</Text><Pressable accessibilityRole="button" onPress={() => router.push('/business/calendar' as never)} style={{ padding: 10 }}><Text style={ui.muted}>Full calendar →</Text></Pressable></View>
    {state.loading && !state.data ? <ActivityIndicator /> : state.data?.bookings.length ? state.data.bookings.map(item => <BookingCard key={item.id} booking={item} onRefresh={state.refresh} />) : !state.error ? <Empty title="A clear schedule" text="New appointments for today will appear here." /> : null}
    {create ? <BookingEditor onClose={() => setCreate(false)} onSaved={state.refresh} /> : null}
  </Screen>;
}

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { BusinessSelector, useBusiness } from '../../store/business-context';
import { businessDate, shiftBusinessDate, formatBusinessMoney } from '../../lib/business-policy';
import { businessInitials, merchantDay } from '../../lib/merchant-home';
import { scheduleLayout } from '../../lib/merchant-schedule';
import { getMerchantBookings, getMerchantBootstrap, getMerchantCover, type MerchantBooking } from '../../lib/api/business';
import { Action, Badge, Notice, ui, useBusinessData } from '../../components/business/BusinessUI';
import { BusinessCover } from '../../components/business/BusinessCover';
import { BookingCard } from '../../components/business/BookingCard';
import { BookingEditor } from '../../components/business/BookingEditor';
import { tokens as t } from '../../theme/tokens';

export function MerchantTodayScreen() {
  const b = useBusiness(), router = useRouter(), { width, fontScale } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date()), [create, setCreate] = useState(false);
  const [opened, setOpened] = useState<MerchantBooking | null>(null), [showAll, setShowAll] = useState(false);
  useFocusEffect(useCallback(() => {
    setNow(new Date()); const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []));
  const day = businessDate(now, b.workspace.timezone), wide = width >= 760 && fontScale < 1.4;
  const state = useBusinessData(useCallback(() => getMerchantBookings(b.organizationId, shiftBusinessDate(day, -1), shiftBusinessDate(day, 1)), [b.organizationId, day]));
  const bootstrap = useBusinessData(useCallback(() => getMerchantBootstrap(b.organizationId), [b.organizationId]));
  const cover = useBusinessData(useCallback(() => getMerchantCover(b.organizationId, b.workspace.slug), [b.organizationId, b.workspace.slug]));
  const bookings = scheduleLayout(state.data?.bookings ?? [], day, b.workspace.timezone).items.map(item => item.booking);
  const summary = merchantDay(bookings, now), ready = !!state.data, next = summary.next;
  const agenda = showAll ? summary.timeline : summary.remaining;
  const upcoming = summary.remaining.filter(item => Date.parse(item.endsAt) > now.getTime()).length;
  const time = (value: string) => new Date(value).toLocaleTimeString(undefined, { timeZone: b.workspace.timezone, hour: 'numeric', minute: '2-digit' });
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: b.workspace.timezone, hour: '2-digit', hourCycle: 'h23' }).format(now));
  const refresh = async () => { setNow(new Date()); await Promise.all([state.refresh(), bootstrap.refresh(), cover.refresh()]); };
  const push = (route: string) => router.push(route as never);
  const attention = [
    { label: 'Awaiting confirmation', count: summary.pending.length, open: () => setOpened(summary.pending[0]!) },
    { label: 'No team member assigned', count: summary.unassigned.length, open: () => setOpened(summary.unassigned[0]!) },
    { label: 'Past time, still open', count: summary.overdue.length, open: () => setOpened(summary.overdue[0]!) },
  ].filter(item => item.count > 0);
  const managePanel = <View style={s.manage}><Text style={s.smallHeading}>KEEP YOUR BUSINESS MOVING</Text>{[{ label: 'Hours & time off', icon: 'clock' as const, route: '/business/manage?section=availability' }, { label: b.canManage ? 'Add service' : 'Services', icon: 'scissors' as const, route: b.canManage ? '/business/manage?section=services&action=add-service' : '/business/manage?section=services' }].map(item => <Pressable key={item.label} accessibilityRole="button" onPress={() => push(item.route)} style={s.manageRow}><FontAwesome6 name={item.icon} size={15} color={t.colors.ink} /><Text style={[s.link, ui.grow]}>{item.label}</Text><FontAwesome6 name="arrow-right" size={12} color={t.colors.ink} /></Pressable>)}</View>;
  const attentionPanel = <View style={[s.rail, wide && { flex: 1 }]}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}><Text accessibilityRole="header" style={s.sectionTitle}>Needs attention</Text><View style={{ width: 7, height: 7, backgroundColor: '#d6a763', borderRadius: 4 }} /></View>
          {!ready ? <Text style={ui.muted}>{state.error ? 'Could not check appointment tasks.' : 'Checking your appointments...'}</Text> : attention.length ? attention.map(item => <Pressable key={item.label} accessibilityRole="button" onPress={item.open} style={s.attentionRow}><Text style={s.attentionCount}>{item.count}</Text><Text style={[s.service, ui.grow]}>{item.label}</Text><FontAwesome6 name="chevron-right" size={11} color={t.colors.muted} /></Pressable>) : <View style={[ui.row, { paddingVertical: 14 }]}><FontAwesome6 name="circle-check" size={18} color={t.colors.success} /><Text style={[s.service, ui.grow]}>Today's appointment tasks are clear.</Text></View>}
          {bootstrap.error ? <Notice text="Service requests could not load." onRetry={() => void bootstrap.refresh()} /> : bootstrap.data ? bootstrap.data.stats.openRequests > 0 ? <Pressable accessibilityRole="button" onPress={() => push('/business/requests')} style={s.attentionRow}><Text style={s.attentionCount}>{bootstrap.data.stats.openRequests}</Text><Text style={[s.service, ui.grow]}>Open service requests</Text><FontAwesome6 name="chevron-right" size={11} color={t.colors.muted} /></Pressable> : null : <Text style={ui.muted}>Checking service requests...</Text>}
          {wide ? managePanel : null}
        </View>;
  return <SafeAreaView edges={['top']} style={s.root}>
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={state.loading && ready} onRefresh={() => void refresh()} />} contentContainerStyle={s.content}>
      <View style={s.header}><View style={ui.grow}><Text style={s.eyebrow}>YOUR BUSINESS, TODAY</Text><Text accessibilityRole="header" style={s.greeting}>Good {hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}.</Text><Text style={ui.muted}>{now.toLocaleDateString(undefined, { timeZone: b.workspace.timezone, weekday: 'long', month: 'long', day: 'numeric' })}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Business notifications" onPress={() => push('/business/inbox?view=notifications')} style={s.bell}><FontAwesome6 name="bell" size={20} color={t.colors.ink} /></Pressable></View>
      <BusinessSelector />
      {state.error ? <Notice text={`${ready ? 'Showing your last loaded day. ' : ''}${state.error}`} onRetry={() => void state.refresh()} /> : null}
      <View style={[s.columns, wide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={[s.main, wide && { flex: 1.6 }]}>
          <BusinessCover url={cover.data?.url} name={b.workspace.displayName} wide={wide} />
          {!ready ? <View style={s.nextRow}><Text style={ui.title}>{state.error ? 'Your schedule is unavailable' : 'Loading your next client...'}</Text>{state.loading ? <ActivityIndicator /> : null}</View> : next ? <Pressable accessibilityRole="button" accessibilityLabel={`View next appointment, ${next.customerName}, ${time(next.startsAt)}, ${next.serviceName}`} onPress={() => setOpened(next)} style={s.nextRow}><View style={{ gap: 6 }}><Text style={s.nextLabel}>{next.status === 'CHECKED_IN' ? 'IN PROGRESS' : Date.parse(next.startsAt) <= now.getTime() ? 'SCHEDULED NOW' : 'UP NEXT'}</Text><Text style={s.nextTime}>{time(next.startsAt)}</Text><Text style={ui.muted}>{time(next.endsAt)}</Text></View><View style={[ui.grow, { gap: 4 }]}><Text style={s.nextClient}>{next.customerName || 'Customer'}</Text><Text style={s.service}>{next.serviceName}</Text><Text style={ui.muted}>{next.staffName || 'Unassigned'}{' \u00b7 '}{formatBusinessMoney(next.totalPriceCents, next.currencyCode)}</Text><Text style={s.nextStatus}>{next.status === 'PENDING' ? 'Awaiting confirmation' : next.status === 'CHECKED_IN' ? 'Client checked in' : 'Confirmed appointment'}</Text></View><FontAwesome6 name="arrow-right" size={14} color={t.colors.ink} /></Pressable> : <View style={s.nextRow}><View style={ui.grow}><Text style={s.nextClient}>{summary.overdue.length ? 'A few details to close' : summary.completed ? 'A day well done' : 'Space for your next client'}</Text><Text style={s.service}>{summary.overdue.length ? 'Review earlier appointments below.' : 'No upcoming appointments today.'}</Text></View><FontAwesome6 name="calendar-check" size={25} color={t.colors.muted} /></View>}
          <View style={s.metrics}>{[{ label: 'Upcoming', value: upcoming }, { label: 'Completed', value: summary.completed }, { label: 'Pending', value: summary.pending.length }].map((metric, index) => <View key={metric.label} style={[s.metric, index > 0 && s.metricBorder]}><Text style={s.metricValue}>{ready ? metric.value : '\u2014'}</Text><Text style={s.metricLabel}>{metric.label}</Text></View>)}</View>
          <View style={s.actions}>{b.canManage ? <Action label="New appointment" icon="plus" onPress={() => setCreate(true)} /> : null}<Action label="Open calendar" secondary icon="calendar-days" onPress={() => push('/business/calendar')} /></View>
          {!wide ? attentionPanel : null}
          <View style={ui.row}><View style={ui.grow}><Text accessibilityRole="header" style={s.sectionTitle}>Today's agenda</Text><Text style={ui.muted}>{b.workspace.timezone}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={showAll ? 'Show open appointments' : 'Show all appointments'} onPress={() => setShowAll(!showAll)} style={s.textButton}><Text style={s.link}>{showAll ? 'Open only' : 'Show all'}</Text></Pressable></View>
          {ready ? agenda.length ? agenda.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${time(item.startsAt)}, ${item.customerName}, ${item.serviceName}, ${item.status}, booking total ${formatBusinessMoney(item.totalPriceCents, item.currencyCode)}`} onPress={() => setOpened(item)} style={s.agendaRow}><View style={s.timeColumn}><Text style={s.time}>{time(item.startsAt)}</Text><Text style={ui.muted}>{Math.round((Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60000)} min</Text></View>{fontScale < 1.4 && width >= 360 ? <View style={[s.avatar, item.id === next?.id && { backgroundColor: t.colors.brandSoft }]}><Text style={s.initials}>{businessInitials(item.customerName || 'Customer')}</Text></View> : null}<View style={ui.grow}><Text style={ui.title}>{item.customerName || 'Customer'}</Text><Text style={s.service}>{item.serviceName}</Text><Text style={ui.muted}>{item.staffName || 'Unassigned'}{' \u00b7 '}{formatBusinessMoney(item.totalPriceCents, item.currencyCode)}</Text><View style={{ marginTop: 7 }}><Badge value={item.status} /></View></View><FontAwesome6 name="chevron-right" size={11} color={t.colors.muted} /></Pressable>) : <View style={s.emptyAgenda}><Text style={ui.title}>{showAll ? 'No appointments today' : 'No open appointments'}</Text><Text style={ui.muted}>{showAll ? 'Your next booking will appear here.' : 'View all to see completed and cancelled appointments.'}</Text></View> : null}
          {!wide ? managePanel : null}
        </View>
        {wide ? attentionPanel : null}
      </View>
    </ScrollView>
    {opened ? <BookingCard key={opened.id} booking={opened} initialOpen hideTrigger onDismiss={() => setOpened(null)} onRefresh={state.refresh} /> : null}
    {create ? <BookingEditor initialDay={day} onClose={() => setCreate(false)} onSaved={state.refresh} /> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fafbf8' }, content: { padding: 20, paddingBottom: 130, gap: 22, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  header: { ...ui.row, gap: 14 }, eyebrow: { ...ui.muted, marginBottom: 5 }, greeting: { fontFamily: t.font.displayBold, fontSize: 31, lineHeight: 38, letterSpacing: -0.8, color: t.colors.ink }, bell: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: t.colors.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  columns: { gap: 28 }, main: { gap: 16, minWidth: 0 }, rail: { gap: 10, minWidth: 0 },
  nextRow: { ...ui.row, alignItems: 'flex-start', paddingVertical: 16, gap: 16, borderBottomWidth: 1, borderColor: t.colors.border }, nextLabel: { color: t.colors.muted, fontFamily: t.font.semibold, fontSize: 9, letterSpacing: 1 }, nextTime: { color: t.colors.ink, fontFamily: t.font.semibold, fontSize: 18, lineHeight: 24 }, nextClient: { color: t.colors.ink, fontFamily: t.font.displayBold, fontSize: 22, lineHeight: 28 }, nextStatus: { fontFamily: t.font.medium, color: t.colors.success, fontSize: 11, lineHeight: 18 },
  metrics: { flexDirection: 'row', paddingVertical: 6 }, metric: { flex: 1, gap: 3, alignItems: 'center', minWidth: 0 }, metricBorder: { borderLeftWidth: 1, borderColor: '#dce3d8' }, metricValue: { color: t.colors.ink, fontFamily: t.font.displayBold, fontSize: 28, lineHeight: 34 }, metricLabel: { ...ui.muted, fontSize: 11 }, actions: { ...ui.wrap }, sectionTitle: { ...ui.title, fontSize: 18, lineHeight: 25 }, textButton: { minHeight: 44, justifyContent: 'center', paddingLeft: 8 }, link: { ...ui.text, fontFamily: t.font.semibold, fontSize: 13 },
  agendaRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 17, gap: 10, borderBottomWidth: 1, borderColor: t.colors.border }, timeColumn: { width: 62, gap: 4 }, time: { ...ui.title, fontSize: 12, lineHeight: 20 }, avatar: { width: 34, height: 34, backgroundColor: '#e9edf2', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, initials: { ...ui.title, fontSize: 10 }, service: { ...ui.text, color: t.colors.muted, fontSize: 13 }, emptyAgenda: { paddingVertical: 20, gap: 6 },
  attentionRow: { ...ui.row, minHeight: 59, borderBottomWidth: 1, borderColor: '#e8e4da', paddingVertical: 10 }, attentionCount: { color: '#825a25', backgroundColor: '#f7eddc', borderRadius: 9, padding: 8, minWidth: 34, textAlign: 'center', fontFamily: t.font.semibold, fontSize: 13 }, manage: { marginTop: 18, gap: 5 }, smallHeading: { ...ui.muted, fontSize: 10, letterSpacing: 1 }, manageRow: { ...ui.row, minHeight: 54, borderBottomWidth: 1, borderColor: t.colors.border },
});

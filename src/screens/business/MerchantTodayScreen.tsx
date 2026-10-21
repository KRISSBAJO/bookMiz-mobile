import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { BusinessSelector, useBusiness } from '../../store/business-context';
import { businessDate, shiftBusinessDate, formatBusinessMoney } from '../../lib/business-policy';
import { businessInitials, merchantDay } from '../../lib/merchant-home';
import { scheduleLayout } from '../../lib/merchant-schedule';
import { getMerchantBookings, getMerchantBootstrap, type MerchantBooking } from '../../lib/api/business';
import { Action, Badge, Notice, ui, useBusinessData } from '../../components/business/BusinessUI';
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
  const bookings = scheduleLayout(state.data?.bookings ?? [], day, b.workspace.timezone).items.map(item => item.booking);
  const summary = merchantDay(bookings, now), ready = !!state.data, next = summary.next;
  const agenda = showAll ? summary.timeline : summary.remaining;
  const upcoming = summary.remaining.filter(item => Date.parse(item.endsAt) > now.getTime()).length;
  const time = (value: string) => new Date(value).toLocaleTimeString(undefined, { timeZone: b.workspace.timezone, hour: 'numeric', minute: '2-digit' });
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: b.workspace.timezone, hour: '2-digit', hourCycle: 'h23' }).format(now));
  const refresh = async () => { setNow(new Date()); await Promise.all([state.refresh(), bootstrap.refresh()]); };
  const push = (route: string) => router.push(route as never);
  const attention = [
    { label: 'Awaiting confirmation', count: summary.pending.length, open: () => setOpened(summary.pending[0]!) },
    { label: 'No team member assigned', count: summary.unassigned.length, open: () => setOpened(summary.unassigned[0]!) },
    { label: 'Past time, still open', count: summary.overdue.length, open: () => setOpened(summary.overdue[0]!) },
  ].filter(item => item.count > 0);
  const attentionPanel = <View style={[s.rail, wide && { flex: 1 }]}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}><Text accessibilityRole="header" style={s.sectionTitle}>Needs attention</Text><View style={{ width: 7, height: 7, backgroundColor: '#d6a763', borderRadius: 4 }} /></View>
          {!ready ? <Text style={ui.muted}>{state.error ? 'Could not check appointment tasks.' : 'Checking your appointments...'}</Text> : attention.length ? attention.map(item => <Pressable key={item.label} accessibilityRole="button" onPress={item.open} style={s.attentionRow}><Text style={s.attentionCount}>{item.count}</Text><Text style={[s.service, ui.grow]}>{item.label}</Text><FontAwesome6 name="chevron-right" size={11} color={t.colors.muted} /></Pressable>) : <View style={[ui.row, { paddingVertical: 14 }]}><FontAwesome6 name="circle-check" size={18} color={t.colors.success} /><Text style={[s.service, ui.grow]}>Today's appointment tasks are clear.</Text></View>}
          {bootstrap.error ? <Notice text="Service requests could not load." onRetry={() => void bootstrap.refresh()} /> : bootstrap.data ? bootstrap.data.stats.openRequests > 0 ? <Pressable accessibilityRole="button" onPress={() => push('/business/requests')} style={s.attentionRow}><Text style={s.attentionCount}>{bootstrap.data.stats.openRequests}</Text><Text style={[s.service, ui.grow]}>Open service requests</Text><FontAwesome6 name="chevron-right" size={11} color={t.colors.muted} /></Pressable> : null : <Text style={ui.muted}>Checking service requests...</Text>}
          <View style={s.manage}><Text style={s.smallHeading}>KEEP YOUR BUSINESS MOVING</Text>{[{ label: 'Hours & time off', icon: 'clock' as const, route: '/business/manage?section=availability' }, { label: b.canManage ? 'Add service' : 'Services', icon: 'scissors' as const, route: b.canManage ? '/business/manage?section=services&action=add-service' : '/business/manage?section=services' }].map(item => <Pressable key={item.label} accessibilityRole="button" onPress={() => push(item.route)} style={s.manageRow}><FontAwesome6 name={item.icon} size={15} color={t.colors.ink} /><Text style={[s.link, ui.grow]}>{item.label}</Text><FontAwesome6 name="arrow-right" size={12} color={t.colors.ink} /></Pressable>)}</View>
        </View>;
  return <SafeAreaView edges={['top']} style={s.root}>
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={state.loading && ready} onRefresh={() => void refresh()} />} contentContainerStyle={s.content}>
      <View style={s.header}><View style={ui.grow}><Text style={s.eyebrow}>{b.workspace.displayName}</Text><Text accessibilityRole="header" style={s.greeting}>Good {hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}.</Text><Text style={ui.muted}>{now.toLocaleDateString(undefined, { timeZone: b.workspace.timezone, weekday: 'long', month: 'long', day: 'numeric' })}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Business notifications" onPress={() => push('/business/inbox?view=notifications')} style={s.bell}><FontAwesome6 name="bell" size={20} color={t.colors.ink} /></Pressable></View>
      <BusinessSelector />
      {state.error ? <Notice text={`${ready ? 'Showing your last loaded day. ' : ''}${state.error}`} onRetry={() => void state.refresh()} /> : null}
      <View style={[s.columns, wide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={[s.main, wide && { flex: 1.6 }]}>
          <View style={s.spotlight}>
            <View style={s.spotlightHeading}><Text style={s.kicker}>{!ready ? 'YOUR DAY' : next ? next.status === 'CHECKED_IN' ? 'IN PROGRESS' : Date.parse(next.startsAt) <= now.getTime() ? 'SCHEDULED NOW' : 'UP NEXT' : summary.overdue.length ? 'TIME TO CATCH UP' : summary.completed ? 'LOOKING GOOD' : 'A FRESH START'}</Text><View style={s.spark}><FontAwesome6 name={next ? 'arrow-right' : 'sun'} size={17} color={t.colors.ink} /></View></View>
            {!ready ? <><Text style={s.heroTitle}>{state.error ? 'Your day is unavailable' : 'Getting your day ready'}</Text>{state.loading ? <ActivityIndicator color={t.colors.brand} /> : null}</> : next ? <Pressable accessibilityRole="button" accessibilityLabel={`View next appointment, ${next.customerName}, ${time(next.startsAt)}, ${next.serviceName}`} onPress={() => setOpened(next)} style={{ gap: 10, minHeight: 44 }}><Text style={s.heroTime}>{time(next.startsAt)}<Text style={s.heroEnd}>{' - '}{time(next.endsAt)}</Text></Text><Text style={s.heroTitle}>{next.customerName || 'Customer'}</Text><Text style={s.heroService}>{next.serviceName}</Text><View style={s.heroMeta}><Text style={s.heroCaption}>{next.staffName || 'Unassigned'}</Text><Text style={s.heroCaption}>{formatBusinessMoney(next.totalPriceCents, next.currencyCode)}</Text></View><View style={s.heroFooter}><Text style={s.heroCaption}>{next.status === 'PENDING' ? 'Awaiting confirmation' : next.status === 'CHECKED_IN' ? 'Client checked in' : 'Confirmed appointment'}</Text><Text style={s.heroLink}>View details</Text></View></Pressable> : <View style={s.emptyHero}><View style={ui.grow}><Text style={s.heroTitle}>{summary.overdue.length ? 'A few details to close.' : summary.completed ? 'You made it happen.' : 'Make room for great work.'}</Text><Text style={s.heroService}>{summary.overdue.length ? 'Review earlier appointments in Needs attention.' : 'No upcoming appointments for today.'}</Text></View>{fontScale < 1.4 ? <Image source={require('../../../assets/bookmiz/merchant-day-illustration.png')} accessible={false} resizeMode="contain" style={{ width: 85, height: 95 }} /> : null}</View>}
          </View>
          <View style={s.metrics}>{[{ label: 'Upcoming', value: upcoming }, { label: 'Completed', value: summary.completed }, { label: 'Pending', value: summary.pending.length }].map((metric, index) => <View key={metric.label} style={[s.metric, index > 0 && s.metricBorder]}><Text style={s.metricValue}>{ready ? metric.value : '\u2014'}</Text><Text style={s.metricLabel}>{metric.label}</Text></View>)}</View>
          <View style={s.actions}>{b.canManage ? <Action label="New appointment" icon="plus" onPress={() => setCreate(true)} /> : null}<Action label="Open calendar" secondary icon="calendar-days" onPress={() => push('/business/calendar')} /></View>
          {!wide ? attentionPanel : null}
          <View style={ui.row}><View style={ui.grow}><Text accessibilityRole="header" style={s.sectionTitle}>Today's agenda</Text><Text style={ui.muted}>{b.workspace.timezone}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={showAll ? 'Show open appointments' : 'Show all appointments'} onPress={() => setShowAll(!showAll)} style={s.textButton}><Text style={s.link}>{showAll ? 'Open only' : 'Show all'}</Text></Pressable></View>
          {ready ? agenda.length ? agenda.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${time(item.startsAt)}, ${item.customerName}, ${item.serviceName}, ${item.status}, booking total ${formatBusinessMoney(item.totalPriceCents, item.currencyCode)}`} onPress={() => setOpened(item)} style={s.agendaRow}><View style={s.timeColumn}><Text style={s.time}>{time(item.startsAt)}</Text><Text style={ui.muted}>{Math.round((Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60000)} min</Text></View>{fontScale < 1.4 && width >= 360 ? <View style={[s.avatar, item.id === next?.id && { backgroundColor: t.colors.brandSoft }]}><Text style={s.initials}>{businessInitials(item.customerName || 'Customer')}</Text></View> : null}<View style={ui.grow}><Text style={ui.title}>{item.customerName || 'Customer'}</Text><Text style={s.service}>{item.serviceName}</Text><Text style={ui.muted}>{item.staffName || 'Unassigned'}{' \u00b7 '}{formatBusinessMoney(item.totalPriceCents, item.currencyCode)}</Text><View style={{ marginTop: 7 }}><Badge value={item.status} /></View></View><FontAwesome6 name="chevron-right" size={11} color={t.colors.muted} /></Pressable>) : <View style={s.emptyAgenda}><Text style={ui.title}>{showAll ? 'No appointments today' : 'No open appointments'}</Text><Text style={ui.muted}>{showAll ? 'Your next booking will appear here.' : 'View all to see completed and cancelled appointments.'}</Text></View> : null}
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
  columns: { gap: 28 }, main: { gap: 18, minWidth: 0 }, rail: { gap: 12, minWidth: 0 }, spotlight: { backgroundColor: t.colors.ink, padding: 22, borderRadius: 24, gap: 12 }, spotlightHeading: { ...ui.row, justifyContent: 'space-between' }, kicker: { color: '#d0e6ad', fontFamily: t.font.semibold, fontSize: 10, letterSpacing: 1.5 }, spark: { width: 34, height: 34, backgroundColor: t.colors.brand, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, heroTime: { fontFamily: t.font.semibold, color: t.colors.brand, fontSize: 23, lineHeight: 30 }, heroEnd: { fontFamily: t.font.regular, color: '#c6d4e5', fontSize: 13 }, heroTitle: { fontFamily: t.font.displayBold, color: '#fff', fontSize: 29, lineHeight: 35, letterSpacing: -0.5 }, heroService: { fontFamily: t.font.regular, color: '#d4dfed', fontSize: 14, lineHeight: 21 }, heroMeta: { ...ui.wrap, justifyContent: 'space-between', paddingTop: 5 }, heroCaption: { fontFamily: t.font.regular, fontSize: 12, lineHeight: 19, color: '#c6d4e5' }, heroFooter: { ...ui.wrap, justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#365172', paddingTop: 13, marginTop: 6 }, heroLink: { fontFamily: t.font.semibold, fontSize: 12, color: '#fff' }, emptyHero: { ...ui.row, gap: 8 },
  metrics: { flexDirection: 'row', paddingVertical: 6 }, metric: { flex: 1, gap: 3, alignItems: 'center', minWidth: 0 }, metricBorder: { borderLeftWidth: 1, borderColor: '#dce3d8' }, metricValue: { color: t.colors.ink, fontFamily: t.font.displayBold, fontSize: 28, lineHeight: 34 }, metricLabel: { ...ui.muted, fontSize: 11 }, actions: { ...ui.wrap }, sectionTitle: { ...ui.title, fontSize: 18, lineHeight: 25 }, textButton: { minHeight: 44, justifyContent: 'center', paddingLeft: 8 }, link: { ...ui.text, fontFamily: t.font.semibold, fontSize: 13 },
  agendaRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 17, gap: 10, borderBottomWidth: 1, borderColor: t.colors.border }, timeColumn: { width: 62, gap: 4 }, time: { ...ui.title, fontSize: 12, lineHeight: 20 }, avatar: { width: 34, height: 34, backgroundColor: '#e9edf2', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, initials: { ...ui.title, fontSize: 10 }, service: { ...ui.text, color: t.colors.muted, fontSize: 13 }, emptyAgenda: { paddingVertical: 20, gap: 6 },
  attentionRow: { ...ui.row, minHeight: 59, borderBottomWidth: 1, borderColor: '#e8e4da', paddingVertical: 10 }, attentionCount: { color: '#825a25', backgroundColor: '#f7eddc', borderRadius: 9, padding: 8, minWidth: 34, textAlign: 'center', fontFamily: t.font.semibold, fontSize: 13 }, manage: { marginTop: 18, gap: 5 }, smallHeading: { ...ui.muted, fontSize: 10, letterSpacing: 1 }, manageRow: { ...ui.row, minHeight: 54, borderBottomWidth: 1, borderColor: t.colors.border },
});

import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { BusinessSelector, useBusiness } from '../../store/business-context';
import { businessDate, canManageBusinessMoney, shiftBusinessDate } from '../../lib/business-policy';
import { businessInitials, merchantDay } from '../../lib/merchant-home';
import { getMerchantBookings, getMerchantBootstrap } from '../../lib/api/business';
import { Notice, ui, useBusinessData } from '../../components/business/BusinessUI';
import { BookingCard } from '../../components/business/BookingCard';
import { BookingEditor } from '../../components/business/BookingEditor';
import { tokens as t } from '../../theme/tokens';

type Icon = React.ComponentProps<typeof FontAwesome6>['name'];
export function MerchantTodayScreen() {
  const b = useBusiness(), router = useRouter(), { width, fontScale = 1 } = useWindowDimensions();
  const [create, setCreate] = useState(false), [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => { setNow(new Date()); const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []));
  const day = businessDate(now, b.workspace.timezone), wide = width >= 760 && fontScale <= 1.3;
  const state = useBusinessData(useCallback(async () => {
    const [bookings, bootstrap] = await Promise.all([getMerchantBookings(b.organizationId, shiftBusinessDate(day, -1), shiftBusinessDate(day, 1)), getMerchantBootstrap(b.organizationId)]);
    return { bookings: bookings.bookings.filter(item => businessDate(item.startsAt, b.workspace.timezone) === day), stats: bootstrap.stats };
  }, [b.organizationId, b.workspace.timezone, day]));
  const summary = merchantDay(state.data?.bookings ?? [], now), ready = !!state.data;
  const moneyAccess = canManageBusinessMoney(b.businesses.find(item => item.id === b.organizationId)?.role);
  const push = (route: string) => router.push(route as never);
  const appointment = (id: string) => push(`/business/calendar?booking=${encodeURIComponent(id)}`);
  const time = (date: string) => new Date(date).toLocaleTimeString(undefined, { timeZone: b.workspace.timezone, hour: 'numeric', minute: '2-digit' });
  const actions: { label: string; detail: string; icon: Icon; onPress: () => void; primary?: boolean }[] = [
    b.canManage ? { label: 'New booking', detail: 'Add an appointment', icon: 'calendar-plus', onPress: () => setCreate(true), primary: true } : { label: 'Calendar', detail: 'Your full schedule', icon: 'calendar-days', onPress: () => push('/business/calendar'), primary: true },
    { label: 'Availability', detail: b.canManage ? 'Hours & time off' : 'View working hours', icon: 'clock', onPress: () => push('/business/manage?section=availability') },
    b.canManage ? { label: 'Add service', detail: 'Grow your service menu', icon: 'circle-plus', onPress: () => push('/business/manage?section=services&action=add-service') } : { label: 'Services', detail: 'Browse your menu', icon: 'scissors', onPress: () => push('/business/manage?section=services') },
    moneyAccess ? { label: 'Money', detail: 'Payments & payouts', icon: 'wallet', onPress: () => push('/business/money') } : { label: 'Messages', detail: 'Customer conversations', icon: 'comments', onPress: () => push('/business/inbox') },
  ];
  const attention = [
    { count: summary.pending.length, label: 'Awaiting confirmation', icon: 'calendar-check' as Icon, open: () => appointment(summary.pending[0]!.id) },
    { count: summary.unassigned.length, label: 'Need a team member', icon: 'user-plus' as Icon, open: () => appointment(summary.unassigned[0]!.id) },
    { count: summary.overdue.length, label: 'Past time · update status', icon: 'clock-rotate-left' as Icon, open: () => appointment(summary.overdue[0]!.id) },
    { count: state.data?.stats.openRequests ?? 0, label: 'Open service requests', icon: 'inbox' as Icon, open: () => push('/business/requests') },
  ].filter(item => item.count > 0);
  return <Screen title="Today" eyebrow={b.workspace.displayName} showBack={false}
    subtitle={now.toLocaleDateString(undefined, { timeZone: b.workspace.timezone, weekday: 'long', month: 'long', day: 'numeric' })}
    refreshing={state.loading} onRefresh={() => { setNow(new Date()); void state.refresh(); }}
    action={<Pressable accessibilityRole="button" accessibilityLabel="Business notifications" onPress={() => push('/business/inbox?view=notifications')} style={s.bell}><FontAwesome6 name="bell" size={18} color={t.colors.ink} /></Pressable>}>
    <BusinessSelector />
    <View style={s.hero}>
      <Pressable accessibilityRole={summary.next ? 'button' : undefined} accessibilityLabel={summary.next ? 'View next appointment' : undefined} disabled={!summary.next} onPress={() => summary.next && appointment(summary.next.id)} style={s.heroTop}><View style={s.heroCopy}><Text style={s.eyebrow}>YOUR DAY, IN FOCUS</Text><Text style={s.heroTitle}>{!ready ? state.error ? 'Let’s try that again.' : 'Loading your day…' : summary.remaining.length ? <>{summary.remaining.length}<Text style={{ fontSize: 17 }}>{'\u00a0'}{summary.remaining.length === 1 ? 'appointment' : 'appointments'} left</Text></> : summary.completed ? 'A day well done.' : 'Room for what’s next.'}</Text><Text style={s.heroText}>{!ready ? state.error ? 'Your schedule is unavailable. Try refreshing below.' : 'Fetching your latest schedule.' : summary.next ? `${Date.parse(summary.next.startsAt) <= now.getTime() ? 'In progress' : `Next at ${time(summary.next.startsAt)}`} · ${summary.next.customerName || 'Customer'} →` : summary.overdue.length ? 'Review earlier appointments to keep your day up to date.' : 'Your schedule is ready when you are.'}</Text></View>{width >= 360 && fontScale < 1.5 ? <Image accessible={false} importantForAccessibility="no-hide-descendants" source={require('../../../assets/bookmiz/merchant-day-illustration.png')} resizeMode="contain" style={[s.illustration, wide && { width: 125, height: 100 }]} /> : null}</Pressable>
      <View style={s.heroStats}>{[{ value: ready ? summary.remaining.length : '—', label: 'Remaining' }, { value: ready ? summary.completed : '—', label: 'Completed' }, { value: state.data?.stats.openRequests ?? '—', label: 'Requests' }].map(item => <View key={item.label} style={s.heroStat}><Text style={s.statNumber}>{item.value}</Text><Text style={s.statLabel}>{item.label}</Text></View>)}</View>
    </View>
    {state.error ? <Notice text={`${ready ? 'Showing your last loaded schedule. ' : ''}${state.error}`} onRetry={() => void state.refresh()} /> : null}
    <View style={s.section}><Text accessibilityRole="header" style={s.sectionTitle}>Your shortcuts</Text><View style={s.shortcuts}>{actions.map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} onPress={item.onPress} style={({ pressed }) => [s.shortcut, { width: wide ? '23.5%' : '48%', opacity: pressed ? 0.75 : 1 }, item.primary && s.shortcutPrimary]}><View style={s.shortcutTop}><View style={[s.shortcutIcon, item.primary && { backgroundColor: t.colors.brand }]}><FontAwesome6 name={item.icon} size={17} color={t.colors.ink} /></View><FontAwesome6 name="arrow-right" size={10} color={item.primary ? t.colors.onNavyMuted : t.colors.muted} /></View><Text style={[s.shortcutTitle, item.primary && { color: '#fff' }]}>{item.label}</Text><Text style={[s.shortcutDetail, item.primary && { color: t.colors.onNavyMuted }]}>{item.detail}</Text></Pressable>)}</View></View>
    <View style={[s.columns, wide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
      <View style={[s.section, wide && { flex: 1.7, minWidth: 0 }]}>
        <View style={ui.row}><View style={ui.grow}><Text accessibilityRole="header" style={s.sectionTitle}>Today’s timeline</Text><Text style={s.caption}>{ready ? `${summary.timeline.length} ${summary.timeline.length === 1 ? 'appointment' : 'appointments'} scheduled` : 'Updating your schedule'} · {b.workspace.timezone}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Open full calendar" onPress={() => push('/business/calendar')} style={s.textButton}><Text style={s.link}>Calendar</Text><FontAwesome6 name="arrow-right" size={11} color={t.colors.ink} /></Pressable></View>
        {state.loading && !ready ? <ActivityIndicator accessibilityLabel="Loading today’s appointments" /> : summary.timeline.length ? summary.timeline.map(item => <BookingCard key={item.id} booking={item} featured={item.id === summary.next?.id} onRefresh={state.refresh} />) : !state.error ? <View style={s.empty}><View style={s.emptyIcon}><FontAwesome6 name="calendar-check" size={23} color={t.colors.brandDeep} /></View><Text style={s.sectionTitle}>A little space in your day</Text><Text style={[s.caption, { textAlign: 'center' }]}>Today’s appointments will appear here. View your calendar to plan ahead.</Text><Pressable accessibilityRole="button" onPress={() => push('/business/calendar')} style={s.textButton}><Text style={s.link}>Explore your calendar →</Text></Pressable></View> : null}
      </View>
      <View style={[s.section, wide && { flex: 1, minWidth: 0 }]}>
        <Text accessibilityRole="header" style={s.sectionTitle}>Needs attention</Text>
        {!ready ? <Text style={s.caption}>{state.error ? 'Could not check your updates.' : 'Checking your latest updates…'}</Text> : attention.length ? <View style={s.attention}>{attention.map(item => <Pressable key={item.label} accessibilityRole="button" onPress={item.open} style={s.attentionRow}><View style={s.attentionIcon}><FontAwesome6 name={item.icon} size={15} color={t.colors.warning} /></View><View style={ui.grow}><Text style={s.attentionTitle}>{item.label}</Text><Text style={s.caption}>{item.count} {item.count === 1 ? 'item to review' : 'items to review'}</Text></View><FontAwesome6 name="chevron-right" size={11} color={t.colors.muted} /></Pressable>)}</View> : <View style={[s.attention, { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }]}><FontAwesome6 name="circle-check" size={21} color={t.colors.success} /><View style={ui.grow}><Text style={s.attentionTitle}>You’re all caught up</Text><Text style={s.caption}>No outstanding items for today.</Text></View></View>}
        <View style={s.businessCard}><View style={s.businessAvatar}><Text style={s.initials}>{businessInitials(b.workspace.displayName)}</Text></View><View style={ui.grow}><Text style={s.attentionTitle}>{b.workspace.displayName}</Text><Text style={s.caption}>{state.data ? `${state.data.stats.activeServices} active services · ${state.data.stats.activeStaff} team members` : 'Business overview'}</Text></View></View>
      </View>
    </View>
    {create ? <BookingEditor onClose={() => setCreate(false)} onSaved={state.refresh} /> : null}
  </Screen>;
}

const s = StyleSheet.create({
  section: { gap: 13 }, sectionTitle: { fontFamily: t.font.semibold, color: t.colors.ink, fontSize: 17, lineHeight: 23 },
  bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: t.colors.border, borderRadius: 16 },
  hero: { backgroundColor: t.colors.inkDeep, borderRadius: 24, padding: 18, gap: 14, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }, heroCopy: { flex: 1, minWidth: 0, gap: 7 },
  eyebrow: { fontFamily: t.font.semibold, fontSize: 10, lineHeight: 15, letterSpacing: 1, color: t.colors.onNavyMuted },
  heroTitle: { fontFamily: t.font.displayBold, fontSize: 28, lineHeight: 32, letterSpacing: -0.5, color: '#fff' },
  heroText: { fontFamily: t.font.regular, fontSize: 13, lineHeight: 20, color: t.colors.onNavyMuted }, illustration: { width: 90, height: 90, flexShrink: 0 },
  heroStats: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#355073', paddingTop: 11, gap: 10 }, heroStat: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  statNumber: { color: '#fff', fontFamily: t.font.semibold, fontSize: 20, lineHeight: 25 }, statLabel: { color: t.colors.onNavyMuted, fontFamily: t.font.regular, fontSize: 11 },
  heroLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderColor: '#355073', paddingTop: 8 }, heroLinkText: { fontFamily: t.font.semibold, fontSize: 13, color: t.colors.brand },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }, shortcut: { borderWidth: 1, borderColor: t.colors.border, backgroundColor: '#fff', borderRadius: 18, padding: 12, gap: 4, minHeight: 96 }, shortcutPrimary: { backgroundColor: t.colors.navySoft, borderColor: t.colors.navySoft },
  shortcutTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }, shortcutIcon: { backgroundColor: t.colors.surface, width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, shortcutTitle: { fontFamily: t.font.semibold, fontSize: 14, color: t.colors.ink }, shortcutDetail: { fontFamily: t.font.regular, fontSize: 11, lineHeight: 16, color: t.colors.muted },
  columns: { gap: 22 }, caption: { fontFamily: t.font.regular, fontSize: 12, lineHeight: 18, color: t.colors.muted }, textButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4 }, link: { fontFamily: t.font.semibold, fontSize: 12, color: t.colors.ink },
  attention: { borderWidth: 1, borderColor: t.colors.border, backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden' }, attentionRow: { padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border, minHeight: 76 }, attentionIcon: { width: 34, height: 34, backgroundColor: t.colors.warningSoft, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, attentionTitle: { fontFamily: t.font.semibold, color: t.colors.ink, fontSize: 13, lineHeight: 19 },
  businessCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16, backgroundColor: t.colors.brandSoft, borderRadius: 18 }, businessAvatar: { width: 40, height: 40, backgroundColor: '#fff', borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, initials: { fontFamily: t.font.bold, color: t.colors.ink, fontSize: 14 },
  empty: { backgroundColor: '#fff', borderWidth: 1, borderColor: t.colors.border, borderRadius: 20, padding: 25, gap: 12, alignItems: 'center' }, emptyIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: t.colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
});

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { useBusiness } from '../../store/business-context';
import { businessDate, shiftBusinessDate } from '../../lib/business-policy';
import { businessRequest, getMerchantBookings, type MerchantBooking } from '../../lib/api/business';
import { Action, Choices, Empty, Field, Notice, ui, useBusinessData } from '../../components/business/BusinessUI';
import { BookingEditor } from '../../components/business/BookingEditor';
import { BookingCard } from '../../components/business/BookingCard';
export function MerchantCalendarScreen() {
  const b = useBusiness(), router = useRouter(), { booking: bookingId } = useLocalSearchParams<{ booking?: string }>();
  const [day, setDay] = useState(businessDate(new Date(), b.workspace.timezone)), [search, setSearch] = useState(''), [filter, setFilter] = useState('ALL'), [staff, setStaff] = useState(''), [create, setCreate] = useState(false);
  const state = useBusinessData(useCallback(() => getMerchantBookings(b.organizationId, shiftBusinessDate(day, -1), shiftBusinessDate(day, 7)), [b.organizationId, day]));
  const week = Array.from({ length: 7 }, (_, i) => shiftBusinessDate(day, i));
  const [selected, setSelected] = useState(day);
  const bookings = (state.data?.bookings ?? []).filter(item => businessDate(item.startsAt, b.workspace.timezone) === selected && (filter === 'ALL' || item.status === filter) && (!staff || item.assignedStaffId === staff) && `${item.customerName} ${item.serviceName}`.toLowerCase().includes(search.toLowerCase()));
  const [linkError, setLinkError] = useState('');
  useEffect(() => {
    let active = true;
    if (bookingId) businessRequest<{ booking: MerchantBooking }>(`bookings/${encodeURIComponent(bookingId)}`, b.organizationId).then(result => {
      if (!active) return;
      const date = businessDate(result.booking.startsAt, b.workspace.timezone);
      setDay(date); setSelected(date); setFilter('ALL'); setSearch(''); setStaff(''); setLinkError('');
    }).catch(() => { if (active) setLinkError('This appointment is not available in the selected business.'); });
    return () => { active = false; };
  }, [bookingId, b.organizationId, b.workspace.timezone]);
  const staffItems = [...new Map((state.data?.bookings ?? []).filter(item => item.assignedStaffId).map(item => [item.assignedStaffId!, { id: item.assignedStaffId!, label: item.staffName || 'Team member' }])).values()];
  return <Screen title="Calendar" showBack={false} subtitle={b.workspace.timezone} refreshing={state.loading} onRefresh={() => void state.refresh()} action={b.canManage ? <Action label="New" icon="plus" onPress={() => setCreate(true)} /> : undefined}>
    <View style={ui.card}><View style={[ui.wrap, { justifyContent: 'space-between' }]}><Action label="Previous week" secondary onPress={() => { const next = shiftBusinessDate(day, -7); setDay(next); setSelected(next); }} /><Action label="Today" secondary onPress={() => { const today = businessDate(new Date(), b.workspace.timezone); setDay(today); setSelected(today); }} /><Action label="Next week" secondary onPress={() => { const next = shiftBusinessDate(day, 7); setDay(next); setSelected(next); }} /></View><Choices label="Week" items={week.map(date => ({ id: date, label: new Date(date + 'T12:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }) }))} value={selected} onChange={setSelected} /></View>
    <Field label="Search appointments" placeholder="Customer or service name" value={search} onChangeText={setSearch} />
    <Choices label="Status" items={['ALL', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(s => ({ id: s, label: s.replaceAll('_', ' ') }))} value={filter} onChange={setFilter} />
    {staffItems.length ? <Choices label="Team" items={[{ id: '', label: 'Everyone' }, ...staffItems]} value={staff} onChange={setStaff} /> : null}
    {linkError ? <Notice text={linkError} /> : null}
    {state.error ? <Notice text={state.error} onRetry={() => void state.refresh()} /> : null}
    {state.loading && !state.data ? <ActivityIndicator /> : bookings.length ? bookings.map(item => <BookingCard key={item.id} booking={item} initialOpen={item.id === bookingId} onDismiss={item.id === bookingId ? () => router.setParams({ booking: undefined }) : undefined} onRefresh={state.refresh} />) : !state.error ? <Empty title="No appointments here" text="Choose another day or adjust the filters." /> : null}
    {create ? <BookingEditor onClose={() => setCreate(false)} onSaved={state.refresh} /> : null}
  </Screen>;
}

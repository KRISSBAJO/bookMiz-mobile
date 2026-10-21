import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useBusiness } from '../../store/business-context';
import { businessRequest, getMerchantServices, getMerchantSettings, getMerchantSlots, type MerchantBooking, type Slot } from '../../lib/api/business';
import { businessDate, formatBusinessMoney } from '../../lib/business-policy';
import { Action, Choices, DateField, Editor, Field, Notice, ui, useBusinessData, useBusinessMutation } from './BusinessUI';

export function slotLabel(slot: Slot, timezone: string) {
  return new Date(slot.startAt).toLocaleTimeString(undefined, { timeZone: timezone, hour: 'numeric', minute: '2-digit' });
}
export function BookingEditor({ booking, onClose, onSaved, initialDay, initialStaffId }: { booking?: MerchantBooking; initialDay?: string; initialStaffId?: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const { organizationId: org, workspace, canManage } = useBusiness();
  const resources = useBusinessData(useCallback(async () => {
    const [catalog, settings, customerData] = await Promise.all([getMerchantServices(org), getMerchantSettings(org), businessRequest<{ customers: { id: string; fullName: string }[] }>('customers', org)]);
    return { services: catalog.categories.flatMap(c => c.services).filter(s => s.isActive), settings, customers: customerData.customers };
  }, [org]));
  const [serviceId, setService] = useState(booking?.serviceId ?? ''), [day, setDay] = useState(booking ? businessDate(booking.startsAt, workspace.timezone) : initialDay ?? businessDate(new Date(), workspace.timezone));
  const [staffId, setStaff] = useState(booking?.assignedStaffId ?? initialStaffId ?? ''), [locationId, setLocation] = useState(booking?.locationId ?? '');
  const [customerId, setCustomer] = useState(''), [search, setSearch] = useState(''), [firstName, setFirst] = useState(''), [lastName, setLast] = useState(''), [email, setEmail] = useState(''), [phone, setPhone] = useState(''), [notes, setNotes] = useState('');
  const [channel, setChannel] = useState(booking?.channel ?? 'IN_PERSON');
  const [slots, setSlots] = useState<Slot[]>([]), [slot, setSlot] = useState<Slot | null>(null), [slotError, setSlotError] = useState(''), [finding, setFinding] = useState(false), [review, setReview] = useState(false);
  const mutation = useBusinessMutation();
  const service = resources.data?.services.find(s => s.id === serviceId);
  useEffect(() => { setSlots([]); setSlot(null); setReview(false); }, [serviceId, day, staffId, locationId, channel]);
  function findSlots() {
    void mutation.run(async () => {
      if (!serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(new Date(day).getTime())) throw new Error('Select a service and valid date (YYYY-MM-DD).');
      setFinding(true); setSlotError('');
      try { const result = await getMerchantSlots(org, { serviceId, date: day, ...(staffId ? { staffMemberId: staffId } : {}), ...(locationId ? { locationId } : {}) }); setSlots(result.slots); if (!result.slots.length) setSlotError('No available times. Try another date, location or team member.'); }
      finally { setFinding(false); }
    });
  }
  async function save() {
    await mutation.run(async () => {
      if (!canManage || !slot || !service) throw new Error('Select an available appointment first.');
      if (!booking && !customerId && !firstName.trim()) throw new Error('Enter a customer name or choose an existing customer.');
      if (!booking && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid customer email.');
      const assignedStaffId = staffId || slot.staffMemberId || slot.staffOptions?.[0]?.staffMemberId;
      const selectedLocation = locationId || slot.locationId;
      if (booking) await businessRequest(`bookings/${booking.id}/reschedule`, org, 'PATCH', { startsAt: slot.startAt, ...(assignedStaffId ? { assignedStaffId } : {}), ...(selectedLocation ? { locationId: selectedLocation } : {}), reason: notes.trim() || undefined });
      else await businessRequest('bookings', org, 'POST', { serviceId, expectedPriceCents: service.priceCents, expectedCurrencyCode: service.currencyCode, startsAt: slot.startAt, channel, ...(assignedStaffId ? { assignedStaffId } : {}), ...(selectedLocation ? { locationId: selectedLocation } : {}), ...(customerId ? { customerId } : { firstName: firstName.trim(), lastName: lastName.trim() || undefined, email: email.trim() || undefined, phone: phone.trim() || undefined }), notes: notes.trim() || undefined });
    }, async () => { await onSaved(); onClose(); });
  }
  return <Editor title={booking ? 'Reschedule appointment' : 'New appointment'} subtitle={`Times in ${workspace.timezone}`} busy={mutation.busy} onClose={onClose} footer={<Action label={review ? booking ? 'Confirm new time' : 'Save appointment' : 'Review appointment'} busy={mutation.busy} disabled={!slot || !canManage} onPress={() => review ? void save() : setReview(true)} />}>
    {resources.loading && !resources.data ? <ActivityIndicator /> : null}{resources.error ? <Notice text={resources.error} onRetry={() => void resources.refresh()} /> : null}{mutation.error ? <Notice text={mutation.error} /> : null}
    {review && service && slot ? <><View style={ui.card}><Text style={ui.title}>{booking?.customerName || resources.data?.customers.find(c => c.id === customerId)?.fullName || `${firstName} ${lastName}`}</Text><Text style={ui.text}>{service.name}</Text><Text style={ui.text}>{day} · {slotLabel(slot, workspace.timezone)}</Text><Text style={ui.title}>{formatBusinessMoney(booking?.totalPriceCents ?? service.priceCents, booking?.currencyCode ?? service.currencyCode)}</Text><Text style={ui.muted}>{booking ? 'The original booking price and currency are preserved.' : 'The backend checks availability and the current service price again when saving. Saving does not mark this appointment paid.'}</Text></View><Action secondary label="Back to details" onPress={() => setReview(false)} /></> : <>
      <Choices label="Service" items={(resources.data?.services ?? []).map(s => ({ id: s.id, label: `${s.name} · ${formatBusinessMoney(s.priceCents, s.currencyCode)}` }))} value={serviceId} onChange={v => { setService(v); const selected = resources.data?.services.find(s => s.id === v); setChannel(selected?.defaultChannel ?? 'IN_PERSON'); }} />
      {service ? <Choices label="Appointment type" items={(service.availableChannels.length ? service.availableChannels : [service.defaultChannel]).map(c => ({ id: c, label: c.replaceAll('_', ' ') }))} value={channel} onChange={setChannel} /> : null}
      <DateField label="Appointment date" value={day} onChange={setDay} />
      <Choices label="Team member" items={[{ id: '', label: 'Any available' }, ...(resources.data?.settings.staffMembers ?? []).filter(s => s.isBookable && s.status === 'ACTIVE').map(s => ({ id: s.id, label: s.displayName }))]} value={staffId} onChange={setStaff} />
      <Choices label="Location" items={[{ id: '', label: 'Any location' }, ...(resources.data?.settings.locations ?? []).map(l => ({ id: l.id, label: l.name }))]} value={locationId} onChange={setLocation} />
      <Action label="Find available times" secondary busy={finding} disabled={mutation.busy || !serviceId} onPress={findSlots} />
      {slotError ? <Text style={ui.muted}>{slotError}</Text> : null}
      {slots.length ? <Choices label="Available times" items={slots.map(s => ({ id: s.startAt, label: slotLabel(s, workspace.timezone) }))} value={slot?.startAt ?? ''} onChange={v => setSlot(slots.find(s => s.startAt === v) ?? null)} /> : null}
      {!booking ? <><View style={ui.rule} /><Field label="Find an existing customer" value={search} onChangeText={setSearch} placeholder="Search by name" /><Choices label="Customer" items={[{ id: '', label: 'New customer' }, ...(resources.data?.customers ?? []).filter(c => c.fullName.toLowerCase().includes(search.toLowerCase())).slice(0, 30).map(c => ({ id: c.id, label: c.fullName }))]} value={customerId} onChange={setCustomer} />{!customerId ? <><Field label="First name" value={firstName} onChangeText={setFirst} /><Field label="Last name (optional)" value={lastName} onChangeText={setLast} /><Field label="Customer email (optional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /><Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></> : null}</> : null}
      <Field label={booking ? 'Reschedule reason (optional)' : 'Appointment notes (optional)'} multiline value={notes} onChangeText={setNotes} />
    </>}
  </Editor>;
}

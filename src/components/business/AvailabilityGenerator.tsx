import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useBusiness } from '../../store/business-context';
import { businessRequest, type MerchantService, type MerchantSettings } from '../../lib/api/business';
import { businessDate, validateHours } from '../../lib/business-policy';
import { Action, Choices, DateField, Editor, Field, Notice, ui, useBusinessMutation } from './BusinessUI';
import { weekdays } from './AvailabilityEditor';

type Plan = { planHash: string; timezone: string; slotCount: number; slots: { date: string; startTime: string; endTime: string; staffMemberId: string | null; locationId: string | null; slotCapacity: number }[] };
export function AvailabilityGenerator({ settings, services, onClose, onSaved }: { settings: MerchantSettings; services: MerchantService[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const b = useBusiness(), mutation = useBusinessMutation();
  const [service, setService] = useState(services.find(item => item.isActive)?.id ?? ''), [staff, setStaff] = useState(''), [location, setLocation] = useState('');
  const [from, setFrom] = useState(businessDate(new Date(), b.workspace.timezone)), [to, setTo] = useState(from), [start, setStart] = useState('09:00'), [end, setEnd] = useState('17:00');
  const [days, setDays] = useState([1, 2, 3, 4, 5]), [buffer, setBuffer] = useState('0'), [capacity, setCapacity] = useState('1');
  const [review, setReview] = useState<{ plan: Plan; input: Record<string, unknown> } | null>(null), [created, setCreated] = useState<{ createdCount: number; skippedCount: number } | null>(null);
  const save = () => mutation.run(async () => {
    if (!b.canManage) throw new Error('Only managers can generate availability.');
    if (review) {
      try {
        const result = await businessRequest<{ createdCount: number; skippedCount: number }>('time-slots/auto-generate', b.organizationId, 'POST', { ...review.input, expectedPlanHash: review.plan.planHash });
        setCreated(result); await onSaved();
      } catch (error) { setReview(null); throw error; }
      return;
    }
    validateHours(start, end);
    if (!service || !days.length) throw new Error('Choose a service and at least one weekday.');
    if (!/^\d+$/.test(buffer) || Number(buffer) > 240 || !/^\d+$/.test(capacity) || Number(capacity) < 1 || Number(capacity) > 100) throw new Error('Use a buffer of 0–240 minutes and capacity of 1–100.');
    const input = { serviceId: service, startDate: from, endDate: to, weekdays: days, startTime: start, endTime: end, bufferMinutes: Number(buffer), slotCapacity: Number(capacity), ...(staff ? { staffMemberId: staff } : {}), ...(location ? { locationId: location } : {}) };
    const plan = await businessRequest<Plan>('time-slots/preview', b.organizationId, 'POST', input);
    setReview({ plan, input });
  });
  return <Editor title={created ? 'Availability ready' : review ? 'Review your availability' : 'Generate availability'} subtitle={b.workspace.timezone} busy={mutation.busy} onClose={onClose} footer={created ? <Action label="Done" onPress={onClose} /> : <Action label={review ? 'Confirm & create slots' : 'Preview available slots'} busy={mutation.busy} disabled={!!review && !review.plan.slotCount} onPress={() => void save()} />}>
    {mutation.error ? <Notice text={mutation.error} /> : null}
    {created ? <View style={ui.card}><Text style={ui.title}>{created.createdCount} slots created</Text><Text style={ui.text}>{created.skippedCount} matching slots already existed and were kept.</Text><Text style={ui.muted}>Customers can book within your hours, breaks and team availability. Existing appointments are unchanged.</Text></View> : review ? <>
      <View style={ui.card}><Text style={ui.title}>{review.plan.slotCount} slots planned</Text><Text style={ui.text}>{services.find(item => item.id === review.input.serviceId)?.name}</Text><Text style={ui.muted}>{String(review.input.startDate)} → {String(review.input.endDate)} · {String(review.input.startTime)}–{String(review.input.endTime)}</Text><Text style={ui.muted}>Breaks, time off, existing bookings, service buffers and booking limits have been checked. Matching slots will be skipped. Availability is checked again when you confirm.</Text></View>
      {!review.plan.slotCount ? <Text style={ui.text}>No available slots. Set working hours first, or adjust the dates, service, location or team member.</Text> : review.plan.slots.slice(0, 40).map((slot, index) => <View key={index} style={[ui.row, { paddingVertical: 10, borderBottomWidth: 1, borderColor: '#e2e7ec' }]}><View style={ui.grow}><Text style={ui.text}>{slot.date.slice(0, 10)} · {slot.startTime}–{slot.endTime}</Text><Text style={ui.muted}>{settings.staffMembers.find(item => item.id === slot.staffMemberId)?.displayName || 'Whole business'} · {settings.locations.find(item => item.id === slot.locationId)?.name || 'All locations'}</Text></View><Text style={ui.muted}>Capacity {slot.slotCapacity}</Text></View>)}
      {review.plan.slotCount > 40 ? <Text style={ui.muted}>Showing the first 40 of {review.plan.slotCount} planned slots.</Text> : null}<Action secondary label="Change details" disabled={mutation.busy} onPress={() => { setReview(null); mutation.clearError(); }} />
    </> : <>
      <Text style={ui.text}>Turn your working hours into service slots. Preview up to 31 days before creating them.</Text>
      <Choices label="Service" value={service} onChange={setService} items={services.filter(item => item.isActive).map(item => ({ id: item.id, label: item.name }))} />
      <DateField label="From date" value={from} onChange={setFrom} /><DateField label="Through date" value={to} onChange={setTo} />
      <Text style={ui.label}>Repeat on</Text><View style={ui.wrap}>{weekdays.map((label, index) => <Pressable key={label} accessibilityRole="checkbox" accessibilityState={{ checked: days.includes(index) }} onPress={() => setDays(current => current.includes(index) ? current.filter(day => day !== index) : [...current, index].sort())} style={{ minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#d3dce6', borderRadius: 12, backgroundColor: days.includes(index) ? '#e8f4c5' : '#fff' }}><Text style={ui.text}>{label.slice(0, 3)}</Text></Pressable>)}</View>
      <View style={ui.row}><View style={ui.grow}><DateField label="Starts" time value={start} onChange={setStart} /></View><View style={ui.grow}><DateField label="Ends" time endOfDay value={end} onChange={setEnd} /></View></View>
      <Choices label="Team member" value={staff} onChange={setStaff} items={[{ id: '', label: 'All eligible team members' }, ...settings.staffMembers.filter(item => item.status === 'ACTIVE' && item.isBookable).map(item => ({ id: item.id, label: item.displayName }))]} />
      <Choices label="Location" value={location} onChange={setLocation} items={[{ id: '', label: 'All locations' }, ...settings.locations.map(item => ({ id: item.id, label: item.name }))]} />
      <Field label="Extra gap between generated slots (minutes)" value={buffer} onChangeText={setBuffer} keyboardType="number-pad" /><Field label="Maximum capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
      <Text style={ui.muted}>Capacity cannot exceed your working-hour rules. Service buffers already apply; the extra gap spaces the generated slots further apart.</Text>
    </>}
  </Editor>;
}

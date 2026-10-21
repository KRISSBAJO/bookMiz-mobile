import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useBusiness } from '../../store/business-context';
import { businessRequest, type MerchantSettings, type MerchantService, type Rule } from '../../lib/api/business';
import { businessDate, businessDateTimeToIso, validateHours } from '../../lib/business-policy';
import { Action, Choices, DateField, Editor, Field, Notice, ui, useBusinessMutation } from './BusinessUI';
export const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function AvailabilityEditor({ rule, timeOff, settings, services = [], dateOnly, onClose, onSaved }: { rule?: Rule; timeOff?: boolean; dateOnly?: boolean; services?: MerchantService[]; settings: MerchantSettings; onClose: () => void; onSaved: () => Promise<void> }) {
  const b = useBusiness(), mutation = useBusinessMutation();
  const [type, setType] = useState(rule?.type ?? (dateOnly ? 'DATE_OVERRIDE' : 'WEEKLY')), [weekday, setWeekday] = useState(String(rule?.weekday ?? 1)), [day, setDay] = useState(rule?.date?.slice(0, 10) ?? businessDate(new Date(), b.workspace.timezone)), [endDay, setEndDay] = useState(day), [start, setStart] = useState(rule?.startTime ?? '09:00'), [end, setEnd] = useState(rule?.endTime ?? '17:00');
  const [staff, setStaff] = useState(rule?.staffMemberId ?? ''), [location, setLocation] = useState(rule?.locationId ?? ''), [bookable, setBookable] = useState(rule?.isBookable ?? true), [title, setTitle] = useState('Time off');
  const [service, setService] = useState(rule?.serviceId ?? ''), [capacity, setCapacity] = useState(String(rule?.slotCapacity ?? 1));
  return <Editor title={timeOff ? 'Block time off' : rule ? 'Edit availability' : 'Add availability'} subtitle={`Use business time: ${b.workspace.timezone}`} busy={mutation.busy} onClose={onClose} footer={<Action label="Save availability" busy={mutation.busy} onPress={() => void mutation.run(async () => {
    if (!b.canManage) throw new Error('Only managers can change availability.');
    if (timeOff) {
      if (!staff || !title.trim()) throw new Error('Choose a team member and enter a title.');
      const startsAt = businessDateTimeToIso(day, start, b.workspace.timezone), endsAt = businessDateTimeToIso(endDay, end, b.workspace.timezone);
      if (startsAt >= endsAt) throw new Error('Time off must end after it starts.');
      await businessRequest('time-offs', b.organizationId, 'POST', { staffMemberId: staff, title: title.trim(), startsAt, endsAt, isAllDay: false });
    } else {
      validateHours(start, end);
      if (!/^\d+$/.test(capacity) || Number(capacity) < 1 || Number(capacity) > 100) throw new Error('Capacity must be between 1 and 100.');
      if (type === 'DATE_OVERRIDE') businessDateTimeToIso(day, start, b.workspace.timezone);
      await businessRequest(rule ? `availability-rules/${rule.id}` : 'availability-rules', b.organizationId, rule ? 'PATCH' : 'POST', { type, ...(type === 'WEEKLY' ? { weekday: Number(weekday) } : { date: day }), startTime: start, endTime: end, isBookable: bookable, slotCapacity: Number(capacity), ...(staff ? { staffMemberId: staff } : {}), ...(location ? { locationId: location } : {}), ...(service ? { serviceId: service } : {}) });
    }
  }, async () => { await onSaved(); onClose(); })} />}>
    {mutation.error ? <Notice text={mutation.error} /> : null}
    {!timeOff ? <Choices label="Service" value={service} onChange={setService} items={[{ id: '', label: 'All services' }, ...services.map(item => ({ id: item.id, label: item.name }))]} /> : null}
    {timeOff ? <Field label="Time-off title" value={title} onChangeText={setTitle} /> : <Choices label="Repeats" items={[{ id: 'WEEKLY', label: 'Every week' }, { id: 'DATE_OVERRIDE', label: 'Specific date' }]} value={type} onChange={setType} />}
    {!timeOff && type === 'WEEKLY' ? <Choices label="Weekday" items={weekdays.map((label, i) => ({ id: String(i), label }))} value={weekday} onChange={setWeekday} /> : <DateField label="Start date" value={day} onChange={setDay} />}
    {timeOff ? <DateField label="End date" value={endDay} onChange={setEndDay} /> : null}
    <View style={ui.row}><View style={ui.grow}><DateField label="Starts" time value={start} onChange={setStart} /></View><View style={ui.grow}><DateField label="Ends" time endOfDay={!timeOff} value={end} onChange={setEnd} /></View></View>
    <Choices label="Team member" items={[...(!timeOff && !rule?.staffMemberId ? [{ id: '', label: 'Whole business' }] : []), ...settings.staffMembers.map(s => ({ id: s.id, label: s.displayName }))]} value={staff} onChange={setStaff} />
    {!timeOff ? <><Field label="Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" /><Choices label="Location" items={[...(!rule?.locationId ? [{ id: '', label: 'All locations' }] : []), ...settings.locations.map(l => ({ id: l.id, label: l.name }))]} value={location} onChange={setLocation} /><View style={ui.row}><Text style={[ui.text, ui.grow]}>Customers can book these hours</Text><Switch accessibilityLabel="Bookable hours" value={bookable} onValueChange={setBookable} /></View><Text style={ui.muted}>Turn off to block a break or an unavailable period. Existing bookings are not automatically cancelled.</Text></> : null}
  </Editor>;
}

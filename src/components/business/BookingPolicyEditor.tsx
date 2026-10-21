import { useState } from 'react';
import { Text } from 'react-native';
import { useBusiness } from '../../store/business-context';
import { businessRequest, type MerchantSettings } from '../../lib/api/business';
import { Action, Editor, Field, Notice, ui, useBusinessMutation } from './BusinessUI';
export function BookingPolicyEditor({ settings, onClose, onSaved }: { settings: MerchantSettings; onClose: () => void; onSaved: () => Promise<void> }) {
  const b = useBusiness(), mutation = useBusinessMutation(), profile = settings.profile;
  const [cancel, setCancel] = useState(String(profile?.cancellationWindowHours ?? 24)), [reschedule, setReschedule] = useState(String(profile?.rescheduleWindowHours ?? profile?.cancellationWindowHours ?? 24));
  const [minimum, setMinimum] = useState(String(profile?.minAdvanceBookingHours ?? 1)), [maximum, setMaximum] = useState(String(profile?.maxAdvanceBookingDays ?? 90)), [policy, setPolicy] = useState(profile?.cancellationPolicy ?? '');
  function number(value: string, min: number, max: number, label: string) { const result = Number(value); if (!/^\d+$/.test(value) || !Number.isInteger(result) || result < min || result > max) throw new Error(`${label} must be ${min}–${max}.`); return result; }
  return <Editor title="Booking & change policies" subtitle={b.workspace.timezone} onClose={onClose} busy={mutation.busy} footer={<Action label="Save policies" busy={mutation.busy} onPress={() => void mutation.run(async () => {
    if (!b.canManage) throw new Error('Only business managers can update policies.');
    await businessRequest('profile', b.organizationId, 'PATCH', { cancellationWindowHours: number(cancel, 0, 720, 'Cancellation notice'), rescheduleWindowHours: number(reschedule, 0, 720, 'Rescheduling notice'), minAdvanceBookingHours: number(minimum, 0, 168, 'Minimum advance hours'), maxAdvanceBookingDays: number(maximum, 1, 730, 'Maximum advance days'), cancellationPolicy: policy.trim() });
  }, async () => { await onSaved(); onClose(); })} />}>
    {mutation.error ? <Notice text={mutation.error} /> : null}
    <Text style={ui.text}>Set how much notice customers must give. Their exact deadlines appear before booking and on the appointment.</Text>
    <Field label="Cancellation notice (hours before appointment)" value={cancel} onChangeText={setCancel} keyboardType="number-pad" />
    <Field label="Rescheduling notice (hours before appointment)" value={reschedule} onChangeText={setReschedule} keyboardType="number-pad" />
    <Text style={ui.muted}>0 allows changes until the appointment starts. 24 requires at least one day's notice. Business managers can help with exceptions.</Text>
    <Field label="Minimum advance booking (hours)" value={minimum} onChangeText={setMinimum} keyboardType="number-pad" />
    <Field label="Maximum advance booking (days)" value={maximum} onChangeText={setMaximum} keyboardType="number-pad" />
    <Field label="Additional cancellation policy" value={policy} onChangeText={setPolicy} multiline maxLength={5000} />
    <Text style={ui.muted}>New policies apply to new appointments. Existing appointments keep their recorded notice periods and policy. Saving policies does not charge cancellation fees or change a payment/refund.</Text>
  </Editor>;
}

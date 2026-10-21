import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useBusiness } from '../../store/business-context';
import { businessRequest, type MerchantBooking } from '../../lib/api/business';
import { bookingActions, formatBusinessMoney } from '../../lib/business-policy';
import { Action, Badge, Editor, Field, Notice, ui, useBusinessMutation } from './BusinessUI';
import { BookingEditor } from './BookingEditor';
export function BookingCard({ booking: b, onRefresh, initialOpen = false }: { booking: MerchantBooking; initialOpen?: boolean; onRefresh: () => Promise<void> }) {
  const business = useBusiness(), mutation = useBusinessMutation();
  const [open, setOpen] = useState(initialOpen), [reschedule, setReschedule] = useState(false), [nextStatus, setNext] = useState(''), [reason, setReason] = useState('');
  const time = new Date(b.startsAt).toLocaleTimeString(undefined, { timeZone: business.workspace.timezone, hour: 'numeric', minute: '2-digit' });
  const actionNames: Record<string, string> = { CONFIRMED: 'Confirm booking', CHECKED_IN: 'Check in', COMPLETED: 'Complete appointment', NO_SHOW: 'Mark no-show', CANCELLED: 'Cancel appointment' };
  async function change() { await mutation.run(async () => { await businessRequest(`bookings/${b.id}/${nextStatus === 'CANCELLED' ? 'cancel' : 'status'}`, business.organizationId, 'PATCH', { ...(nextStatus === 'CANCELLED' ? {} : { status: nextStatus }), reason: reason.trim() || undefined }); }, async () => { setNext(''); setOpen(false); await onRefresh(); }); }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${time}, ${b.customerName}, ${b.serviceName}, ${b.status}`} onPress={() => setOpen(true)} style={[ui.card, { flexDirection: 'row', padding: 14 }]}>
      <View style={{ width: 65, borderRightWidth: 1, borderColor: '#e3e9f2', paddingRight: 10 }}><Text style={[ui.title, { fontSize: 13 }]}>{time}</Text><Text style={ui.muted}>{Math.round((new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) / 60000)} min</Text></View>
      <View style={ui.grow}><View style={[ui.row, { flexWrap: 'wrap', justifyContent: 'space-between' }]}><Text style={[ui.title, { fontSize: 14, flexShrink: 1 }]}>{b.customerName}</Text><Badge value={b.status} /></View><Text style={ui.text}>{b.serviceName}</Text><Text style={ui.muted}>{b.staffName || 'Unassigned'} · {formatBusinessMoney(b.totalPriceCents, b.currencyCode)}</Text></View>
    </Pressable>
    {open ? <Editor title="Appointment" subtitle={new Date(b.startsAt).toLocaleDateString(undefined, { timeZone: business.workspace.timezone, weekday: 'long', day: 'numeric', month: 'long' })} busy={mutation.busy} onClose={() => { setOpen(false); setNext(''); }}>
      <View style={ui.card}><Text style={ui.title}>{b.customerName}</Text><Text style={ui.text}>{b.serviceName}</Text><Text style={ui.text}>{time} · {business.workspace.timezone}</Text><View style={ui.wrap}><Badge value={b.status} /><Badge value={b.paymentStatus} /></View><Text style={ui.title}>{formatBusinessMoney(b.totalPriceCents, b.currencyCode)}</Text><Text style={ui.muted}>{b.staffName || 'No team member assigned'} · {b.locationName || b.channel.replaceAll('_', ' ')}</Text>{b.notes ? <Text style={ui.text}>{b.notes}</Text> : null}</View>
      <View style={ui.wrap}>{b.customerPhone ? <Action label="Call customer" secondary onPress={() => void mutation.run(() => Linking.openURL('tel:' + b.customerPhone?.replace(/[^+\d]/g, '')))} /> : null}{b.customerEmail ? <Action label="Email customer" secondary onPress={() => void mutation.run(() => Linking.openURL('mailto:' + encodeURIComponent(b.customerEmail!)))} /> : null}</View>
      {mutation.error ? <Notice text={mutation.error} /> : null}
      {!business.canManage ? <Text style={ui.muted}>Read-only staff access. Ask a manager to change this appointment.</Text> : nextStatus ? <View style={ui.card}><Text style={ui.title}>{actionNames[nextStatus]}?</Text><Text style={ui.text}>{nextStatus === 'CANCELLED' ? 'This releases the appointment time. Any eligible refund follows the existing payment policy.' : 'The appointment status and customer updates will be handled by BookMiz.'}</Text><Field label="Reason (optional)" value={reason} onChangeText={setReason} /><Action label="Confirm change" danger={nextStatus === 'CANCELLED'} busy={mutation.busy} onPress={() => void change()} /><Action label="Keep appointment unchanged" secondary disabled={mutation.busy} onPress={() => setNext('')} /></View> : <View style={ui.section}>{['PENDING', 'CONFIRMED'].includes(b.status) ? <Action label="Reschedule" secondary onPress={() => { setOpen(false); setReschedule(true); }} /> : null}{bookingActions(b.status).map(status => <Action key={status} label={actionNames[status]!} danger={status === 'CANCELLED'} secondary={status === 'NO_SHOW'} onPress={() => setNext(status)} />)}</View>}
    </Editor> : null}
    {reschedule ? <BookingEditor booking={b} onClose={() => setReschedule(false)} onSaved={onRefresh} /> : null}
  </>;
}

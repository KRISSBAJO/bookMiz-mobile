import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { tokens as t } from '../../theme/tokens';
import { getFriendlyApiError } from '../../lib/api/error-display';

export const ui = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: t.colors.border, borderRadius: 18, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  title: { color: t.colors.ink, fontFamily: t.font.semibold, fontSize: 16, lineHeight: 22 },
  text: { color: t.colors.ink, fontFamily: t.font.regular, fontSize: 14, lineHeight: 21 },
  muted: { color: t.colors.muted, fontFamily: t.font.regular, fontSize: 12, lineHeight: 18 },
  section: { gap: 12 }, grow: { flex: 1, minWidth: 0 },
  label: { fontFamily: t.font.semibold, color: t.colors.ink, fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: t.colors.borderStrong, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, minHeight: 46, color: t.colors.ink, fontFamily: t.font.regular, fontSize: 14 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border },
});
export function Action({ label, onPress, secondary, danger, disabled, busy, icon }: { label: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean; busy?: boolean; icon?: React.ComponentProps<typeof FontAwesome6>['name'] }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, paddingVertical: 11, paddingHorizontal: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: danger ? '#f1cdcd' : secondary ? t.colors.borderStrong : t.colors.inkDeep, backgroundColor: secondary || danger ? '#fff' : t.colors.inkDeep, opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1 })}>
    {busy ? <ActivityIndicator size="small" color={secondary ? t.colors.ink : '#fff'} /> : icon ? <FontAwesome6 name={icon} size={13} color={danger ? t.colors.danger : secondary ? t.colors.ink : '#fff'} /> : null}<Text style={{ fontFamily: t.font.semibold, fontSize: 13, color: danger ? t.colors.danger : secondary ? t.colors.ink : '#fff' }}>{label}</Text>
  </Pressable>;
}
export function Badge({ value }: { value: string }) {
  const good = ['CONFIRMED', 'COMPLETED', 'PAID', 'ACTIVE', 'ACCEPTED', 'UNLOCKED'].includes(value);
  const bad = ['CANCELLED', 'DECLINED', 'NO_SHOW', 'EXPIRED'].includes(value);
  return <View style={{ alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: good ? t.colors.successSoft : bad ? t.colors.dangerSoft : t.colors.surface }}><Text style={{ fontFamily: t.font.semibold, fontSize: 10, color: good ? t.colors.success : bad ? t.colors.danger : t.colors.muted }}>{value.replaceAll('_', ' ')}</Text></View>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={t.colors.mutedSoft} {...props} style={[ui.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]} /></View>;
}
export function DateField({ label, value, onChange, time, endOfDay }: { label: string; value: string; onChange: (v: string) => void; time?: boolean; endOfDay?: boolean }) {
  const [open, setOpen] = useState(false);
  if (Platform.OS === 'web') return <Field label={label} value={value} onChangeText={onChange} placeholder={time ? '09:00' : 'YYYY-MM-DD'} />;
  const date = time ? new Date(2026, 0, 1, Number(value.slice(0, 2)) % 24 || 0, Number(value.slice(3, 5)) || 0) : new Date(value + 'T12:00:00');
  const formatted = time ? value : Number.isNaN(date.getTime()) ? 'Choose date' : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return <View style={{ gap: 7 }}><Text style={ui.label}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(v => !v)} style={[ui.input, ui.row]}><Text style={[ui.text, ui.grow]}>{formatted}</Text><FontAwesome6 name={time ? 'clock' : 'calendar-days'} size={16} color={t.colors.muted} /></Pressable>{open ? <><DateTimePicker mode={time ? 'time' : 'date'} value={Number.isNaN(date.getTime()) ? new Date() : date} is24Hour onChange={(event, next) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed' || !next) return;
    const pad = (n: number) => String(n).padStart(2, '0');
    onChange(time ? (endOfDay && next.getHours() === 0 && next.getMinutes() === 0 ? '24:00' : `${pad(next.getHours())}:${pad(next.getMinutes())}`) : `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`);
  }} />{Platform.OS === 'ios' ? <Action secondary label="Done" onPress={() => setOpen(false)} /> : null}</> : null}</View>;
}
export function Choices({ label, items, value, onChange }: { label: string; items: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return <View style={{ gap: 6 }}><Text style={ui.label}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{items.map(i => <Pressable key={i.id} accessibilityRole="button" accessibilityState={{ selected: value === i.id }} onPress={() => onChange(i.id)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: value === i.id ? t.colors.ink : t.colors.border, backgroundColor: value === i.id ? t.colors.brandSoft : '#fff' }}><Text style={{ ...ui.muted, color: t.colors.ink, fontFamily: t.font.medium }}>{i.label}</Text></Pressable>)}</ScrollView></View>;
}
export function Empty({ title, text }: { title: string; text: string }) {
  return <View style={[ui.card, { paddingVertical: 30, alignItems: 'center' }]}><FontAwesome6 name="calendar-check" color={t.colors.mutedSoft} size={24} /><Text style={ui.title}>{title}</Text><Text style={[ui.muted, { textAlign: 'center' }]}>{text}</Text></View>;
}
export function Notice({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return <View accessibilityRole="alert" style={[ui.card, { backgroundColor: t.colors.dangerSoft, borderColor: '#f1cdcd' }]}><Text style={[ui.text, { color: t.colors.danger }]}>{text}</Text>{onRetry ? <Action label="Try again" onPress={onRetry} secondary /> : null}</View>;
}
export function Editor({ title, subtitle, children, onClose, footer, busy }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; footer?: ReactNode; busy?: boolean }) {
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!busy) onClose(); }}><SafeAreaView style={{ flex: 1, backgroundColor: t.colors.surface }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={[ui.row, { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: t.colors.border }]}><View style={ui.grow}><Text accessibilityRole="header" style={ui.title}>{title}</Text>{subtitle ? <Text style={ui.muted}>{subtitle}</Text> : null}</View><Action label="Close" secondary disabled={busy} onPress={onClose} /></View>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 18, paddingBottom: 30, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center' }}>{children}</ScrollView>
    {footer ? <View style={{ padding: 14, borderTopWidth: 1, borderColor: t.colors.border, backgroundColor: '#fff' }}>{footer}</View> : null}
  </KeyboardAvoidingView></SafeAreaView></Modal>;
}
export function useBusinessData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const generation = useRef(0), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError('');
    try { const next = await loader(); if (mounted.current && request === generation.current) setData(next); }
    catch (e) { if (mounted.current && request === generation.current) setError(getFriendlyApiError(e, 'Could not load the business workspace.')); }
    finally { if (mounted.current && request === generation.current) setLoading(false); }
  }, [loader]);
  useFocusEffect(useCallback(() => { void refresh(); return () => { generation.current++; }; }, [refresh]));
  return { data, error, loading, refresh };
}
export function useBusinessMutation() {
  const lock = useRef(false), active = useRef(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function run(work: () => Promise<unknown>, after?: () => void | Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await work(); if (active.current) await after?.(); }
    catch (e) { if (active.current) setError(getFriendlyApiError(e, 'Could not save. Your changes have been kept.')); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  return { busy, error, run, clearError: () => setError('') };
}

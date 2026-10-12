import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMarketplaceProvider } from "@/src/lib/api/marketplace";
import { createCustomerBooking, getPublicBookingAvailability } from "@/src/lib/api/bookings";
import type { MarketplaceProviderProfile, PublicAvailabilitySlot } from "@/src/lib/api/types";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import { useSession } from "@/src/store/session-context";
import { openBookingCheckout } from "@/src/lib/open-booking-checkout";

export function NativeBookingScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const session = useSession();
  const [profile, setProfile] = useState<MarketplaceProviderProfile | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [selected, setSelected] = useState<PublicAvailabilitySlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [channel, setChannel] = useState("");
  const [intake, setIntake] = useState<Record<string, string | string[] | boolean>>({});

  useEffect(() => {
    let active = true;
    getMarketplaceProvider(slug).then(value => {
      if (!active) return;
      setProfile(value);
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: value.provider.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
      setDate(`${parts.year}-${parts.month}-${parts.day}`);
      const first = value.services.groups.flatMap(group => group.services)[0] || value.services.suggested[0];
      if (first) setServiceId(first.id);
    }).catch(reason => { if (active) setError(getFriendlyApiError(reason, "Could not load this business.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const services = useMemo(() => profile?.services.groups.flatMap(group => group.services) || [], [profile]);
  const service = services.find(value => value.id === serviceId) || profile?.services.suggested.find(value => value.id === serviceId);

  async function loadSlots() {
    if (!profile || !serviceId) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) { setError("Enter a date as YYYY-MM-DD."); return; }
    setBusy(true); setError(null); setSelected(null);
    try {
      const result = await getPublicBookingAvailability({ providerId: profile.provider.id, serviceId, date: date + "T00:00:00.000Z" });
      setSlots(result.slots);
    } catch (reason) { setError(getFriendlyApiError(reason, "Could not load appointment times.")); }
    finally { setBusy(false); }
  }

  async function book() {
    if (!session.user || !profile || !service || !selected || busy || createdId) return;
    const missing = service.intakeFields.find(field => field.required && (field.type === 'BOOLEAN' ? typeof intake[String(field.id)] !== 'boolean' : Array.isArray(intake[String(field.id)]) ? !(intake[String(field.id)] as string[]).length : !String(intake[String(field.id)] ?? '').trim()));
    if (missing) { setError(`Answer "${String(missing.label)}" before booking.`); return; }
    setBusy(true); setError(null);
    try {
      const result = await createCustomerBooking({ providerId: profile.provider.id, serviceId: service.id, startsAt: selected.startAt, assignedStaffId: selected.staffOptions?.[0]?.staffMemberId, locationId: selected.locationId, channel: channel || service.defaultChannel, firstName: session.user.firstName, lastName: session.user.lastName, email: session.user.email, phone: session.profile?.phone || undefined, notes, intakeResponses: service.intakeFields.filter(field => intake[String(field.id)] !== undefined).map(field => ({ fieldId: field.id, label: field.label, type: field.type, value: intake[String(field.id)] })), requestedDocumentLabels: service.requiredDocumentLabels });
      setCreatedId(result.id);
      if (result.payment?.authorizationUrl) {
        await openBookingCheckout(result.payment.authorizationUrl);
      } else if (result.payment?.method === "UNAVAILABLE") setError(result.payment.message || "Your booking is reserved. Contact the provider about payment.");
    } catch (reason) { setError(getFriendlyApiError(reason, "Could not reserve this appointment.")); }
    finally { setBusy(false); }
  }

  if (loading) return <SafeAreaView style={styles.root}><ActivityIndicator /><Text>Loading booking…</Text></SafeAreaView>;
  return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={styles.link}>Back</Text></Pressable>
    <Text style={styles.title}>{profile?.provider.displayName || "Book an appointment"}</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {!session.isSignedIn ? <View><Text>Sign in to keep this booking in your appointments.</Text><Pressable style={styles.button} onPress={() => router.push("/login")}><Text style={styles.buttonText}>Sign in</Text></Pressable></View> : createdId ? <View>
      <Text style={styles.heading}>Your appointment is reserved.</Text><Text>Open your appointment to check its payment status and details.</Text>
      <Pressable style={styles.button} onPress={() => router.replace({ pathname: "/appointments/[bookingId]", params: { bookingId: createdId } })}><Text style={styles.buttonText}>View appointment</Text></Pressable>
    </View> : <>
      <Text style={styles.heading}>Choose a service</Text>
      {(services.length ? services : profile?.services.suggested || []).map(value => <Pressable key={value.id} style={[styles.choice, serviceId === value.id && styles.selected]} onPress={() => { setServiceId(value.id); setSlots([]); setSelected(null); setChannel(''); setIntake({}); }}><Text>{value.name} · {value.durationMinutes} minutes</Text></Pressable>)}
      {service ? <View style={{gap:12}}>
        <Text style={styles.heading}>Appointment type</Text>
        {(service.availableChannels.length ? service.availableChannels : [service.defaultChannel]).map(value => <Pressable key={value} style={[styles.choice,(channel || service.defaultChannel) === value && styles.selected]} onPress={() => setChannel(value)}><Text>{{IN_PERSON:'Office visit',PHONE:'Phone call',VIDEO:'Video call',HOME_VISIT:'Home visit'}[value] || value}</Text></Pressable>)}
        {service.intakeFields.map(field => {
          const id=String(field.id),value=intake[id],options=Array.isArray(field.options) ? field.options.filter((option): option is string=>typeof option==='string') : [];
          const update=(next:string|string[]|boolean)=>setIntake(current=>({...current,[id]:next}));
          return <View key={id} style={{gap:8}}><Text>{String(field.label)}{field.required ? ' *' : ''}</Text>
            {field.helpText ? <Text>{String(field.helpText)}</Text> : null}
            {field.type==='BOOLEAN' ? [true,false].map(option=><Pressable key={String(option)} style={[styles.choice,value===option&&styles.selected]} onPress={()=>update(option)}><Text>{option?'Yes':'No'}</Text></Pressable>) : field.type==='SELECT'||field.type==='MULTI_SELECT' ? options.map(option=><Pressable key={option} style={[styles.choice,(value===option||Array.isArray(value)&&value.includes(option))&&styles.selected]} onPress={()=>update(field.type==='SELECT'?option:Array.isArray(value)&&value.includes(option)?value.filter(item=>item!==option):[...(Array.isArray(value)?value:[]),option])}><Text>{option}</Text></Pressable>) : <TextInput accessibilityLabel={String(field.label)} placeholder={String(field.placeholder || '')} value={typeof value==='string'?value:''} onChangeText={update} multiline={field.type==='LONG_TEXT'} style={styles.input}/>}
          </View>;
        })}
        {service.requiredDocumentLabels.length ? <Text>Documents requested by the provider: {service.requiredDocumentLabels.join(', ')}. Contact the provider to arrange submission.</Text> : null}
      </View> : null}
      <Text style={styles.heading}>Appointment date</Text>
      {service && profile?.provider.currencyCode ? <Text>Service price: {new Intl.NumberFormat(undefined, { style: 'currency', currency: profile.provider.currencyCode }).format(service.priceCents / 100)}</Text> : null}
      <TextInput accessibilityLabel="Appointment date" placeholder="YYYY-MM-DD" value={date} onChangeText={value => { setDate(value); setSlots([]); setSelected(null); }} style={styles.input} />
      <Pressable style={styles.button} disabled={busy || !serviceId} onPress={() => void loadSlots()}><Text style={styles.buttonText}>{busy ? "Loading…" : "Find available times"}</Text></Pressable>
      <Text>The appointment date uses the business timezone. Times below are shown in your device&apos;s timezone.</Text>
      {slots.map(slot => <Pressable key={slot.startAt} style={[styles.choice, selected?.startAt === slot.startAt && styles.selected]} onPress={() => setSelected(slot)}><Text>{new Date(slot.startAt).toLocaleString()}</Text></Pressable>)}
      <TextInput accessibilityLabel="Appointment notes" placeholder="Notes for the provider (optional)" value={notes} onChangeText={setNotes} multiline style={styles.input} />
      <Text>Online payment opens a secure checkout after your appointment is reserved.</Text>
      <Pressable style={styles.button} disabled={busy || !selected} onPress={() => void book()}><Text style={styles.buttonText}>{busy ? "Reserving…" : "Reserve and continue to payment"}</Text></Pressable>
    </>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#fff" }, content: { padding: 24, gap: 16 }, title: { fontSize: 26, fontWeight: "700", color: "#132849" }, heading: { fontSize: 18, fontWeight: "600" }, link: { color: "#164ea0", fontWeight: "600" }, error: { color: "#a02020" }, input: { borderWidth: 1, borderColor: "#bbc7d5", padding: 12, borderRadius: 10 }, choice: { padding: 14, borderWidth: 1, borderColor: "#d6dfea", borderRadius: 10 }, selected: { borderColor: "#164ea0", backgroundColor: "#eaf2ff" }, button: { backgroundColor: "#164ea0", padding: 14, borderRadius: 10 }, buttonText: { color: "#fff", fontWeight: "600", textAlign: "center" } });

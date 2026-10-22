import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Screen } from '@/src/components/Screen';
import { AuthButton } from '@/src/components/auth/AuthButton';
import { ProfileLocationPicker } from '@/src/components/ProfileLocationPicker';
import type { ProfileLocation } from '@/src/lib/api/geography';
import { getFriendlyApiError } from '@/src/lib/api/error-display';
import { useSession } from '@/src/store/session-context';
import { tokens } from '@/src/theme/tokens';

export function EditProfileScreen() {
  const session = useSession();
  if (!session.user) return <Screen title="Edit profile"><Text style={styles.hint}>Sign in to edit your profile.</Text></Screen>;
  return <ProfileForm key={session.user.id} />;
}

function ProfileForm() {
  const session = useSession(), router = useRouter(), navigation = useNavigation();
  const user = session.user!, profile = session.profile;
  const [original] = useState(() => ({
    firstName: profile?.firstName ?? user.firstName ?? '',
    lastName: profile?.lastName ?? user.lastName ?? '',
    phone: profile?.phone ?? '',
    location: { city: profile?.city ?? user.city ?? '', stateCode: profile?.stateCode ?? user.stateCode ?? '', countryCode: profile?.countryCode ?? '', homeLatitude: profile?.homeLatitude ?? null, homeLongitude: profile?.homeLongitude ?? null } as ProfileLocation,
  }));
  const [firstName, setFirstName] = useState(original.firstName), [lastName, setLastName] = useState(original.lastName), [phone, setPhone] = useState(original.phone);
  const [location, setLocation] = useState(original.location), [locationValid, setLocationValid] = useState(true);
  const [saving, setSaving] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState<string | null>(null);
  const lock = useRef(false), active = useRef(true);
  useEffect(() => () => { active.current = false; }, []);
  const locationChanged = JSON.stringify(location) !== JSON.stringify(original.location);
  const dirty = firstName !== original.firstName || lastName !== original.lastName || phone !== original.phone || locationChanged;
  usePreventRemove(saving || (dirty && !saved), ({ data }) => {
    if (lock.current) return;
    Alert.alert('Discard changes?', 'Your profile changes have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  useEffect(() => {
    if (saved) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/account');
    }
  }, [saved, router]);

  async function save() {
    if (lock.current || !dirty || !firstName.trim() || !lastName.trim() || !locationValid) return;
    lock.current = true; setSaving(true); setError(null);
    try {
      await session.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() || undefined, ...(locationChanged ? location : {}) });
      if (active.current) setSaved(true);
    } catch (reason) {
      if (active.current) setError(getFriendlyApiError(reason, 'We could not save your profile. Please try again.'));
    } finally {
      lock.current = false;
      if (active.current) setSaving(false);
    }
  }
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen title="Edit profile" subtitle="Keep your booking details up to date.">
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>About you</Text>
          {[
            { label: 'First name', value: firstName, change: setFirstName },
            { label: 'Last name', value: lastName, change: setLastName },
            { label: 'Phone', value: phone, change: setPhone },
          ].map(field => <View key={field.label} style={styles.field}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput accessibilityLabel={field.label} value={field.value} onChangeText={field.change} editable={!saving} style={styles.input} keyboardType={field.label === 'Phone' ? 'phone-pad' : 'default'} autoComplete={field.label === 'Phone' ? 'tel' : field.label === 'First name' ? 'given-name' : 'family-name'} />
          </View>)}
          <View style={styles.email}><Text style={styles.label}>Email</Text><Text selectable style={styles.hint}>{profile?.email ?? user.email}</Text><Text style={styles.hint}>Your sign-in email stays the same.</Text></View>
        </View>
        <View style={styles.card} pointerEvents={saving ? 'none' : 'auto'}>
          <Text style={styles.title}>Home location</Text>
          <Text style={styles.hint}>Used to find services when your current location is unavailable. You can browse other cities from Home.</Text>
          <ProfileLocationPicker value={location} onChange={(value, valid) => { setLocation(value); setLocationValid(valid); }} />
          {!locationValid ? <Text style={styles.error}>Choose your country, state or region, and city.</Text> : null}
        </View>
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        <AuthButton label="Save changes" loading={saving} disabled={saving || !dirty || !firstName.trim() || !lastName.trim() || !locationValid} onPress={() => void save()} />
      </View>
    </Screen>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 18 },
  card: { padding: 20, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: tokens.colors.border, gap: 18 },
  title: { color: tokens.colors.ink, fontFamily: tokens.font.display, fontSize: 18 },
  field: { gap: 8 }, label: { color: tokens.colors.ink, fontFamily: tokens.font.semibold, fontSize: 14 },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.borderStrong, backgroundColor: tokens.colors.surfaceSoft, paddingHorizontal: 14, color: tokens.colors.ink, fontFamily: tokens.font.regular, fontSize: 16 },
  email: { gap: 6, paddingTop: 8 }, hint: { color: tokens.colors.muted, fontFamily: tokens.font.regular, fontSize: 13, lineHeight: 20 },
  error: { color: tokens.colors.danger, fontFamily: tokens.font.regular, fontSize: 14, lineHeight: 21 },
});

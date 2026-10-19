import { useEffect, useMemo, useState } from "react";
import { FontAwesome6 } from "@expo/vector-icons";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listSupportedGeography, resolveProfileLocation, type GeographyCountry, type ProfileLocation } from "@/src/lib/api/geography";
import { tokens } from "@/src/theme/tokens";

type Level = "country" | "state" | "city";
type Option = { id: string; name: string; code?: string; latitude?: number | null; longitude?: number | null };
const titles = { country: "Country", state: "State or region", city: "City" };

export function ProfileLocationPicker({ value, onChange }: { value: ProfileLocation; onChange: (value: ProfileLocation, valid: boolean) => void }) {
  const [countries, setCountries] = useState<GeographyCountry[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [level, setLevel] = useState<Level | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    let active = true;
    setPhase("loading");
    void listSupportedGeography().then((result) => {
      if (active) { setCountries(result); setPhase("ready"); }
    }).catch(() => { if (active) setPhase("error"); });
    return () => { active = false; };
  }, [attempt]);
  const { country, state } = resolveProfileLocation(countries, value);
  const options = useMemo<Option[]>(() => {
    const all = level === "country" ? countries : level === "state" ? country?.states ?? [] : state?.cities ?? [];
    const needle = query.trim().toLocaleLowerCase();
    return all.filter((item) => `${item.name} ${"code" in item ? item.code : ""}`.toLocaleLowerCase().includes(needle));
  }, [countries, country, state, level, query]);

  function select(item: Option) {
    const next: ProfileLocation = level === "country"
      ? { countryCode: item.code!, stateCode: "", city: "", homeLatitude: null, homeLongitude: null }
      : level === "state"
        ? { ...value, stateCode: item.code!, city: "", homeLatitude: null, homeLongitude: null }
        : { ...value, city: item.name, homeLatitude: item.latitude ?? null, homeLongitude: item.longitude ?? null };
    onChange(next, resolveProfileLocation(countries, next).valid);
    setLevel(null);
    setQuery("");
  }

  return <View style={styles.fields}>
    <Text style={styles.title}>Location</Text>
    <Text style={styles.caption}>Choose from locations currently supported by BookMiz.</Text>
    {phase === "loading" ? <View style={styles.loading}><ActivityIndicator /><Text style={styles.caption}>Loading locations…</Text></View> : null}
    {phase === "error" ? <View style={styles.fields}>
      <Text accessibilityRole="alert" style={styles.caption}>Locations could not load. Your saved location is unchanged.</Text>
      <Pressable accessibilityRole="button" onPress={() => setAttempt((n) => n + 1)} style={styles.retry}><Text style={styles.value}>Retry loading locations</Text></Pressable>
    </View> : null}
    {(["country", "state", "city"] as Level[]).map((field) => {
      const disabled = phase !== "ready" || (field === "state" && !country) || (field === "city" && !state);
      const selected = field === "country" ? country?.name || value.countryCode : field === "state" ? state?.name || value.stateCode : value.city;
      return <View key={field} style={styles.fields}>
        <Text style={styles.label}>{titles[field]}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${titles[field]}: ${selected || "Choose"}`} accessibilityState={{ disabled }} disabled={disabled}
          style={[styles.select, disabled && styles.disabled]} onPress={() => { setQuery(""); setLevel(field); }}>
          <Text style={[styles.value, !selected && styles.placeholder]}>{selected || `Choose ${titles[field].toLowerCase()}`}</Text>
          <FontAwesome6 name="chevron-down" size={12} color={tokens.colors.muted} />
        </Pressable>
      </View>;
    })}
    <Modal visible={level !== null} animationType="slide" onRequestClose={() => setLevel(null)}>
      <SafeAreaView style={styles.modal}>
        <KeyboardAvoidingView style={styles.modalContent} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalHeader}>
            <Text accessibilityRole="header" style={styles.title}>{level ? `Choose ${titles[level].toLowerCase()}` : "Choose location"}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close location picker" onPress={() => setLevel(null)} style={styles.close}><FontAwesome6 name="xmark" size={20} color={tokens.colors.ink} /></Pressable>
          </View>
          <TextInput accessibilityLabel={`Search ${level ? titles[level].toLowerCase() : "locations"}`} placeholder="Search by name" value={query} onChangeText={setQuery} autoCorrect={false} style={styles.search} placeholderTextColor={tokens.colors.muted} />
          <FlatList data={options} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>No matching locations. Try another search or choose a different region.</Text>}
            renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Select ${item.name}`} onPress={() => select(item)} style={({ pressed }) => [styles.option, pressed && styles.disabled]}>
              <Text style={styles.value}>{item.name}</Text>
              {item.code ? <Text style={styles.caption}>{item.code}</Text> : null}
            </Pressable>} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  fields: { gap: 8 }, title: { color: tokens.colors.ink, fontFamily: tokens.font.semibold, fontSize: 16 },
  label: { color: tokens.colors.ink, fontFamily: tokens.font.medium, fontSize: 13 },
  caption: { color: tokens.colors.muted, fontFamily: tokens.font.regular, fontSize: 13, lineHeight: 19 },
  value: { color: tokens.colors.ink, fontFamily: tokens.font.medium, fontSize: 15, flexShrink: 1 },
  placeholder: { color: tokens.colors.muted }, disabled: { opacity: 0.5 },
  select: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderWidth: 1, borderColor: tokens.colors.borderStrong, borderRadius: 10, backgroundColor: "#ffffff" },
  loading: { flexDirection: "row", gap: 10, alignItems: "center" }, retry: { minHeight: 44, justifyContent: "center" },
  modal: { flex: 1, backgroundColor: tokens.colors.surface },
  modalContent: { flex: 1, width: "100%", maxWidth: 680, alignSelf: "center", padding: 20, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  search: { minHeight: 48, borderWidth: 1, borderColor: tokens.colors.borderStrong, borderRadius: 10, paddingHorizontal: 14, color: tokens.colors.ink, fontSize: 15, fontFamily: tokens.font.regular, backgroundColor: "#ffffff" },
  option: { minHeight: 52, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  empty: { color: tokens.colors.muted, fontSize: 14, lineHeight: 21, paddingVertical: 20, fontFamily: tokens.font.regular },
});

import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { FontAwesome6 } from "@expo/vector-icons";
import { removeProfilePhoto, uploadProfilePhoto } from "@/src/lib/api/auth";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import { ProfileAvatar } from "@/src/components/ProfileAvatar";
import { tokens } from "@/src/theme/tokens";

export function ProfilePhotoEditor({ userId, photoUrl, fullName, email, initials, onSaved }: {
  userId: string; photoUrl?: string | null; fullName: string; email: string; initials: string; onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const identity = useRef<string | null>(userId);
  identity.current = userId;
  useEffect(() => () => { identity.current = null; }, []);
  useEffect(() => { setError(null); }, [photoUrl, userId]);

  async function change(remove = false) {
    if (inFlight.current) return;
    inFlight.current = true;
    const owner = userId;
    setBusy(true); setError(null);
    let file: File | null = null;
    try {
      if (remove) {
        await removeProfilePhoto();
      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png", "image/webp"], copyToCacheDirectory: true, multiple: false });
        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        file = new File(asset.uri);
        if ((asset.size ?? file.size) > 3 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP image up to 3 MB.");
        const contentBase64 = await file.base64();
        if (identity.current !== owner) return;
        await uploadProfilePhoto(contentBase64);
      }
      if (identity.current === owner) await onSaved();
    } catch (reason) {
      if (identity.current === owner) setError(getFriendlyApiError(reason, "Could not update your photo. Please try again."));
    } finally {
      if (file?.uri.startsWith(Paths.cache.uri.endsWith("/") ? Paths.cache.uri : `${Paths.cache.uri}/`) && file.exists) {
        try { file.delete(); } catch { /* Cache cleanup can be retried by the OS. */ }
      }
      inFlight.current = false;
      if (identity.current === owner) setBusy(false);
    }
  }

  return <View style={styles.section}>
    <View style={styles.identity}>
      <ProfileAvatar photoUrl={photoUrl} initials={initials} size={72} />
      <View style={styles.copy}>
        <Text style={styles.name}>{fullName}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Photo options" accessibilityState={{ expanded: showPhotoOptions, disabled: busy }} disabled={busy} style={styles.photoToggle} onPress={() => setShowPhotoOptions((open) => !open)}>
        <FontAwesome6 name={showPhotoOptions ? "xmark" : "camera"} size={17} color={tokens.colors.ink} />
      </Pressable>
    </View>
    {showPhotoOptions ? <View style={styles.photoOptions}>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={photoUrl ? "Change profile photo" : "Add profile photo"} accessibilityState={{ disabled: busy }} disabled={busy} style={styles.button} onPress={() => void change()}>
            {busy ? <ActivityIndicator size="small" color={tokens.colors.ink} /> : <FontAwesome6 name="camera" size={13} color={tokens.colors.ink} />}
            <Text style={styles.buttonLabel}>{photoUrl ? "Change photo" : "Add photo"}</Text>
          </Pressable>
          {photoUrl ? <Pressable accessibilityRole="button" accessibilityLabel="Remove profile photo" accessibilityState={{ disabled: busy }} disabled={busy} style={styles.remove} onPress={() => void change(true)}><Text style={styles.removeLabel}>Remove</Text></Pressable> : null}
        </View>
    <Text style={styles.help}>JPG, PNG or WebP · Up to 3 MB · Photos are cropped to a square.</Text>
    </View> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 10, padding: 18, borderRadius: 20, backgroundColor: tokens.colors.surfaceSoft }, identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  photoToggle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  photoOptions: { gap: 8, paddingTop: 4 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: tokens.colors.inkDeep, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: 72, height: 72 }, initials: { color: "#ffffff", fontFamily: tokens.font.bold, fontSize: 22 },
  copy: { flex: 1, minWidth: 0, gap: 4 }, name: { color: tokens.colors.ink, fontFamily: tokens.font.semibold, fontSize: 20 },
  email: { color: tokens.colors.muted, fontFamily: tokens.font.regular, fontSize: 13 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 4 },
  button: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, minHeight: 44, borderRadius: 10, backgroundColor: "#ffffff", borderWidth: 1, borderColor: tokens.colors.borderStrong },
  buttonLabel: { color: tokens.colors.ink, fontFamily: tokens.font.semibold, fontSize: 13 },
  remove: { minHeight: 44, paddingHorizontal: 10, justifyContent: "center" }, removeLabel: { color: tokens.colors.danger, fontFamily: tokens.font.medium, fontSize: 13 },
  help: { color: tokens.colors.muted, fontFamily: tokens.font.regular, fontSize: 12, lineHeight: 18 },
  error: { color: tokens.colors.danger, fontFamily: tokens.font.regular, fontSize: 13, lineHeight: 19 },
});

import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { mobileEnv } from "@/src/lib/mobile-env";
import { tokens } from "@/src/theme/tokens";

export function ProfileAvatar({ photoUrl, initials, size = 44 }: { photoUrl?: string | null; initials: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photoUrl]);
  const url = photoUrl?.startsWith("/api/auth/profile-photos/") ? new URL(photoUrl, mobileEnv.identityApiUrl).toString() : photoUrl?.startsWith("https://") ? photoUrl : null;
  return <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: tokens.colors.inkDeep, alignItems: "center", justifyContent: "center" }}>
    {url && !failed ? <Image accessibilityLabel="Your profile photo" source={{ uri: url }} style={{ width: size, height: size }} onError={() => setFailed(true)} /> : <Text style={{ color: "#ffffff", fontSize: Math.round(size * .32), fontFamily: tokens.font.bold }}>{initials}</Text>}
  </View>;
}

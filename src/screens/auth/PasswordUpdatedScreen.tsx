import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { AuthShell } from "@/src/components/auth/AuthShell";
import { tokens } from "@/src/theme/tokens";

export function PasswordUpdatedScreen() {
  const router = useRouter();

  return (
    <AuthShell
      eyebrow="Success"
      title="Password updated"
      subtitle="Your account is ready. Jump back into BookMiz with your refreshed password and live customer session."
      heroImage={require("../../../assets/bookmiz/hospital.png")}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>✓</Text>
      </View>
      <AuthButton label="Continue" onPress={() => router.replace("/(tabs)")} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "center",
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#35b46b",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
  badgeText: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "800",
  },
});

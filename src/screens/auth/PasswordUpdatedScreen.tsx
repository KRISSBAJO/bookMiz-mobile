import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { AuthShell } from "@/src/components/auth/AuthShell";
import { tokens } from "@/src/theme/tokens";

export function PasswordUpdatedScreen() {
  const router = useRouter();

  return (
    <AuthShell
      title="Password updated"
      heroImage={require("../../../assets/bookmiz/hospital.png")}
      showBack={false}
    >
      <View style={styles.badge}>
        <FontAwesome6 name="check" size={30} color={tokens.colors.inkDeep} />
      </View>
      <Text style={styles.body}>You're logged in. Your new password works from now on.</Text>
      <AuthButton label="Continue" icon="arrow-right" onPress={() => router.replace("/(tabs)")} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "center",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  body: {
    color: tokens.colors.muted,
    fontSize: 16,
    fontFamily: tokens.font.regular,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 8,
  },
});

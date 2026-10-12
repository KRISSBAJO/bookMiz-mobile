import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { AuthField } from "@/src/components/auth/AuthField";
import { AuthShell } from "@/src/components/auth/AuthShell";
import { tokens } from "@/src/theme/tokens";

export function VerifyCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [token, setToken] = useState("");

  return (
    <AuthShell
      eyebrow="Verify reset"
      title="Paste the reset token"
      subtitle={`We sent a password reset token to ${params.email ?? "your email address"}. Paste it here to continue.`}
      heroImage={require("../../../assets/bookmiz/barber.png")}
    >
      <AuthField
        label="Reset token"
        placeholder="Paste the token from your email"
        value={token}
        onChangeText={setToken}
      />

      <View style={styles.rowCenter}>
        <Text style={styles.helper}>Didn’t receive a reset email?</Text>
        <Pressable
          onPress={() =>
            router.replace({
              pathname: "/forgot-password",
              params: { email: params.email ?? "" },
            })
          }
        >
          <Text style={styles.link}> Check spam or resend</Text>
        </Pressable>
      </View>

      <AuthButton
        label="Continue"
        disabled={!token.trim()}
        onPress={() =>
          router.push({
            pathname: "/reset-password",
            params: { email: params.email ?? "", token: token.trim() },
          })
        }
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  rowCenter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  helper: {
    color: tokens.colors.muted,
    fontSize: 13,
  },
  link: {
    color: tokens.colors.brandDeep,
    fontSize: 13,
    fontWeight: "800",
  },
});

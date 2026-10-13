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
      title="Enter your code"
      subtitle={`We sent a code to ${params.email ?? "your email"}.`}
      heroImage={require("../../../assets/bookmiz/barber.png")}
      footer={
        <View style={styles.rowCenter}>
          <Text style={styles.helper}>Didn’t get it? </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() =>
              router.replace({
                pathname: "/forgot-password",
                params: { email: params.email ?? "" },
              })
            }
          >
            <Text style={styles.link}>Resend the code</Text>
          </Pressable>
        </View>
      }
    >
      <AuthField
        label="Code"
        placeholder="Paste the code from your email"
        value={token}
        onChangeText={setToken}
        autoComplete="one-time-code"
      />

      <AuthButton
        label="Continue"
        icon="arrow-right"
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
    fontSize: 15,
    fontFamily: tokens.font.regular,
  },
  link: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.bold,
  },
});

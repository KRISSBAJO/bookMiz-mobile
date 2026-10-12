import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { AuthField } from "@/src/components/auth/AuthField";
import { AuthShell } from "@/src/components/auth/AuthShell";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

export function LoginScreen() {
  const router = useRouter();
  const session = useSession();
  const [email, setEmail] = useState("maya@bookmiz.com");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (session.isHydrating) {
    return null;
  }

  if (session.isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in and pick up where you left off"
      subtitle="Your bookings, saved providers, and request updates are all waiting here."
      heroImage={require("../../../assets/bookmiz/barber.png")}
      brandTagline="Book beautifully"
    >
      <AuthField
        label="Email"
        placeholder="email@domain.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <AuthField
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable onPress={() => router.push("/forgot-password")}>
        <Text style={styles.inlineLink}>Forgot password?</Text>
      </Pressable>

      <AuthButton
        label={isSubmitting ? "Signing in..." : "Login"}
        disabled={isSubmitting}
        onPress={async () => {
          try {
            setIsSubmitting(true);
            await session.signIn({
              email,
              password,
              rememberMe: true,
            });
            router.replace("/(tabs)");
          } catch {
            // Session context owns the visible authentication error.
          } finally {
            setIsSubmitting(false);
          }
        }}
      />

      <View style={styles.rowCenter}>
        <Text style={styles.helper}>Don’t have an account?</Text>
        <Pressable onPress={() => router.push("/signup")}>
          <Text style={styles.link}> Register</Text>
        </Pressable>
      </View>

      {session.authError ? <Text style={styles.errorText}>{session.authError}</Text> : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  inlineLink: {
    alignSelf: "flex-end",
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
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
  errorText: {
    color: "#d44c3f",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});

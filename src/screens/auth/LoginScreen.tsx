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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [showMfa, setShowMfa] = useState(false);

  if (session.isHydrating) {
    return null;
  }

  if (session.isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <AuthShell
      title="Welcome back"
      heroImage={require("../../../assets/bookmiz/barber.png")}
      footer={
        <View style={styles.rowCenter}>
          <Text style={styles.helper}>New here? </Text>
          <Pressable
            onPress={() => router.push("/signup")}
            accessibilityRole="link"
          >
            <Text style={styles.link}>Create an account</Text>
          </Pressable>
        </View>
      }
    >
      <AuthField
        label="Email address"
        placeholder="you@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
      />
      <AuthField
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        labelAccessory={
          <Pressable
            onPress={() => router.push("/forgot-password")}
            accessibilityRole="link"
          >
            <Text style={styles.inlineLink}>Forgot?</Text>
          </Pressable>
        }
      />

      <AuthButton
        label="Use authenticator or recovery code"
        variant="secondary"
        onPress={() => setShowMfa((current) => !current)}
      />
      {showMfa ||
      /multi.factor|mfa|authenticator|recovery code/i.test(
        session.authError || "",
      ) ? (
        <>
          <AuthField
            label="Authenticator code"
            placeholder="6-digit code"
            value={mfaCode}
            onChangeText={setMfaCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
          />
          <AuthField
            label="Recovery code instead"
            placeholder="Optional recovery code"
            value={recoveryCode}
            onChangeText={setRecoveryCode}
          />
        </>
      ) : null}
      {session.authError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} accessibilityRole="alert">
            {session.authError}
          </Text>
        </View>
      ) : null}

      <AuthButton
        label="Log in"
        icon="arrow-right"
        loading={isSubmitting}
        disabled={!email.trim() || !password}
        onPress={async () => {
          try {
            setIsSubmitting(true);
            await session.signIn({
              email: email.trim(),
              password,
              rememberMe: true,
              mfaCode: mfaCode.trim() || undefined,
              recoveryCode: mfaCode.trim()
                ? undefined
                : recoveryCode.trim() || undefined,
            });
            router.replace("/(tabs)");
          } catch {
            // Session context owns the visible authentication error.
          } finally {
            setIsSubmitting(false);
          }
        }}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  inlineLink: {
    color: tokens.colors.inkDeep,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
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
  errorBox: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: "#f3c4c4",
    backgroundColor: tokens.colors.dangerSoft,
    padding: 12,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 14,
    fontFamily: tokens.font.regular,
    lineHeight: 20,
  },
});

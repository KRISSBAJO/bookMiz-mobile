import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { AuthField } from "@/src/components/auth/AuthField";
import { AuthShell } from "@/src/components/auth/AuthShell";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

export function SignupScreen() {
  const router = useRouter();
  const session = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = useMemo(
    () =>
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      email.includes("@") &&
      password.trim().length >= 8,
    [email, firstName, lastName, password],
  );

  if (session.isHydrating) {
    return null;
  }

  if (session.isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <AuthShell
      title="Create your account"
      heroImage={require("../../../assets/bookmiz/manicure.png")}
      footer={
        <View style={styles.rowCenter}>
          <Text style={styles.helper}>Already have an account? </Text>
          <Pressable onPress={() => router.push("/login")} accessibilityRole="link">
            <Text style={styles.link}>Log in</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.nameRow}>
        <View style={styles.nameColumn}>
          <AuthField
            label="First name"
            placeholder="First name"
            value={firstName}
            onChangeText={setFirstName}
          />
        </View>
        <View style={styles.nameColumn}>
          <AuthField
            label="Last name"
            placeholder="Last name"
            value={lastName}
            onChangeText={setLastName}
          />
        </View>
      </View>

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
        placeholder="At least 8 characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />

      {session.authError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} accessibilityRole="alert">
            {session.authError}
          </Text>
        </View>
      ) : null}

      <AuthButton
        label="Create account"
        icon="arrow-right"
        loading={isSubmitting}
        disabled={!isValid || isSubmitting}
        onPress={async () => {
          if (!isValid) {
            return;
          }

          try {
            setIsSubmitting(true);
            await session.signUp({
              firstName,
              lastName,
              email,
              password,
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
  nameRow: {
    flexDirection: "row",
    gap: 12,
  },
  nameColumn: {
    flex: 1,
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

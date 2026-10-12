import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { AuthField } from "@/src/components/auth/AuthField";
import { AuthShell } from "@/src/components/auth/AuthShell";
import { resetPassword } from "@/src/lib/api/auth";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

export function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; token?: string }>();
  const session = useSession();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = useMemo(
    () => [
      { label: "8+ characters", ok: password.length >= 8 },
      { label: "Uppercase", ok: /[A-Z]/.test(password) },
      { label: "Number", ok: /\d/.test(password) },
      { label: "Match", ok: password.length > 0 && password === confirmPassword },
    ],
    [confirmPassword, password],
  );

  return (
    <AuthShell
      eyebrow="Reset password"
      title="Choose a new password"
      subtitle="Keep it different from your previously used passwords and make it strong enough for future sign-ins."
      heroImage={require("../../../assets/bookmiz/manicure.png")}
    >
      <AuthField
        label="New password"
        placeholder="Enter a new password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <AuthField
        label="Confirm password"
        placeholder="Confirm your password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        errorText={
          confirmPassword.length > 0 && password !== confirmPassword
            ? "Passwords do not match."
            : undefined
        }
      />
      <View style={styles.ruleWrap}>
        {checks.map((check) => (
          <View
            key={check.label}
            style={[styles.ruleChip, check.ok ? styles.ruleChipOk : null]}
          >
            <Text
              style={[styles.ruleText, check.ok ? styles.ruleTextOk : null]}
            >
              {check.label}
            </Text>
          </View>
        ))}
      </View>
      <AuthButton
        label={isSubmitting ? "Updating password..." : "Update password"}
        disabled={
          isSubmitting ||
          !params.token || !params.email ||
          checks.some((check) => !check.ok)
        }
        onPress={async () => {
          if (!params.token) {
            setError("A reset token is required before you can update your password.");
            return;
          }

          try {
            setError(null);
            setIsSubmitting(true);
            const auth = await resetPassword({
              email: params.email ?? "",
              token: params.token,
              newPassword: password,
            });
            await session.applyAuthResponse(auth);
            router.replace("/password-updated");
          } catch (nextError) {
            const message =
              nextError instanceof Error
                ? nextError.message
                : "We could not reset your password.";
            setError(message);
          } finally {
            setIsSubmitting(false);
          }
        }}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  ruleWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  ruleChip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  ruleChipOk: {
    borderColor: "#7ccf90",
    backgroundColor: "#effaf2",
  },
  ruleText: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  ruleTextOk: {
    color: tokens.colors.success,
  },
  errorText: {
    color: "#d44c3f",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});

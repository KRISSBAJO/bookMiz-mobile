import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { AuthField } from "@/src/components/auth/AuthField";
import { AuthShell } from "@/src/components/auth/AuthShell";
import { forgotPassword } from "@/src/lib/api/auth";
import { tokens } from "@/src/theme/tokens";

export function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "maya@bookmiz.com");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthShell
      eyebrow="Reset password"
      title="Send a reset link"
      subtitle="Enter the email address on your BookMiz account and we’ll send a reset token so you can continue."
      heroImage={require("../../../assets/bookmiz/hospital.png")}
    >
      <AuthField
        label="Email"
        placeholder="email@domain.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <AuthButton
        label={isSubmitting ? "Sending..." : "Send reset email"}
        disabled={isSubmitting}
        onPress={async () => {
          try {
            setError(null);
            setIsSubmitting(true);
            await forgotPassword({ email });
            router.push({
              pathname: "/verify-code",
              params: { email },
            });
          } catch (nextError) {
            const message =
              nextError instanceof Error
                ? nextError.message
                : "We could not send a reset email right now.";
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
  errorText: {
    color: "#d44c3f",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});

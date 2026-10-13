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
  const [email, setEmail] = useState(params.email ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a code."
      heroImage={require("../../../assets/bookmiz/hospital.png")}
    >
      <AuthField
        label="Email address"
        placeholder="you@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <AuthButton
        label="Send the code"
        icon="arrow-right"
        loading={isSubmitting}
        disabled={isSubmitting || !email.trim()}
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
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: tokens.colors.danger,
    fontSize: 14,
    fontFamily: tokens.font.regular,
    lineHeight: 20,
  },
});

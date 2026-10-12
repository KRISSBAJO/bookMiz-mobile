import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";

import { tokens } from "@/src/theme/tokens";

type AuthButtonProps = {
  label: string;
  onPress?: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
  disabled?: boolean;
};

export function AuthButton({
  label,
  onPress,
  variant = "primary",
  style,
  disabled = false,
}: AuthButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        variant === "primary" ? styles.primary : null,
        variant === "secondary" ? styles.secondary : null,
        variant === "ghost" ? styles.ghost : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === "primary" ? styles.labelPrimary : null,
          variant !== "primary" ? styles.labelSecondary : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  disabled: {
    opacity: 0.55,
  },
  primary: {
    backgroundColor: tokens.colors.brand,
  },
  secondary: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  ghost: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  labelPrimary: {
    color: tokens.colors.ink,
  },
  labelSecondary: {
    color: tokens.colors.ink,
  },
});

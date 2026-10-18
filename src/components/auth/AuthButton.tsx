import { FontAwesome6 } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";

import { tokens } from "@/src/theme/tokens";

type AuthButtonProps = {
  label: string;
  onPress?: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "ghost" | "navy";
  style?: ViewStyle;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ComponentProps<typeof FontAwesome6>["name"];
};

export function AuthButton({
  label,
  onPress,
  variant = "primary",
  style,
  disabled = false,
  loading = false,
  icon,
}: AuthButtonProps) {
  const labelColor =
    variant === "primary"
      ? tokens.colors.inkDeep
      : variant === "secondary"
        ? tokens.colors.ink
        : "#ffffff";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <>
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
          {icon ? <FontAwesome6 name={icon} size={15} color={labelColor} /> : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: tokens.radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  primary: {
    backgroundColor: tokens.colors.brand,
  },
  navy: {
    backgroundColor: tokens.colors.inkDeep,
  },
  secondary: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  label: {
    flexShrink: 1,
    textAlign: "center",
    fontSize: 16,
    fontFamily: tokens.font.bold,
  },
});

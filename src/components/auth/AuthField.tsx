import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState, type ReactNode } from "react";

import { tokens } from "@/src/theme/tokens";

type AuthFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "email-address" | "number-pad";
  secureTextEntry?: boolean;
  helperText?: string;
  errorText?: string;
  /** Rendered to the right of the label, e.g. a "Forgot?" link. */
  labelAccessory?: ReactNode;
  autoComplete?: "email" | "password" | "new-password" | "one-time-code" | "name" | "off";
};

export function AuthField({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  secureTextEntry = false,
  helperText,
  errorText,
  labelAccessory,
  autoComplete,
}: AuthFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.root}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelAccessory}
      </View>
      <View
        style={[
          styles.fieldShell,
          isFocused ? styles.fieldShellFocused : null,
          errorText ? styles.fieldShellError : null,
        ]}
      >
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.muted}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === "email-address" || secureTextEntry ? "none" : "words"}
          autoComplete={autoComplete}
          secureTextEntry={secureTextEntry && !isVisible}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={styles.input}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setIsVisible((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={isVisible ? "Hide password" : "Show password"}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>{isVisible ? "Hide" : "Show"}</Text>
          </Pressable>
        ) : null}
      </View>
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
      {!errorText && helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  label: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  fieldShell: {
    height: 52,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: "#cfd8e6",
    backgroundColor: tokens.colors.surfaceSoft,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 4,
  },
  fieldShellFocused: {
    borderColor: tokens.colors.inkDeep,
    backgroundColor: "#ffffff",
  },
  fieldShellError: {
    borderColor: "#e3a2a2",
    backgroundColor: tokens.colors.dangerSoft,
  },
  input: {
    flex: 1,
    height: 50,
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.regular,
  },
  toggle: {
    height: 44,
    minWidth: 60,
    paddingHorizontal: 12,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: {
    color: tokens.colors.inkDeep,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  helperText: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
    lineHeight: 18,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 13,
    fontFamily: tokens.font.regular,
    lineHeight: 18,
  },
});

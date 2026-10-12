import { FontAwesome6 } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";

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
}: AuthFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.fieldShell, errorText ? styles.fieldShellError : null]}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.mutedSoft}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
          secureTextEntry={secureTextEntry && !isVisible}
          style={styles.input}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setIsVisible((current) => !current)}>
            <FontAwesome6
              name={isVisible ? "eye" : "eye-slash"}
              size={15}
              color={errorText ? tokens.colors.danger : tokens.colors.muted}
            />
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
  label: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  fieldShell: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  fieldShellError: {
    borderColor: "#e9908b",
  },
  input: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 15,
  },
  helperText: {
    color: tokens.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
});

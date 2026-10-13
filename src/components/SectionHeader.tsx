import { Pressable, StyleSheet, Text, View } from "react-native";

import { tokens } from "@/src/theme/tokens";

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 17,
    fontFamily: tokens.font.display,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
  action: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.bold,
  },
});

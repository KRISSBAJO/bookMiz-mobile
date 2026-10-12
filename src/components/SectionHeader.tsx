import { StyleSheet, Text, View } from "react-native";

import { tokens } from "@/src/theme/tokens";

export function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 4,
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  subtitle: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
});

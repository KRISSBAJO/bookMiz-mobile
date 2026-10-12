import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { tokens } from "@/src/theme/tokens";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View style={styles.container}>
        <Text style={styles.title}>That mobile route is not wired yet.</Text>
        <Text style={styles.subtitle}>
          The customer-agent app is still in active buildout, but the core shell is ready.
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back to BookMiz home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: tokens.colors.surface,
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 10,
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  link: {
    marginTop: 18,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.ink,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  linkText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});

import { Redirect, useRouter } from "expo-router";
import { FontAwesome6 } from "@expo/vector-icons";
import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { BrandMark } from "@/src/components/auth/AuthShell";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";
import { getFriendlyApiError } from "@/src/lib/api/error-display";

export function WelcomeScreen() {
  const router = useRouter();
  const session = useSession();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  if (session.isHydrating) {
    return null;
  }

  if (session.isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <BrandMark size={36} />
      </View>

      <View style={styles.heroFrame}>
        <Image source={require("../../../assets/bookmiz/barber.png")} style={styles.heroImage} />
        <View style={styles.heroShade} />
        <View style={styles.providerCard}>
          <View style={styles.providerAvatar}>
            <FontAwesome6 name="scissors" size={16} color={tokens.colors.inkDeep} />
          </View>
          <View style={styles.providerBody}>
            <Text style={styles.providerName}>Barbers, nails, clinics</Text>
            <Text style={styles.providerMeta}>Rated by real customers near you</Text>
          </View>
          <View style={styles.providerPill}>
            <Text style={styles.providerPillText}>Book</Text>
          </View>
        </View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>Book trusted local pros in a couple of taps.</Text>
        <Text style={styles.subtitle}>
          Compare, book and manage every appointment in one place.
        </Text>
      </View>

      <View style={styles.actions}>
        {session.authError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText} accessibilityRole="alert">
              {retryError || session.authError}
            </Text>
            <AuthButton
              label={retrying ? "Reconnecting…" : "Retry connection"}
              variant="ghost"
              loading={retrying}
              onPress={async () => {
                setRetrying(true);
                setRetryError(null);
                try {
                  await session.refreshProfile();
                } catch (error) {
                  setRetryError(getFriendlyApiError(error, "Could not reconnect. Please try again."));
                } finally {
                  setRetrying(false);
                }
              }}
            />
          </View>
        ) : null}
        <AuthButton label="Get started" icon="arrow-right" onPress={() => router.push("/signup")} />
        <AuthButton
          label="I already have an account"
          variant="ghost"
          onPress={() => router.push("/login")}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.inkDeep,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  header: {
    paddingTop: 12,
  },
  heroFrame: {
    marginTop: 28,
    height: 320,
    borderRadius: tokens.radius.xl,
    overflow: "hidden",
    backgroundColor: tokens.colors.navySoft,
    justifyContent: "flex-end",
    padding: 16,
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  heroShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
    backgroundColor: "rgba(16,39,72,0.62)",
  },
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  providerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  providerBody: {
    flex: 1,
    gap: 2,
  },
  providerName: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.bold,
  },
  providerMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  providerPill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  providerPillText: {
    color: tokens.colors.inkDeep,
    fontSize: 12,
    fontFamily: tokens.font.bold,
  },
  copy: {
    marginTop: 28,
    gap: 10,
  },
  title: {
    color: "#ffffff",
    fontSize: 30,
    lineHeight: 34,
    fontFamily: tokens.font.display,
    letterSpacing: -1,
  },
  subtitle: {
    color: tokens.colors.onNavyMuted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: tokens.font.regular,
  },
  actions: {
    marginTop: "auto",
    gap: 10,
    paddingTop: 24,
  },
  errorBox: {
    gap: 10,
    marginBottom: 6,
  },
  errorText: {
    color: "#ffd2d2",
    fontSize: 14,
    fontFamily: tokens.font.regular,
    lineHeight: 20,
  },
});

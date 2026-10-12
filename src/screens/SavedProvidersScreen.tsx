import { useFocusEffect } from "expo-router/react-navigation";
import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/src/components/Screen";
import { SectionHeader } from "@/src/components/SectionHeader";
import { ProviderCard } from "@/src/components/marketplace/ProviderCard";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import {
  listCustomerBookmarkedProviders,
  removeMarketplaceProviderBookmark,
} from "@/src/lib/api/marketplace";
import type { MarketplaceProviderCard } from "@/src/lib/api/types";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

export function SavedProvidersScreen() {
  const router = useRouter();
  const session = useSession();
  const [providers, setProviders] = useState<MarketplaceProviderCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSavedProviders = useCallback(async () => {
    if (!session.isSignedIn) {
      setProviders([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      const nextProviders = await listCustomerBookmarkedProviders();
      setProviders(nextProviders);
    } catch (nextError) {
      setError(
        getFriendlyApiError(nextError, "We could not load your saved providers."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [session.isSignedIn]);

  useFocusEffect(
    useCallback(() => {
      void loadSavedProviders();
    }, [loadSavedProviders]),
  );

  const savedLocalCount = useMemo(
    () => providers.filter((provider) => provider.serviceModel === "LOCAL").length,
    [providers],
  );
  const savedProfessionalCount = useMemo(
    () => providers.filter((provider) => provider.serviceModel === "PROFESSIONAL").length,
    [providers],
  );

  const handleRemoveBookmark = useCallback(async (providerId: string) => {
    const previousProviders = providers;
    setProviders((current) => current.filter((provider) => provider.id !== providerId));

    try {
      await removeMarketplaceProviderBookmark(providerId);
    } catch (nextError) {
      setProviders(previousProviders);
      setError(
        getFriendlyApiError(nextError, "We could not update that saved provider."),
      );
    }
  }, [providers]);

  return (
    <Screen
      eyebrow="Saved providers"
      title="Your shortlist, kept ready"
      subtitle="A dedicated saved list so Home stays curated while every bookmarked provider has a proper place."
      heroTopContent={
        <View style={styles.heroTopRow}>
          <Pressable style={styles.heroButton} onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left-long" size={16} color="#fff" />
            <Text style={styles.heroButtonText}>Back</Text>
          </Pressable>
          <View style={styles.heroCountChip}>
            <Text style={styles.heroCountValue}>{providers.length}</Text>
            <Text style={styles.heroCountLabel}>saved</Text>
          </View>
        </View>
      }
      heroContent={
        <View style={styles.heroMetrics}>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricValue}>{savedLocalCount}</Text>
            <Text style={styles.heroMetricLabel}>local</Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricValue}>{savedProfessionalCount}</Text>
            <Text style={styles.heroMetricLabel}>professional</Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricValue}>
              {providers.filter((provider) => (provider.reviewCount ?? 0) > 0).length}
            </Text>
            <Text style={styles.heroMetricLabel}>reviewed</Text>
          </View>
        </View>
      }
      heroMinHeight={260}
      heroBottomPadding={34}
      contentTopOffset={24}
    >
      <View style={styles.panel}>
        <SectionHeader
          title="Saved for later"
          subtitle="Revisit your strongest picks, compare them again, or remove the ones that no longer fit."
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {providers.length === 0 && !isLoading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No saved providers yet</Text>
            <Text style={styles.emptyBody}>
              Save providers from Explore and they will collect here as your shortlist.
            </Text>
            <Pressable
              style={styles.emptyAction}
              onPress={() => router.push("/(tabs)/explore")}
            >
              <Text style={styles.emptyActionText}>Open marketplace</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.listWrap}>
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isBookmarked
              onPress={() => router.push(`/providers/${provider.slug}` as never)}
              onToggleBookmark={() => void handleRemoveBookmark(provider.id)}
            />
          ))}
        </View>

        {isLoading ? <Text style={styles.loadingText}>Refreshing your shortlist…</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  heroButton: {
    minWidth: 76,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(12,29,54,0.52)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  heroButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  heroCountChip: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroCountValue: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  heroCountLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  heroMetrics: {
    flexDirection: "row",
    gap: 12,
  },
  heroMetricCard: {
    flex: 1,
    borderRadius: tokens.radius.lg,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  heroMetricValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  heroMetricLabel: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  panel: {
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
    gap: 16,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyCard: {
    borderRadius: tokens.radius.lg,
    backgroundColor: "#fbfcff",
    borderWidth: 1,
    borderColor: "#dce3ef",
    padding: 18,
    gap: 12,
  },
  emptyTitle: {
    color: tokens.colors.ink,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  emptyBody: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  emptyAction: {
    alignSelf: "flex-start",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  listWrap: {
    gap: 16,
  },
  loadingText: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
});

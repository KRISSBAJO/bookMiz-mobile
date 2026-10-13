import { useFocusEffect } from "expo-router/react-navigation";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { Screen } from "@/src/components/Screen";
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

  const subtitle =
    providers.length === 0
      ? undefined
      : [
          savedLocalCount > 0 ? `${savedLocalCount} local` : null,
          savedProfessionalCount > 0 ? `${savedProfessionalCount} professional` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  const showSkeleton = isLoading && providers.length === 0;

  return (
    <Screen
      title="Saved"
      subtitle={subtitle}
      refreshing={isLoading && providers.length > 0}
      onRefresh={() => void loadSavedProviders()}
    >
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
          <Pressable onPress={() => void loadSavedProviders()} accessibilityRole="button">
            <Text style={styles.errorRetry}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {showSkeleton ? <SkeletonRows count={3} /> : null}

      {providers.length === 0 && !isLoading ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No saved providers yet</Text>
          <Text style={styles.emptyBody}>
            Tap the heart on a provider to keep it here.
          </Text>
          <AuthButton
            label="Explore providers"
            variant="navy"
            style={styles.emptyButton}
            onPress={() => router.push("/(tabs)/explore")}
          />
        </View>
      ) : null}

      <View style={styles.list}>
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
    </Screen>
  );
}

function SkeletonRows({ count }: { count: number }) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.list} accessibilityLabel="Loading saved providers">
      {Array.from({ length: count }).map((_, index) => (
        <Animated.View key={index} style={[styles.skeletonCard, { opacity }]}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonBody}>
            <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: "#f3c4c4",
    backgroundColor: tokens.colors.dangerSoft,
    padding: 14,
    gap: 6,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
  errorRetry: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.display,
  },
  emptyBody: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontFamily: tokens.font.regular,
  },
  emptyButton: {
    alignSelf: "stretch",
    marginTop: 10,
    minHeight: 48,
  },
  list: {
    gap: 12,
  },
  skeletonCard: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  skeletonImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: tokens.colors.border,
  },
  skeletonBody: {
    flex: 1,
    justifyContent: "center",
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    width: "70%",
    borderRadius: 6,
    backgroundColor: tokens.colors.border,
  },
  skeletonLineWide: {
    width: "90%",
  },
  skeletonLineShort: {
    width: "45%",
  },
});

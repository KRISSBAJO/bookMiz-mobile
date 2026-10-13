import { FontAwesome6 } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import type { MarketplaceProviderCard } from "@/src/lib/api/types";
import {
  formatMarketplaceDistance,
  formatMarketplacePrice,
  formatPriceTier,
  getMarketplaceLocationLabel,
  getProviderHeroImage,
} from "@/src/lib/marketplace-display";
import { tokens } from "@/src/theme/tokens";

export function priceLineFor(provider: MarketplaceProviderCard) {
  // Services priced at 0 are placeholders; never show "$0".
  const topService = provider.topServices.find((service) => service.priceCents > 0);
  if (topService) {
    return `${topService.name} · ${formatMarketplacePrice(topService.priceCents, null, provider.currencyCode)}`;
  }
  if (provider.lowestPriceCents) {
    return `From ${formatMarketplacePrice(provider.lowestPriceCents, null, provider.currencyCode)}`;
  }
  return "Tap to see services";
}

export function ProviderCard({
  provider,
  isBookmarked = false,
  onPress,
  onToggleBookmark,
}: {
  provider: MarketplaceProviderCard;
  isBookmarked?: boolean;
  onPress: () => void;
  onToggleBookmark?: () => void;
}) {
  const meta = [
    provider.businessCategory,
    getMarketplaceLocationLabel(provider.primaryLocation),
    formatMarketplaceDistance(provider.distanceMiles),
  ]
    .filter(Boolean)
    .join(" · ");
  const tier = formatPriceTier(provider.priceRangeLabel);

  // The card body and the heart are sibling pressables: nesting buttons is invalid on web
  // and makes the heart unreachable for screen readers on native.
  return (
    <View style={styles.card}>
      <Pressable
        style={styles.main}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={provider.displayName}
      >
      <View style={styles.imageWrap}>
        <Image source={getProviderHeroImage(provider)} style={styles.image} />
        {provider.badges.onlineBooking ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Online</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {provider.displayName}
          </Text>
          <Text style={styles.rating}>
            {provider.averageRating ? `★ ${provider.averageRating.toFixed(1)}` : "New"}
            {provider.reviewCount > 0 ? (
              <Text style={styles.ratingCount}> ({provider.reviewCount})</Text>
            ) : null}
          </Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
        <Text style={styles.price} numberOfLines={1}>
          {priceLineFor(provider)}
        </Text>
        {tier ? (
          <Text style={styles.tier} numberOfLines={1}>
            {tier}
          </Text>
        ) : null}
      </View>
      </Pressable>

      {onToggleBookmark ? (
        <Pressable
          style={styles.heartButton}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={isBookmarked ? "Remove from saved" : "Save provider"}
          accessibilityState={{ selected: isBookmarked }}
          onPress={onToggleBookmark}
        >
          <FontAwesome6
            name="heart"
            size={16}
            solid={isBookmarked}
            color={isBookmarked ? tokens.colors.danger : tokens.colors.ink}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  main: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  imageWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: tokens.colors.border,
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  badge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    color: tokens.colors.inkDeep,
    fontSize: 10,
    fontFamily: tokens.font.semibold,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  title: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.display,
  },
  rating: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontFamily: tokens.font.semibold,
  },
  ratingCount: {
    color: tokens.colors.muted,
    fontFamily: tokens.font.medium,
  },
  meta: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  price: {
    color: tokens.colors.success,
    fontSize: 13,
    fontFamily: tokens.font.semibold,
  },
  tier: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontFamily: tokens.font.regular,
  },
  heartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
});

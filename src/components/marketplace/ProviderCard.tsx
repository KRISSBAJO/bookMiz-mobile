import { FontAwesome6 } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import type { MarketplaceProviderCard } from "@/src/lib/api/types";
import {
  formatMarketplaceDistance,
  formatMarketplacePrice,
  getMarketplaceLocationLabel,
  getProviderHeroImage,
  getProviderSummary,
} from "@/src/lib/marketplace-display";
import { tokens } from "@/src/theme/tokens";

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
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageWrap}>
        <Image source={getProviderHeroImage(provider)} style={styles.image} />
        <View style={styles.imageOverlay} />
        <View style={styles.imageTopRow}>
          <View style={styles.modelBadge}>
            <Text style={styles.modelBadgeText}>{provider.serviceModel}</Text>
          </View>
          {onToggleBookmark ? (
            <Pressable
              style={styles.bookmarkButton}
              onPress={(event) => {
                event.stopPropagation();
                onToggleBookmark();
              }}
            >
              <FontAwesome6
                name={isBookmarked ? "heart-circle-check" : "bookmark"}
                size={16}
                color={isBookmarked ? tokens.colors.brandDeep : tokens.colors.ink}
              />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.imageBottom}>
          <Text style={styles.imageEyebrow}>
            {provider.businessCategory ?? "BookMiz provider"}
          </Text>
          <Text style={styles.imageTitle}>{provider.displayName}</Text>
          <Text style={styles.imageMeta}>
            {getMarketplaceLocationLabel(provider.primaryLocation)} ·{" "}
            {provider.averageRating ? provider.averageRating.toFixed(1) : "New"}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.summary}>{getProviderSummary(provider)}</Text>

        <View style={styles.serviceRow}>
          {provider.topServices.slice(0, 3).map((service) => (
            <View key={service.id} style={styles.serviceChip}>
              <Text style={styles.serviceChipText}>
                {service.name}
                {service.label ? ` · ${service.label}` : ""}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.priceText}>
              {formatMarketplacePrice(provider.lowestPriceCents, provider.priceRangeLabel)}
            </Text>
            <Text style={styles.footerMeta}>
              {provider.reviewCount > 0
                ? `${provider.reviewCount} reviews`
                : "Fresh on BookMiz"}
            </Text>
          </View>
          <View style={styles.footerRight}>
            <Text style={styles.distanceText}>
              {formatMarketplaceDistance(provider.distanceMiles)}
            </Text>
            <FontAwesome6 name="arrow-right-long" size={15} color={tokens.colors.ink} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: "hidden",
  },
  imageWrap: {
    height: 212,
    backgroundColor: tokens.colors.inkDeep,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(12,29,54,0.18)",
  },
  imageTopRow: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modelBadge: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  modelBadgeText: {
    color: tokens.colors.ink,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  bookmarkButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  imageBottom: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    gap: 4,
  },
  imageEyebrow: {
    color: tokens.colors.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  imageTitle: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  imageMeta: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    lineHeight: 18,
  },
  body: {
    padding: 16,
    gap: 14,
  },
  summary: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  serviceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  serviceChip: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  serviceChipText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  priceText: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  footerMeta: {
    marginTop: 4,
    color: tokens.colors.muted,
    fontSize: 12,
  },
  footerRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  distanceText: {
    color: tokens.colors.brandDeep,
    fontSize: 12,
    fontWeight: "800",
  },
});

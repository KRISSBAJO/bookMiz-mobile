import { useFocusEffect } from "expo-router/react-navigation";
import { FontAwesome6 } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SectionHeader } from "@/src/components/SectionHeader";
import {
  bookmarkMarketplaceProvider,
  getMarketplaceProvider,
  listCustomerBookmarkedProviders,
  removeMarketplaceProviderBookmark,
} from "@/src/lib/api/marketplace";
import type { MarketplaceProviderProfile } from "@/src/lib/api/types";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import {
  formatMarketplaceDistance,
  formatMarketplaceDuration,
  formatMarketplacePrice,
  getMarketplaceLocationLabel,
  resolveMarketplaceImage,
} from "@/src/lib/marketplace-display";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

function normalizeSlug(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function ProviderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const session = useSession();
  const slug = normalizeSlug(params.slug);

  const [profile, setProfile] = useState<MarketplaceProviderProfile | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!slug) {
      setError("We could not find that provider.");
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      const [nextProfile, bookmarks] = await Promise.all([
        getMarketplaceProvider(slug),
        session.isSignedIn
          ? listCustomerBookmarkedProviders().catch(() => [])
          : Promise.resolve([]),
      ]);

      setProfile(nextProfile);
      setIsBookmarked(
        bookmarks.some((provider) => provider.id === nextProfile.provider.id),
      );
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "We could not load this provider right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [session.isSignedIn, slug]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const featuredServices = useMemo(() => {
    if (!profile) {
      return [];
    }

    const suggested = profile.services.suggested;
    if (suggested.length > 0) {
      return suggested;
    }

    return profile.services.groups.flatMap((group) => group.services).slice(0, 4);
  }, [profile]);

  const toggleBookmark = useCallback(async () => {
    if (!session.isSignedIn || !profile) {
      return;
    }

    const nextState = !isBookmarked;
    setIsBookmarked(nextState);

    try {
      if (nextState) {
        await bookmarkMarketplaceProvider(profile.provider.id);
      } else {
        await removeMarketplaceProviderBookmark(profile.provider.id);
      }
    } catch {
      setIsBookmarked(!nextState);
    }
  }, [isBookmarked, profile, session.isSignedIn]);

  const handleBookAppointment = useCallback(() => {
    if (!slug) {
      return;
    }

    router.push({ pathname: "/booking/[slug]", params: { slug } } as never);
  }, [router, slug]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {profile ? (
        <>
          <View style={styles.hero}>
            <Image
              source={resolveMarketplaceImage(
                profile.provider.coverImageUrl ?? profile.gallery[0]?.url ?? null,
              )}
              style={styles.heroImage}
            />
            <View style={styles.heroOverlay} />
            <SafeAreaView style={styles.heroSafeArea} edges={["top"]}>
              <View style={styles.heroChrome}>
                <Pressable style={styles.heroButton} onPress={() => router.back()}>
                  <FontAwesome6 name="arrow-left-long" size={16} color="#fff" />
                  <Text style={styles.heroButtonText}>Back</Text>
                </Pressable>
                {session.isSignedIn ? (
                  <Pressable style={styles.heroButton} onPress={() => void toggleBookmark()}>
                    <FontAwesome6
                      name={isBookmarked ? "bookmark" : "bookmark"}
                      size={15}
                      color={isBookmarked ? tokens.colors.brand : "#fff"}
                    />
                    <Text style={styles.heroButtonText}>
                      {isBookmarked ? "Saved" : "Save"}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={[styles.heroButton, styles.heroButtonDisabled]}>
                    <FontAwesome6 name="bookmark" size={15} color="rgba(255,255,255,0.68)" />
                    <Text style={styles.heroButtonTextMuted}>Save</Text>
                  </View>
                )}
              </View>
            </SafeAreaView>

            <View style={styles.heroCopyWrap}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>
                  {profile.provider.businessCategory ?? "BookMiz provider"} ·{" "}
                  {getMarketplaceLocationLabel(profile.provider.primaryLocation)}
                </Text>
                <Text style={styles.heroTitle}>{profile.provider.displayName}</Text>
                <Text style={styles.heroSubtitle}>
                  {profile.provider.tagline ?? profile.provider.publicSummary ?? profile.provider.description}
                </Text>
                <View style={styles.heroStats}>
                  <View style={styles.heroStatPill}>
                    <FontAwesome6 name="star" size={12} color={tokens.colors.ink} solid />
                    <Text style={styles.heroStatText}>
                      {profile.provider.averageRating
                        ? profile.provider.averageRating.toFixed(1)
                        : "New"}
                    </Text>
                  </View>
                  <View style={styles.heroStatPill}>
                    <Text style={styles.heroStatText}>
                      {profile.reviewSummary.totalReviews} reviews
                    </Text>
                  </View>
                  <View style={styles.heroStatPill}>
                    <Text style={styles.heroStatText}>
                      {formatMarketplaceDistance(profile.provider.distanceMiles)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.galleryRail}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRailInner}>
                {profile.gallery.slice(0, 5).map((item) => (
                  <View key={item.id} style={styles.galleryFrame}>
                    <Image
                      source={resolveMarketplaceImage(item.url)}
                      style={styles.galleryImage}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.ctaPanel}>
              <View style={styles.ctaButtons}>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => void handleBookAppointment()}
                >
                  <Text style={styles.primaryButtonText}>
                    Book appointment
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/explore",
                      params: {
                        categorySlug: profile.provider.categorySlug ?? undefined,
                        serviceModel:
                          profile.provider.serviceModel === "PROFESSIONAL"
                            ? "PROFESSIONAL"
                            : "LOCAL",
                        locationQuery: profile.provider.primaryLocation?.localityLabel ?? undefined,
                      },
                    } as never)
                  }
                >
                  <Text style={styles.secondaryButtonText}>See similar providers</Text>
                </Pressable>
              </View>

              <View style={styles.linkRow}>
                {profile.provider.websiteUrl ? (
                  <Pressable
                    style={styles.linkChip}
                    onPress={() => void Linking.openURL(profile.provider.websiteUrl!)}
                  >
                    <FontAwesome6 name="globe" size={13} color={tokens.colors.ink} />
                    <Text style={styles.linkChipText}>Website</Text>
                  </Pressable>
                ) : null}
                {profile.provider.instagramUrl ? (
                  <Pressable
                    style={styles.linkChip}
                    onPress={() => void Linking.openURL(profile.provider.instagramUrl!)}
                  >
                    <FontAwesome6 name="instagram" size={13} color={tokens.colors.ink} />
                    <Text style={styles.linkChipText}>Instagram</Text>
                  </Pressable>
                ) : null}
                {profile.provider.businessPhone ? (
                  <View style={styles.linkChipStatic}>
                    <FontAwesome6 name="phone" size={12} color={tokens.colors.ink} />
                    <Text style={styles.linkChipText}>{profile.provider.businessPhone}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Profile details</Text>
              </View>
              <SectionHeader
                title="About this provider"
                subtitle="Live profile details from the same production marketplace feed as the web app."
              />
              <Text style={styles.bodyCopy}>
                {profile.provider.description ?? profile.provider.publicSummary}
              </Text>
              <View style={styles.metaGrid}>
                <View style={styles.metaCard}>
                  <Text style={styles.metaLabel}>Starts at</Text>
                  <Text style={styles.metaValue}>
                    {formatMarketplacePrice(
                      profile.provider.lowestPriceCents,
                      profile.provider.priceRangeLabel,
                    )}
                  </Text>
                </View>
                <View style={styles.metaCard}>
                  <Text style={styles.metaLabel}>Open today</Text>
                  <Text style={styles.metaValue}>{profile.hours.todayLabel}</Text>
                </View>
                <View style={styles.metaCard}>
                  <Text style={styles.metaLabel}>Years in business</Text>
                  <Text style={styles.metaValue}>
                    {profile.provider.yearsInBusiness ?? "Established"}
                  </Text>
                </View>
                <View style={styles.metaCard}>
                  <Text style={styles.metaLabel}>Location</Text>
                  <Text style={styles.metaValue}>
                    {getMarketplaceLocationLabel(profile.provider.primaryLocation)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Signature menu</Text>
              </View>
              <SectionHeader
                title="Top services"
                subtitle="Real services and pricing from this provider profile."
              />
              {featuredServices.slice(0, 6).map((service, index) => (
                <View key={service.id} style={styles.serviceCard}>
                  <View style={styles.serviceHeader}>
                    <View style={styles.serviceCountBadge}>
                      <Text style={styles.serviceCountBadgeText}>
                        {String(index + 1).padStart(2, "0")}
                      </Text>
                    </View>
                    <View style={styles.serviceHeaderCopy}>
                      <Text style={styles.serviceTitle}>{service.name}</Text>
                      <Text style={styles.serviceMeta}>
                        {formatMarketplaceDuration(service.durationMinutes)}
                        {service.marketplaceLabel ? ` · ${service.marketplaceLabel}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.servicePrice}>
                      {formatMarketplacePrice(service.priceCents)}
                    </Text>
                  </View>
                  {service.description ? (
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  ) : null}
                </View>
              ))}
            </View>

            <View style={styles.panel}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>House details</Text>
              </View>
              <SectionHeader
                title="Hours and policies"
                subtitle="The practical details customers usually need before they commit."
              />
              {profile.hours.week.map((day) => (
                <View key={day.weekday} style={styles.scheduleRow}>
                  <Text style={styles.scheduleDay}>{day.dayLabel}</Text>
                  <Text style={styles.scheduleValue}>
                    {day.isClosed ? "Closed" : day.slots.map((slot) => slot.label).join(", ")}
                  </Text>
                </View>
              ))}
              {profile.provider.bookingPolicy ? (
                <Text style={styles.policyCopy}>Booking: {profile.provider.bookingPolicy}</Text>
              ) : null}
              {profile.provider.cancellationPolicy ? (
                <Text style={styles.policyCopy}>
                  Cancellation: {profile.provider.cancellationPolicy}
                </Text>
              ) : null}
              {profile.provider.paymentPolicy ? (
                <Text style={styles.policyCopy}>Payment: {profile.provider.paymentPolicy}</Text>
              ) : null}
            </View>

            <View style={styles.panel}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Client feedback</Text>
              </View>
              <SectionHeader
                title="Recent client feedback"
                subtitle={`Average ${profile.reviewSummary.averageRating.toFixed(1)} across ${profile.reviewSummary.totalReviews} reviews.`}
              />
              {profile.reviewSummary.reviews.slice(0, 3).map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewName}>{review.reviewerName ?? "BookMiz client"}</Text>
                    <View style={styles.reviewRating}>
                      <FontAwesome6 name="star" size={11} color={tokens.colors.ink} solid />
                      <Text style={styles.reviewRatingText}>{review.rating.toFixed(1)}</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewKicker}>Verified BookMiz review</Text>
                  {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
                  {review.content ? <Text style={styles.reviewBody}>{review.content}</Text> : null}
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      ) : (
        <SafeAreaView style={styles.emptyState}>
          <Pressable style={styles.heroButton} onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left-long" size={18} color={tokens.colors.ink} />
          </Pressable>
          <Text style={styles.emptyTitle}>
            {isLoading ? "Loading provider..." : "We couldn’t load this provider."}
          </Text>
          {error ? <Text style={styles.emptyBody}>{error}</Text> : null}
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  hero: {
    height: 404,
    backgroundColor: tokens.colors.inkDeep,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(12,29,54,0.36)",
  },
  heroSafeArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  heroChrome: {
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroButton: {
    minWidth: 76,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(12,29,54,0.66)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  heroButtonDisabled: {
    opacity: 0.9,
  },
  heroButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  heroButtonTextMuted: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "800",
  },
  heroCopyWrap: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 22,
    zIndex: 1,
  },
  heroCopy: {
    borderRadius: 30,
    backgroundColor: "rgba(12,29,54,0.36)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  heroEyebrow: {
    color: tokens.colors.gold,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 15,
    lineHeight: 23,
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroStatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  heroStatText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  scroll: {
    flex: 1,
    marginTop: -30,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 100,
    gap: 18,
  },
  galleryRail: {
    marginTop: 2,
  },
  galleryRailInner: {
    gap: 12,
    paddingRight: 8,
  },
  galleryFrame: {
    borderRadius: 24,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 6,
    shadowColor: tokens.colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  galleryImage: {
    width: 146,
    height: 104,
    borderRadius: 18,
    backgroundColor: tokens.colors.surfaceSoft,
  },
  ctaPanel: {
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
    gap: 14,
    shadowColor: tokens.colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  ctaButtons: {
    gap: 10,
  },
  primaryButton: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  secondaryButtonText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  linkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  linkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkChipStatic: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: "#ecf8d1",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkChipText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  panel: {
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
    gap: 14,
    shadowColor: tokens.colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  sectionLabelRow: {
    flexDirection: "row",
  },
  sectionLabel: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#f5efe7",
    color: tokens.colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: "uppercase",
  },
  bodyCopy: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaCard: {
    width: "48%",
    borderRadius: 24,
    backgroundColor: "#fbfcff",
    borderWidth: 1,
    borderColor: "#dce3ef",
    padding: 14,
    gap: 6,
    shadowColor: tokens.colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  metaLabel: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  metaValue: {
    color: tokens.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
  },
  serviceCard: {
    borderRadius: 24,
    backgroundColor: "#fbfcff",
    borderWidth: 1,
    borderColor: "#dce3ef",
    padding: 16,
    gap: 10,
    shadowColor: tokens.colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  serviceCountBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f5efe7",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceCountBadgeText: {
    color: tokens.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  serviceHeaderCopy: {
    flex: 1,
  },
  serviceTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  serviceMeta: {
    marginTop: 4,
    color: tokens.colors.muted,
    fontSize: 12,
  },
  servicePrice: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  serviceDescription: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  scheduleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  scheduleDay: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  scheduleValue: {
    flex: 1,
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "right",
  },
  policyCopy: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 21,
  },
  reviewCard: {
    borderRadius: 24,
    backgroundColor: "#fbfcff",
    borderWidth: 1,
    borderColor: "#dce3ef",
    padding: 16,
    gap: 10,
    shadowColor: tokens.colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  reviewName: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  reviewRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: tokens.radius.pill,
    backgroundColor: "#ecf8d1",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  reviewRatingText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  reviewTitle: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  reviewKicker: {
    color: tokens.colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  reviewBody: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    gap: 18,
    backgroundColor: tokens.colors.surface,
  },
  emptyTitle: {
    color: tokens.colors.ink,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  emptyBody: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
});

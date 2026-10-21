import { useFocusEffect } from "expo-router/react-navigation";
import { FontAwesome6 } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthButton } from "@/src/components/auth/AuthButton";
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
  formatPriceTier,
  getMarketplaceLocationLabel,
  resolveMarketplaceImage,
} from "@/src/lib/marketplace-display";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";
import { mobileEnv } from "@/src/lib/mobile-env";
import { businessPagePath, publicWebsiteUrl, publicSocialUrl, publicPhoneUrl } from "@/src/lib/public-business-links";

function normalizeSlug(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function ProviderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string | string[]; locationId?: string | string[] }>();
  const session = useSession();
  const slug = normalizeSlug(params.slug);
  const locationId = Array.isArray(params.locationId) ? params.locationId[0] : params.locationId;

  const [profile, setProfile] = useState<MarketplaceProviderProfile | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openPublicLink = useCallback(async (url: string) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert("Could not open link", "Please try again or open this business page from the BookMiz website."); }
  }, []);

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

      const branch = locationId ? nextProfile.provider.locations.find(branch => branch.id === locationId) : null;
      if (locationId && !branch) throw new Error("This business location is no longer available. Please choose another business or location.");
      setProfile(branch ? {...nextProfile,provider:{...nextProfile.provider,primaryLocation:branch,map:{latitude:branch.latitude,longitude:branch.longitude,addressLabel:branch.addressLabel}}} : nextProfile);
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
  }, [session.isSignedIn, slug, locationId]);

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

    router.push({ pathname: "/booking/[slug]", params: { slug, locationId: profile?.provider.primaryLocation?.id } } as never);
  }, [router, slug, profile?.provider.primaryLocation?.id]);

  const currencyCode = profile?.provider.currencyCode;
  const priceTier = formatPriceTier(profile?.provider.priceRangeLabel);
  const startsAt =
    profile && profile.provider.lowestPriceCents !== null
      ? formatMarketplacePrice(profile.provider.lowestPriceCents, null, profile.provider.lowestPriceCurrencyCode)
      : null;
  const about = profile?.provider.description ?? profile?.provider.publicSummary ?? null;
  const businessUrl = profile ? `${mobileEnv.webAppUrl}${businessPagePath(profile.provider.slug)}` : null;
  const externalWebsite = publicWebsiteUrl(profile?.provider.websiteUrl);
  const instagramUrl = publicSocialUrl(profile?.provider.instagramUrl, 'instagram');
  const phoneUrl = publicPhoneUrl(profile?.provider.businessPhone);
  const tagline =
    profile?.provider.tagline ??
    (profile?.provider.publicSummary && profile.provider.publicSummary !== about
      ? profile.provider.publicSummary
      : null);
  const policies = profile
    ? [
        { label: "Booking", value: profile.provider.bookingPolicy },
        { label: "Cancellation", value: profile.provider.cancellationPolicy },
        { label: "Payment", value: profile.provider.paymentPolicy },
      ].filter((item) => item.value)
    : [];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {profile ? (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.photo}>
              <Image
                source={resolveMarketplaceImage(
                  profile.provider.coverImageUrl ?? profile.gallery[0]?.url ?? null,
                )}
                style={styles.photoImage}
              />
              <SafeAreaView style={styles.photoChrome} edges={["top"]}>
                <View style={styles.photoChromeRow}>
                  <Pressable
                    style={styles.roundButton}
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                  >
                    <FontAwesome6 name="chevron-left" size={16} color={tokens.colors.ink} />
                  </Pressable>
                  <Pressable
                    style={styles.roundButton}
                    onPress={() => void toggleBookmark()}
                    disabled={!session.isSignedIn}
                    accessibilityRole="button"
                    accessibilityLabel={isBookmarked ? "Remove from saved" : "Save provider"}
                    accessibilityState={{ selected: isBookmarked, disabled: !session.isSignedIn }}
                  >
                    <FontAwesome6
                      name="heart"
                      size={17}
                      solid={isBookmarked}
                      color={isBookmarked ? tokens.colors.danger : tokens.colors.ink}
                    />
                  </Pressable>
                </View>
              </SafeAreaView>
              {profile.hours.isOpenNow ? (
                <View style={styles.openBadge}>
                  <Text style={styles.openBadgeText}>Open now</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.body}>
              <View style={styles.headBlock}>
                <Text style={styles.name}>{profile.provider.displayName}</Text>
                <View style={styles.ratingRow}>
                  <FontAwesome6 name="star" size={14} color={tokens.colors.ink} solid />
                  <Text style={styles.ratingText}>
                    {profile.provider.averageRating
                      ? profile.provider.averageRating.toFixed(1)
                      : "New"}
                  </Text>
                  <Text style={styles.ratingMeta}>
                    {profile.reviewSummary.totalReviews > 0
                      ? ` (${profile.reviewSummary.totalReviews} review${profile.reviewSummary.totalReviews === 1 ? "" : "s"})`
                      : ""}
                  </Text>
                  <Text style={styles.ratingMeta}>
                    {" · "}
                    {formatMarketplaceDistance(profile.provider.distanceMiles)}
                  </Text>
                </View>
                <View style={styles.locationRow}>
                  <FontAwesome6 name="location-dot" size={14} color={tokens.colors.muted} />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {[
                      profile.provider.businessCategory,
                      profile.provider.primaryLocation?.addressLabel ??
                        getMarketplaceLocationLabel(profile.provider.primaryLocation),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
              </View>

              <View style={styles.factRow}>
                <View style={styles.fact}>
                  <Text style={styles.factLabel}>Today</Text>
                  <Text style={styles.factValue} numberOfLines={2}>
                    {profile.hours.todayLabel}
                  </Text>
                </View>
                <View style={styles.fact}>
                  <Text style={styles.factLabel}>From</Text>
                  <Text style={styles.factValue} numberOfLines={1}>
                    {startsAt ?? "See services"}
                  </Text>
                  {priceTier ? (
                    <Text style={styles.factCaption} numberOfLines={1}>
                      {priceTier}
                    </Text>
                  ) : null}
                </View>
                {profile.provider.yearsInBusiness ? (
                  <View style={styles.fact}>
                    <Text style={styles.factLabel}>In business</Text>
                    <Text style={styles.factValue} numberOfLines={1}>
                      {profile.provider.yearsInBusiness} yr{profile.provider.yearsInBusiness === 1 ? "" : "s"}
                    </Text>
                  </View>
                ) : null}
              </View>

              {businessUrl ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.railScroll}
                  contentContainerStyle={styles.rail}
                >
                  <Pressable style={styles.chip} onPress={() => void openPublicLink(businessUrl)} accessibilityRole="link" accessibilityLabel={`Open ${profile.provider.displayName}'s BookMiz business page`}>
                    <FontAwesome6 name="store" size={14} color={tokens.colors.ink} />
                    <Text style={styles.chipText}>Business page</Text>
                  </Pressable>
                  <Pressable style={styles.chip} accessibilityRole="button" accessibilityLabel={`Share ${profile.provider.displayName}'s business page`} onPress={() => {
                    void Share.share({ title: `${profile.provider.displayName} on BookMiz`, message: `${profile.provider.displayName} on BookMiz\n${businessUrl}`, url: businessUrl }).catch(() => Alert.alert("Could not share", "Please try again."));
                  }}>
                    <FontAwesome6 name="arrow-up-from-bracket" size={14} color={tokens.colors.ink} />
                    <Text style={styles.chipText}>Share</Text>
                  </Pressable>
                  {externalWebsite ? (
                    <Pressable
                      style={styles.chip}
                      onPress={() => void openPublicLink(externalWebsite)}
                      accessibilityRole="link"
                    >
                      <FontAwesome6 name="globe" size={14} color={tokens.colors.ink} />
                      <Text style={styles.chipText}>Website</Text>
                    </Pressable>
                  ) : null}
                  {instagramUrl ? (
                    <Pressable
                      style={styles.chip}
                      onPress={() => void openPublicLink(instagramUrl)}
                      accessibilityRole="link"
                    >
                      <FontAwesome6 name="instagram" size={14} color={tokens.colors.ink} />
                      <Text style={styles.chipText}>Instagram</Text>
                    </Pressable>
                  ) : null}
                  {phoneUrl ? (
                    <Pressable style={styles.chip} accessibilityRole="link" accessibilityLabel={`Call ${profile.provider.displayName}`} onPress={() => void openPublicLink(phoneUrl)}>
                      <FontAwesome6 name="phone" size={14} color={tokens.colors.ink} />
                      <Text style={styles.chipText}>{profile.provider.businessPhone}</Text>
                    </Pressable>
                  ) : null}
                </ScrollView>
              ) : null}

              {profile.gallery.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.railScroll}
                  contentContainerStyle={styles.rail}
                >
                  {profile.gallery.slice(0, 6).map((item) => (
                    <Image
                      key={item.id}
                      source={resolveMarketplaceImage(item.url)}
                      style={styles.galleryImage}
                      accessibilityLabel={item.altText ?? undefined}
                    />
                  ))}
                </ScrollView>
              ) : null}

              {about ? (
                <View style={styles.section}>
                  <SectionHeader title="About" />
                  <View style={styles.card}>
                    <Text style={styles.bodyCopy}>{about}</Text>
                  </View>
                </View>
              ) : null}

              {featuredServices.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader title="Services" />
                  <View style={styles.card}>
                    {featuredServices.slice(0, 6).map((service, index) => (
                      <View
                        key={service.id}
                        style={[styles.serviceRow, index > 0 ? styles.rowDivider : null]}
                      >
                        <View style={styles.serviceBody}>
                          <Text style={styles.serviceTitle} numberOfLines={2}>
                            {service.name}
                          </Text>
                          <Text style={styles.serviceMeta} numberOfLines={1}>
                            {[
                              formatMarketplaceDuration(service.durationMinutes),
                              service.marketplaceLabel,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                          {service.description ? (
                            <Text style={styles.serviceDescription} numberOfLines={2}>
                              {service.description}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.servicePrice}>
                          {formatMarketplacePrice(service.priceCents, null, service.currencyCode)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.section}>
                <SectionHeader title="Hours" />
                <View style={styles.card}>
                  {profile.hours.week.map((day, index) => (
                    <View
                      key={day.weekday}
                      style={[styles.hoursRow, index > 0 ? styles.rowDivider : null]}
                    >
                      <Text style={styles.hoursDay}>{day.dayLabel}</Text>
                      <Text style={[styles.hoursValue, day.isClosed ? styles.hoursClosed : null]}>
                        {day.isClosed ? "Closed" : day.slots.map((slot) => slot.label).join(", ")}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {policies.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader title="Policies" />
                  <View style={styles.card}>
                    {policies.map((item, index) => (
                      <View
                        key={item.label}
                        style={[styles.policyRow, index > 0 ? styles.rowDivider : null]}
                      >
                        <Text style={styles.policyLabel}>{item.label}</Text>
                        <Text style={styles.policyValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {profile.reviewSummary.reviews.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader
                    title="Reviews"
                    subtitle={`${profile.reviewSummary.averageRating.toFixed(1)} average · ${profile.reviewSummary.totalReviews} review${profile.reviewSummary.totalReviews === 1 ? "" : "s"}`}
                  />
                  {profile.reviewSummary.reviews.slice(0, 3).map((review) => (
                    <View key={review.id} style={styles.card}>
                      <View style={styles.reviewHeader}>
                        <View style={styles.reviewWho}>
                          <Text style={styles.reviewName} numberOfLines={1}>
                            {review.reviewerName ?? "BookMiz customer"}
                          </Text>
                          <Text style={styles.reviewMeta} numberOfLines={1}>
                            {[
                              formatReviewDate(review.createdAt),
                              review.serviceName,
                              review.isVerifiedBooking ? "Verified booking" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </View>
                        <View style={styles.reviewRating}>
                          <FontAwesome6 name="star" size={12} color={tokens.colors.ink} solid />
                          <Text style={styles.reviewRatingText}>{review.rating.toFixed(1)}</Text>
                        </View>
                      </View>
                      {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
                      {review.content ? <Text style={styles.reviewBody}>{review.content}</Text> : null}
                      {review.responseText ? (
                        <View style={styles.reviewReply}>
                          <Text style={styles.reviewReplyLabel}>
                            Reply from {review.responseByName ?? profile.provider.displayName}
                          </Text>
                          <Text style={styles.reviewReplyBody}>{review.responseText}</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </ScrollView>

          <SafeAreaView edges={["bottom"]} style={styles.bookBar}>
            <View style={styles.bookBarRow}>
              <AuthButton
                label="Similar"
                variant="secondary"
                style={styles.similarButton}
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
              />
              <AuthButton
                label="Book"
                icon="arrow-right"
                style={styles.bookButton}
                onPress={() => void handleBookAppointment()}
              />
            </View>
          </SafeAreaView>
        </>
      ) : (
        <View style={styles.fallback}>
          <SafeAreaView edges={["top"]} style={styles.fallbackChrome}>
            <Pressable
              style={styles.roundButton}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <FontAwesome6 name="chevron-left" size={16} color={tokens.colors.ink} />
            </Pressable>
          </SafeAreaView>
          {isLoading ? (
            <DetailSkeleton />
          ) : (
            <View style={styles.fallbackBody}>
              <View style={styles.errorBox}>
                <Text style={styles.errorText} accessibilityRole="alert">
                  {error ?? "We could not load this provider."}
                </Text>
                <Pressable onPress={() => void loadProfile()} accessibilityRole="button">
                  <Text style={styles.errorRetry}>Try again</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function DetailSkeleton() {
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
    <Animated.View style={[styles.skeleton, { opacity }]} accessibilityLabel="Loading provider">
      <View style={styles.skeletonPhoto} />
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonLine, styles.skeletonTitle]} />
        <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
        <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonCard} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  photo: {
    height: 280,
    backgroundColor: tokens.colors.navySoft,
  },
  photoImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  photoChrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  photoChromeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  openBadge: {
    position: "absolute",
    left: 20,
    bottom: 16,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  openBadgeText: {
    color: tokens.colors.inkDeep,
    fontSize: 12,
    fontFamily: tokens.font.semibold,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },
  headBlock: {
    gap: 6,
  },
  name: {
    color: tokens.colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: tokens.font.display,
    letterSpacing: -0.4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.semibold,
  },
  ratingMeta: {
    color: tokens.colors.muted,
    fontSize: 14,
    fontFamily: tokens.font.regular,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  locationText: {
    flex: 1,
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
  tagline: {
    color: tokens.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: tokens.font.regular,
    marginTop: 4,
  },
  factRow: {
    flexDirection: "row",
    gap: 10,
  },
  fact: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 12,
    gap: 2,
  },
  factLabel: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontFamily: tokens.font.semibold,
  },
  factValue: {
    color: tokens.colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: tokens.font.semibold,
  },
  factCaption: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontFamily: tokens.font.regular,
  },
  railScroll: {
    marginHorizontal: -20,
  },
  rail: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
  },
  chipText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  galleryImage: {
    width: 140,
    height: 100,
    borderRadius: 12,
    backgroundColor: tokens.colors.border,
    resizeMode: "cover",
  },
  section: {
    gap: 12,
  },
  card: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  bodyCopy: {
    color: tokens.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: tokens.font.regular,
    paddingVertical: 10,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  serviceBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  serviceTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.display,
  },
  serviceMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  serviceDescription: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
    marginTop: 2,
  },
  servicePrice: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.semibold,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 10,
  },
  hoursDay: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  hoursValue: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "right",
    fontFamily: tokens.font.regular,
  },
  hoursClosed: {
    color: tokens.colors.muted,
  },
  policyRow: {
    paddingVertical: 10,
    gap: 2,
  },
  policyLabel: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  policyValue: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 10,
  },
  reviewWho: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  reviewName: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.semibold,
  },
  reviewMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  reviewRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  reviewRatingText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontFamily: tokens.font.semibold,
  },
  reviewTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.semibold,
    marginTop: 10,
  },
  reviewBody: {
    color: tokens.colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
    marginTop: 6,
    marginBottom: 10,
  },
  reviewReply: {
    borderRadius: 12,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: 12,
    gap: 4,
    marginBottom: 10,
  },
  reviewReplyLabel: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontFamily: tokens.font.semibold,
  },
  reviewReplyBody: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
  },
  bookBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  bookBarRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  similarButton: {
    flex: 1,
  },
  bookButton: {
    flex: 2,
  },
  fallback: {
    flex: 1,
  },
  fallbackChrome: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  fallbackBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
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
  skeleton: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 20,
  },
  skeletonPhoto: {
    height: 200,
    borderRadius: 16,
    backgroundColor: tokens.colors.border,
  },
  skeletonBody: {
    gap: 12,
  },
  skeletonLine: {
    height: 14,
    width: "60%",
    borderRadius: 7,
    backgroundColor: tokens.colors.border,
  },
  skeletonTitle: {
    height: 22,
    width: "70%",
    borderRadius: 8,
  },
  skeletonLineShort: {
    width: "35%",
  },
  skeletonLineWide: {
    width: "85%",
  },
  skeletonCard: {
    height: 88,
    borderRadius: 16,
    backgroundColor: tokens.colors.border,
    marginTop: 8,
  },
});

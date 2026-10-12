import { useFocusEffect } from "expo-router/react-navigation";
import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/src/components/Screen";
import { SectionHeader } from "@/src/components/SectionHeader";
import { listCustomerBookings } from "@/src/lib/api/bookings";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import {
  listCategoryDiscovery,
  listCustomerBookmarkedProviders,
  listCustomerQuoteRequests,
  searchProviders,
} from "@/src/lib/api/marketplace";
import type {
  CustomerBookingRecord,
  CustomerQuoteRequest,
  MarketplaceCategoryDiscovery,
  MarketplaceProviderCard,
} from "@/src/lib/api/types";
import {
  formatMarketplaceDistance,
  getMarketplaceLocationLabel,
  getProviderHeroImage,
  getProviderSummary,
} from "@/src/lib/marketplace-display";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

const categoryArt = {
  beauty: require("../../assets/bookmiz/manicure.png"),
  barber: require("../../assets/bookmiz/barber.png"),
  professional: require("../../assets/bookmiz/hospital.png"),
};

const actionIcons = {
  quote: "wand-magic-sparkles",
  explore: "location-dot",
  inbox: "comment-dots",
  appointments: "calendar-days",
  account: "user-large",
} as const;

type HomeCollection = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  image: any;
  params: {
    categorySlug?: string;
    serviceModel: "LOCAL" | "PROFESSIONAL";
    query?: string;
  };
};

const curatedFallbackCollections: HomeCollection[] = [
  {
    id: "fallback-beauty",
    eyebrow: "Beauty reset",
    title: "Nails, glow, and soft glam",
    subtitle: "Clean, popular beauty services worth browsing first.",
    image: categoryArt.beauty,
    params: { serviceModel: "LOCAL" as const, query: "nails" },
  },
  {
    id: "fallback-barber",
    eyebrow: "Grooming",
    title: "Fresh barbering near you",
    subtitle: "Cuts, fades, trims, and home or studio appointments.",
    image: categoryArt.barber,
    params: { serviceModel: "LOCAL" as const, query: "barber" },
  },
  {
    id: "fallback-care",
    eyebrow: "Professional care",
    title: "Consults and wellness support",
    subtitle: "Professional services when you need something more guided.",
    image: categoryArt.professional,
    params: { serviceModel: "PROFESSIONAL" as const },
  },
];

const featuredFallbackCards = [
  {
    id: "fallback-featured-nearby",
    title: "Start with polished local providers",
    caption: "Jump into the live marketplace feed and compare who is already active nearby.",
    button: "Explore local",
    params: { serviceModel: "LOCAL" as const },
  },
  {
    id: "fallback-featured-bookmarks",
    title: "Build your shortlist fast",
    caption: "Save providers you like, then come back when you are ready to request or book.",
    button: "See marketplace",
    params: { serviceModel: "LOCAL" as const },
  },
];

const requestStarterCards = [
  {
    id: "starter-nails",
    title: "Start a manicure request",
    caption: "Ask for polish, timing, and location in one clean request.",
    params: {
      service: "Manicure",
      description: "I need a manicure appointment and want to compare providers.",
      city: "Chicago",
    },
  },
  {
    id: "starter-barber",
    title: "Ask for a barber visit",
    caption: "Post your haircut or grooming need and wait for provider replies.",
    params: {
      service: "Haircut",
      description: "I need a barber or haircut appointment and would like quotes.",
      city: "Chicago",
    },
  },
];

function getCategoryImage(category: MarketplaceCategoryDiscovery) {
  const slug = category.slug.toLowerCase();

  if (slug.includes("barber")) {
    return categoryArt.barber;
  }

  if (
    slug.includes("medical") ||
    slug.includes("health") ||
    slug.includes("therapy") ||
    category.serviceModel === "PROFESSIONAL"
  ) {
    return categoryArt.professional;
  }

  return categoryArt.beauty;
}

function formatRequestStatus(status: CustomerQuoteRequest["status"]) {
  switch (status) {
    case "MATCHED":
      return "Matched";
    case "ACCEPTED":
      return "Booked";
    case "CANCELLED":
      return "Cancelled";
    case "EXPIRED":
      return "Expired";
    default:
      return "Open";
  }
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function resolveMarketplaceLane(
  serviceModel: MarketplaceCategoryDiscovery["serviceModel"],
) {
  return serviceModel === "PROFESSIONAL" ? "PROFESSIONAL" : "LOCAL";
}

export function HomeScreen() {
  const router = useRouter();
  const session = useSession();
  const [categories, setCategories] = useState<MarketplaceCategoryDiscovery[]>([]);
  const [featuredProviders, setFeaturedProviders] = useState<MarketplaceProviderCard[]>([]);
  const [bookmarks, setBookmarks] = useState<MarketplaceProviderCard[]>([]);
  const [requests, setRequests] = useState<CustomerQuoteRequest[]>([]);
  const [bookings, setBookings] = useState<CustomerBookingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHomeData = useCallback(async () => {
    if (!session.user) {
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      const [nextCategories, marketplace, nextRequests, nextBookmarks, nextBookings] =
        await Promise.all([
          listCategoryDiscovery("LOCAL"),
          searchProviders({
            serviceModel: "LOCAL",
            sort: "recommended",
            pageSize: 6,
          }),
          listCustomerQuoteRequests({
            requesterUserId: session.user.id,
            requesterEmail: session.user.email,
          }),
          listCustomerBookmarkedProviders().catch(() => []),
          listCustomerBookings().catch(() => []),
        ]);

      setCategories(nextCategories);
      setFeaturedProviders(
        marketplace.featuredProviders.length > 0
          ? marketplace.featuredProviders
          : marketplace.results,
      );
      setRequests(nextRequests);
      setBookmarks(nextBookmarks);
      setBookings(nextBookings);
    } catch (nextError) {
      const message = getFriendlyApiError(
        nextError,
        "We could not load your home feed right now.",
      );
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [session.user]);

  useFocusEffect(
    useCallback(() => {
      void loadHomeData();
    }, [loadHomeData]),
  );

  const firstName = session.user?.firstName ?? "BookMiz";
  const city = session.profile?.city ?? session.user?.city ?? "your area";
  const upcomingBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.status !== "CANCELLED" &&
          booking.status !== "COMPLETED" &&
          new Date(booking.endsAt).getTime() >= Date.now(),
      ),
    [bookings],
  );

  const quickActions = useMemo(
    () => [
      {
        id: "quote",
        title: "Request a quote",
        caption: requests.length > 0 ? `${requests.length} requests in motion` : "Tell BookMiz what you need",
        route: "/(tabs)/workbench",
      },
      {
        id: "explore",
        title: "Explore nearby",
        caption: `${featuredProviders.length || 0} polished providers ready to browse`,
        route: "/(tabs)/explore",
      },
      {
        id: "inbox",
        title: "Open inbox",
        caption: "Catch replies, reminders, and updates fast",
        route: "/(tabs)/inbox",
      },
      {
        id: "appointments",
        title: "My appointments",
        caption:
          upcomingBookings.length > 0
            ? `${upcomingBookings.length} upcoming appointments`
            : "See bookings, past visits, and live sessions",
        route: "/appointments",
      },
    ],
    [featuredProviders.length, requests.length, upcomingBookings.length],
  );

  const spotlightProviders = bookmarks.length > 0 ? bookmarks : featuredProviders;
  const homeCollections = useMemo<HomeCollection[]>(
    () =>
      categories.length > 0
        ? categories.map((category) => ({
            id: category.id,
            eyebrow: `${category.stats.providerCount} providers`,
            title: category.name,
            subtitle:
              category.description ??
              `${category.stats.serviceCount} services worth comparing.`,
            image: getCategoryImage(category),
            params: {
              categorySlug: category.slug,
              serviceModel: resolveMarketplaceLane(category.serviceModel),
            },
          }))
        : curatedFallbackCollections,
    [categories],
  );
  const defaultLocationQuery = session.profile?.city
    ? session.profile?.stateCode
      ? `${session.profile.city}, ${session.profile.stateCode}`
      : session.profile.city
    : undefined;
  const heroProvider = spotlightProviders[0];
  const supportingProviders = spotlightProviders.slice(1, 3);
  const isSavedPreviewLimited = bookmarks.length > 3;
  const savedPreviewCount = Math.min(bookmarks.length, 3);

  const openExplore = useCallback(
    (params?: {
      categorySlug?: string;
      serviceModel?: "LOCAL" | "PROFESSIONAL";
      query?: string;
      locationQuery?: string;
    }) => {
      router.push({
        pathname: "/(tabs)/explore",
        params: {
          categorySlug: params?.categorySlug,
          serviceModel: params?.serviceModel,
          query: params?.query,
          locationQuery: params?.locationQuery,
        },
      } as never);
    },
    [router],
  );

  const openProvider = useCallback(
    (slug: string) => {
      router.push(`/providers/${slug}` as never);
    },
    [router],
  );

  const openSavedProviders = useCallback(() => {
    router.push("/saved-providers");
  }, [router]);

  const openRequestFlow = useCallback(
    (params?: {
      service?: string;
      description?: string;
      city?: string;
      provider?: string;
    }) => {
      router.push({
        pathname: "/(tabs)/workbench",
        params,
      } as never);
    },
    [router],
  );

  return (
    <Screen
      eyebrow={`${firstName}'s edit · ${city}`}
      title="Book beauty and care beautifully"
      subtitle="Curated providers, saved favorites, and request updates all in one cleaner mobile flow."
      heroTopContent={
        <View style={styles.heroTopRow}>
          <View style={styles.heroBrandRow}>
            <View style={styles.heroBrandMark}>
              <Image
                source={require("../../assets/bookmiz/logo.png")}
                style={styles.heroBrandLogo}
              />
            </View>
            <Text style={styles.heroBrandTitle}>BookMiz</Text>
          </View>
          <View style={styles.heroLocationChip}>
            <FontAwesome6 name="location-dot" size={11} color={tokens.colors.gold} />
            <Text style={styles.heroLocationChipText}>{city}</Text>
          </View>
        </View>
      }
      heroContent={
        <View style={styles.heroEditorialCard}>
          <Text style={styles.heroEditorialEyebrow}>
            {heroProvider ? "Now standing out near you" : "A cleaner first touch"}
          </Text>
          <Text style={styles.heroEditorialTitle}>
            {heroProvider
              ? `${heroProvider.displayName} is catching attention in your feed.`
              : "A calmer way to discover, compare, and request."}
          </Text>
          <Text style={styles.heroEditorialBody}>
            {heroProvider
              ? getProviderSummary(heroProvider)
              : "Explore polished providers, save the ones you like, and start a request without the marketplace feeling loud."}
          </Text>

          <View style={styles.heroActionRow}>
            <Pressable
              style={styles.heroPrimaryAction}
              onPress={() =>
                heroProvider?.slug
                  ? openProvider(heroProvider.slug)
                  : openExplore({ locationQuery: defaultLocationQuery, serviceModel: "LOCAL" })
              }
            >
              <Text style={styles.heroPrimaryActionText}>
                {heroProvider?.slug ? "Open featured provider" : "Explore providers"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.heroSecondaryAction}
              onPress={() =>
                openRequestFlow({
                  service: heroProvider?.topServices[0]?.name ?? "Service request",
                  description: heroProvider
                    ? `I want to request a service like ${heroProvider.topServices[0]?.name ?? heroProvider.businessCategory ?? "this"} with ${heroProvider.displayName}.`
                    : "I want help finding the right provider for my service.",
                  city: session.profile?.city ?? session.user?.city ?? "Chicago",
                  provider: heroProvider?.displayName,
                })
              }
            >
              <Text style={styles.heroSecondaryActionText}>Start request</Text>
            </Pressable>
          </View>

          <View style={styles.heroMetricRail}>
            <View style={styles.heroMetricChip}>
              <Text style={styles.heroMetricChipValue}>{bookmarks.length}</Text>
              <Text style={styles.heroMetricChipLabel}>saved</Text>
            </View>
            <View style={styles.heroMetricChip}>
              <Text style={styles.heroMetricChipValue}>{requests.length}</Text>
              <Text style={styles.heroMetricChipLabel}>in motion</Text>
            </View>
            <View style={styles.heroMetricChip}>
              <Text style={styles.heroMetricChipValue}>{upcomingBookings.length}</Text>
              <Text style={styles.heroMetricChipLabel}>booked</Text>
            </View>
          </View>
        </View>
      }
      contentTopOffset={24}
      heroBottomPadding={40}
    >
      <View style={styles.panel}>
        <SectionHeader
          title="Move with your thumbs"
          subtitle="The essentials should feel immediate: request, discover, message, and manage your account."
        />
        <View style={styles.actionGrid}>
          {quickActions.map((action) => (
            <Pressable
              key={action.id}
              style={styles.actionCard}
              onPress={() => router.push(action.route as never)}
            >
              <View style={styles.actionTopRow}>
                <View style={styles.actionIcon}>
                  <FontAwesome6
                    name={actionIcons[action.id as keyof typeof actionIcons]}
                    size={15}
                    color={tokens.colors.ink}
                  />
                </View>
                <FontAwesome6
                  name="arrow-right-long"
                  size={14}
                  color={tokens.colors.muted}
                />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionCaption}>{action.caption}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <SectionHeader
          title="Curated for the way you actually browse"
          subtitle="Live categories from the marketplace, with visual polish layered on top."
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.collectionRail}
        >
          {homeCollections.map((category) => (
            <Pressable
              key={category.id}
              style={styles.collectionCard}
              onPress={() =>
                openExplore({
                  categorySlug: category.params.categorySlug,
                  serviceModel: category.params.serviceModel,
                  query: category.params.query,
                  locationQuery: defaultLocationQuery,
                })
              }
            >
              <Image source={category.image} style={styles.collectionImage} />
              <View style={styles.collectionOverlay} />
              <View style={styles.collectionBody}>
                <Text style={styles.collectionEyebrow}>{category.eyebrow}</Text>
                <Text style={styles.collectionTitle}>{category.title}</Text>
                <Text style={styles.collectionSubtitle}>{category.subtitle}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.panel}>
        <SectionHeader
          title={bookmarks.length > 0 ? "Saved providers" : "Featured for you"}
          subtitle={
            bookmarks.length > 0
              ? "The providers you bookmarked on BookMiz, ready to revisit."
              : "Recommended providers from the live marketplace feed."
          }
        />
        {spotlightProviders.length > 0
          ? (
              <View style={styles.featuredStack}>
                {bookmarks.length > 0 ? (
                  <View style={styles.savedPreviewBar}>
                    <View style={styles.savedPreviewCopy}>
                      <Text style={styles.savedPreviewTitle}>
                        Showing {savedPreviewCount} of {bookmarks.length} saved
                      </Text>
                      <Text style={styles.savedPreviewCaption}>
                        Keep Home curated and light, then jump back into the marketplace when
                        you want the full shortlist.
                      </Text>
                    </View>
                    <Pressable
                      style={styles.savedPreviewButton}
                      onPress={() =>
                        bookmarks.length > 0
                          ? openSavedProviders()
                          : openExplore({
                              serviceModel: "LOCAL",
                              locationQuery: defaultLocationQuery,
                            })
                      }
                    >
                      <Text style={styles.savedPreviewButtonText}>
                        {bookmarks.length > 0
                          ? isSavedPreviewLimited
                            ? "Browse saved"
                            : "View saved"
                          : "Open marketplace"}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <Pressable
                  style={styles.featuredLeadCard}
                  onPress={() => openProvider(spotlightProviders[0].slug)}
                >
                  <Image
                    source={getProviderHeroImage(spotlightProviders[0])}
                    style={styles.featuredLeadImage}
                  />
                  <View style={styles.featuredLeadOverlay} />
                  <View style={styles.featuredLeadBody}>
                    <Text style={styles.featuredLeadEyebrow}>
                      {spotlightProviders[0].businessCategory ?? "BookMiz provider"}
                    </Text>
                    <Text style={styles.featuredLeadTitle}>
                      {spotlightProviders[0].displayName}
                    </Text>
                    <Text style={styles.featuredLeadMeta}>
                      {getMarketplaceLocationLabel(spotlightProviders[0].primaryLocation)} ·{" "}
                      {formatMarketplaceDistance(spotlightProviders[0].distanceMiles)}
                    </Text>
                    <Text style={styles.featuredLeadSummary} numberOfLines={3}>
                      {getProviderSummary(spotlightProviders[0])}
                    </Text>
                    <View style={styles.featuredLeadFooter}>
                      <View>
                        <Text style={styles.featuredLeadStat}>
                          {spotlightProviders[0].averageRating
                            ? `${spotlightProviders[0].averageRating.toFixed(1)} rating`
                            : "New on BookMiz"}
                        </Text>
                        <Text style={styles.featuredLeadSubstat}>
                          {spotlightProviders[0].reviewCount > 0
                            ? `${spotlightProviders[0].reviewCount} reviews`
                            : "Fresh profile"}
                        </Text>
                      </View>
                      <View style={styles.featuredLeadButton}>
                        <Text style={styles.featuredLeadButtonText}>Open profile</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>

                {supportingProviders.length > 0 ? (
                  <View style={styles.featuredMiniGrid}>
                    {supportingProviders.map((provider) => (
                      <Pressable
                        key={provider.id}
                        style={styles.featuredMiniCard}
                        onPress={() => openProvider(provider.slug)}
                      >
                        <Text style={styles.featuredMiniEyebrow}>
                          {provider.businessCategory ?? "Provider"}
                        </Text>
                        <Text style={styles.featuredMiniTitle}>{provider.displayName}</Text>
                        <Text style={styles.featuredMiniMeta}>
                          {getMarketplaceLocationLabel(provider.primaryLocation)}
                        </Text>
                        <View style={styles.featuredMiniFooter}>
                          <Text style={styles.featuredMiniDistance}>
                            {formatMarketplaceDistance(provider.distanceMiles)}
                          </Text>
                          <FontAwesome6
                            name="arrow-right-long"
                            size={14}
                            color={tokens.colors.ink}
                          />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            )
          : featuredFallbackCards.map((card) => (
              <Pressable
                key={card.id}
                style={styles.editorialCard}
                onPress={() =>
                  openExplore({
                    serviceModel: card.params.serviceModel,
                    locationQuery: defaultLocationQuery,
                  })
                }
              >
                <View style={styles.editorialCardCopy}>
                  <Text style={styles.editorialCardTitle}>{card.title}</Text>
                  <Text style={styles.editorialCardCaption}>{card.caption}</Text>
                </View>
                <View style={styles.editorialCardButton}>
                  <Text style={styles.editorialCardButtonText}>{card.button}</Text>
                </View>
              </Pressable>
            ))}
      </View>

      <View style={styles.panel}>
        <SectionHeader
          title="What is moving for you"
          subtitle="Live request history with the next action kept obvious."
        />
        {requests.length === 0 ? (
          <View style={styles.requestStarterGrid}>
            {requestStarterCards.map((card) => (
              <Pressable
                key={card.id}
                style={styles.requestStarterCard}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/workbench",
                    params: card.params,
                  } as never)
                }
              >
                <Text style={styles.requestStarterTitle}>{card.title}</Text>
                <Text style={styles.requestStarterCaption}>{card.caption}</Text>
                <Text style={styles.requestStarterLink}>Open request flow</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.requestTimeline}>
            {requests.slice(0, 3).map((request, index) => (
              <Pressable
                key={request.id}
                style={styles.requestTimelineCard}
                onPress={() => router.push("/(tabs)/workbench")}
              >
                <View style={styles.requestTimelineMarkerWrap}>
                  <View style={styles.requestTimelineMarker} />
                  {index < Math.min(requests.length, 3) - 1 ? (
                    <View style={styles.requestTimelineLine} />
                  ) : null}
                </View>
                <View
                  style={[
                    styles.requestTimelineBody,
                    index === 0 ? styles.requestTimelineBodyLead : null,
                  ]}
                >
                  <View style={styles.requestTimelineTop}>
                    <Text style={styles.requestTimelineTitle}>
                      {request.requestedServiceName}
                    </Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>
                        {formatRequestStatus(request.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.requestTimelineMeta}>
                    {request.city}
                    {request.stateCode ? `, ${request.stateCode}` : ""} · Updated{" "}
                    {formatDateLabel(request.updatedAt)}
                  </Text>
                  <Text style={styles.requestTimelineBodyText} numberOfLines={3}>
                    {request.description}
                  </Text>
                  <View style={styles.requestTimelineFooter}>
                    <Text style={styles.requestTimelineCount}>
                      {request.matches.length} {request.matches.length === 1 ? "match" : "matches"}
                    </Text>
                    <Text style={styles.requestTimelineLink}>Open quotes</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {isLoading ? <Text style={styles.loadingText}>Refreshing your BookMiz feed…</Text> : null}
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
  heroBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroBrandMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroBrandLogo: {
    width: 18,
    height: 18,
    resizeMode: "contain",
  },
  heroBrandTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  heroLocationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroLocationChipText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  heroEditorialCard: {
    borderRadius: tokens.radius.lg,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 18,
    gap: 14,
  },
  heroEditorialEyebrow: {
    color: tokens.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  heroEditorialTitle: {
    color: "#fff",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  heroEditorialBody: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    lineHeight: 22,
  },
  heroActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroPrimaryAction: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  heroPrimaryActionText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  heroSecondaryAction: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  heroSecondaryActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  heroMetricRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroMetricChip: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroMetricChipValue: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  heroMetricChipLabel: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  panel: {
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
    gap: 14,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    width: "48%",
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 12,
  },
  actionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.brand,
  },
  actionTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  actionCaption: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  collectionRail: {
    gap: 14,
    paddingRight: 8,
  },
  collectionCard: {
    width: 236,
    height: 280,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: tokens.colors.ink,
  },
  collectionImage: {
    width: "100%",
    height: "100%",
  },
  collectionOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(10,22,44,0.36)",
  },
  collectionBody: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    gap: 6,
  },
  collectionEyebrow: {
    color: tokens.colors.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  collectionTitle: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  collectionSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 19,
  },
  featuredStack: {
    gap: 14,
  },
  savedPreviewBar: {
    borderRadius: tokens.radius.lg,
    backgroundColor: "#f9fbff",
    borderWidth: 1,
    borderColor: "#d7e0ec",
    padding: 16,
    gap: 12,
  },
  savedPreviewCopy: {
    gap: 6,
  },
  savedPreviewTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  savedPreviewCaption: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  savedPreviewButton: {
    alignSelf: "flex-start",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  savedPreviewButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  featuredLeadCard: {
    height: 320,
    borderRadius: tokens.radius.lg,
    overflow: "hidden",
    backgroundColor: tokens.colors.ink,
  },
  featuredLeadImage: {
    width: "100%",
    height: "100%",
  },
  featuredLeadOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(12,29,54,0.34)",
  },
  featuredLeadBody: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    gap: 6,
  },
  featuredLeadEyebrow: {
    color: tokens.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  featuredLeadTitle: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: -0.9,
  },
  featuredLeadMeta: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    lineHeight: 18,
  },
  featuredLeadSummary: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 14,
    lineHeight: 21,
  },
  featuredLeadFooter: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  featuredLeadStat: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  featuredLeadSubstat: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 2,
  },
  featuredLeadButton: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  featuredLeadButtonText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  featuredMiniGrid: {
    gap: 12,
  },
  featuredMiniCard: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 8,
  },
  featuredMiniEyebrow: {
    color: tokens.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  featuredMiniTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  featuredMiniMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  featuredMiniFooter: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featuredMiniDistance: {
    color: tokens.colors.brandDeep,
    fontSize: 12,
    fontWeight: "800",
  },
  requestTimeline: {
    gap: 14,
  },
  requestTimelineCard: {
    flexDirection: "row",
    gap: 14,
  },
  requestTimelineMarkerWrap: {
    width: 18,
    alignItems: "center",
  },
  requestTimelineMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.colors.brand,
    marginTop: 6,
  },
  requestTimelineLine: {
    flex: 1,
    width: 2,
    marginTop: 8,
    backgroundColor: "#dfe7f2",
  },
  requestTimelineBody: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 8,
  },
  requestTimelineBodyLead: {
    backgroundColor: "#fbfcff",
    borderColor: "#cfd8e6",
  },
  requestTimelineTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  requestTimelineTitle: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  requestTimelineMeta: {
    color: tokens.colors.brandDeep,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  requestTimelineBodyText: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  requestTimelineFooter: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  requestTimelineCount: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  requestTimelineLink: {
    color: tokens.colors.brandDeep,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statusBadge: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#ecf8d1",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusText: {
    color: tokens.colors.ink,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  emptyText: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  editorialCard: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 14,
  },
  editorialCardCopy: {
    gap: 6,
  },
  editorialCardTitle: {
    color: tokens.colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  editorialCardCaption: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  editorialCardButton: {
    alignSelf: "flex-start",
    borderRadius: tokens.radius.pill,
    backgroundColor: "#eef5df",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  editorialCardButtonText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  requestStarterGrid: {
    gap: 12,
  },
  requestStarterCard: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 8,
  },
  requestStarterTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  requestStarterCaption: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  requestStarterLink: {
    color: tokens.colors.brandDeep,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  errorText: {
    color: "#d44c3f",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  loadingText: {
    color: tokens.colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
});

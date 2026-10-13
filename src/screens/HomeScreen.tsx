import { useFocusEffect } from "expo-router/react-navigation";
import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { priceLineFor } from "@/src/components/marketplace/ProviderCard";
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
  formatMarketplacePrice,
  getMarketplaceLocationLabel,
  getProviderHeroImage,
} from "@/src/lib/marketplace-display";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

type IconName = React.ComponentProps<typeof FontAwesome6>["name"];

const quickActions: Array<{ id: string; label: string; icon: IconName; route: string }> = [
  { id: "book", label: "Book", icon: "calendar-plus", route: "/(tabs)/explore" },
  { id: "quote", label: "Get quote", icon: "comment-dollar", route: "/(tabs)/workbench" },
  { id: "bookings", label: "Bookings", icon: "clock", route: "/appointments" },
  { id: "saved", label: "Saved", icon: "heart", route: "/saved-providers" },
];

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatRelativeDay(value: string) {
  const start = new Date(value);
  const now = new Date();
  const dayMs = 86_400_000;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((startDay - today) / dayMs);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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

function initialsFor(firstName?: string | null, lastName?: string | null, email?: string) {
  const letters = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return letters || (email ?? "B").slice(0, 2).toUpperCase();
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
  const [searchTerm, setSearchTerm] = useState("");

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
      setError(getFriendlyApiError(nextError, "We could not load your home feed right now."));
    } finally {
      setIsLoading(false);
    }
  }, [session.user]);

  useFocusEffect(
    useCallback(() => {
      void loadHomeData();
    }, [loadHomeData]),
  );

  const firstName = session.user?.firstName ?? "there";
  const city = session.profile?.city ?? session.user?.city ?? null;
  const defaultLocationQuery = session.profile?.city
    ? session.profile?.stateCode
      ? `${session.profile.city}, ${session.profile.stateCode}`
      : session.profile.city
    : undefined;

  const nextBooking = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter(
        (booking) =>
          booking.status !== "CANCELLED" &&
          booking.status !== "COMPLETED" &&
          new Date(booking.endsAt).getTime() >= now,
      )
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  }, [bookings]);

  const activeRequests = useMemo(
    () => requests.filter((request) => request.status === "OPEN" || request.status === "MATCHED"),
    [requests],
  );

  const nearby = bookmarks.length > 0 ? bookmarks : featuredProviders;
  const lead = nearby[0];
  const rest = nearby.slice(1, 4);

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
          locationQuery: params?.locationQuery ?? defaultLocationQuery,
        },
      } as never);
    },
    [defaultLocationQuery, router],
  );

  const openProvider = useCallback(
    (slug: string) => router.push(`/providers/${slug}` as never),
    [router],
  );

  function submitSearch() {
    const term = searchTerm.trim();
    openExplore({ serviceModel: "LOCAL", query: term || undefined });
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => void loadHomeData()} tintColor={tokens.colors.inkDeep} />
          }
        >
          <View style={styles.topRow}>
            <Pressable
              onPress={() => router.push("/(tabs)/account" as never)}
              accessibilityRole="button"
              accessibilityLabel="Account"
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {initialsFor(session.user?.firstName, session.user?.lastName, session.user?.email)}
              </Text>
            </Pressable>
            <View style={styles.greeting}>
              <Text style={styles.greetingSmall}>{greetingFor(new Date())}</Text>
              <Text style={styles.greetingName} numberOfLines={1}>
                {firstName}
              </Text>
            </View>
            {city ? (
              <Pressable
                onPress={() => router.push("/(tabs)/account" as never)}
                accessibilityRole="button"
                style={styles.cityChip}
              >
                <FontAwesome6 name="location-dot" size={12} color={tokens.colors.ink} />
                <Text style={styles.cityChipText} numberOfLines={1}>
                  {city}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push("/(tabs)/inbox" as never)}
              accessibilityRole="button"
              accessibilityLabel="Inbox"
              style={styles.iconButton}
            >
              <FontAwesome6 name="bell" size={17} color={tokens.colors.ink} />
            </Pressable>
          </View>

          <View style={styles.searchShell}>
            <FontAwesome6 name="magnifying-glass" size={16} color={tokens.colors.muted} />
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              onSubmitEditing={submitSearch}
              returnKeyType="search"
              placeholder="Haircut, nails, massage…"
              placeholderTextColor={tokens.colors.muted}
              accessibilityLabel="Search services"
              style={styles.searchInput}
            />
          </View>

          {nextBooking ? (
            <Pressable
              onPress={() => router.push(`/appointments/${nextBooking.id}` as never)}
              accessibilityRole="button"
              style={styles.nextCard}
            >
              <View style={styles.nextHeader}>
                <Text style={styles.nextEyebrow}>Next appointment</Text>
                <Text style={styles.nextWhen}>{formatRelativeDay(nextBooking.startsAt)}</Text>
              </View>
              <View style={styles.nextRow}>
                <View style={styles.nextDate}>
                  <Text style={styles.nextDateDay}>
                    {new Date(nextBooking.startsAt).toLocaleDateString(undefined, { weekday: "short" })}
                  </Text>
                  <Text style={styles.nextDateNum}>{new Date(nextBooking.startsAt).getDate()}</Text>
                </View>
                <View style={styles.nextBody}>
                  <Text style={styles.nextTitle} numberOfLines={1}>
                    {nextBooking.service.name}
                  </Text>
                  <Text style={styles.nextMeta} numberOfLines={1}>
                    {nextBooking.provider.displayName} · {formatTime(nextBooking.startsAt)}
                    {nextBooking.assignedStaff
                      ? ` · ${nextBooking.assignedStaff.displayName ?? nextBooking.assignedStaff.firstName}`
                      : ""}
                  </Text>
                </View>
                <FontAwesome6 name="chevron-right" size={14} color="#ffffff" />
              </View>
              <View style={styles.nextActions}>
                <Pressable
                  onPress={() => router.push(`/appointments/${nextBooking.id}` as never)}
                  style={styles.nextPrimary}
                  accessibilityRole="button"
                >
                  <Text style={styles.nextPrimaryText}>View details</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/appointments" as never)}
                  style={styles.nextSecondary}
                  accessibilityRole="button"
                >
                  <Text style={styles.nextSecondaryText}>All bookings</Text>
                </Pressable>
              </View>
            </Pressable>
          ) : null}

          <View style={styles.actionRow}>
            {quickActions.map((action) => (
              <Pressable
                key={action.id}
                onPress={() => router.push(action.route as never)}
                accessibilityRole="button"
                style={styles.action}
              >
                <View style={styles.actionIcon}>
                  <FontAwesome6 name={action.icon} size={20} color={tokens.colors.inkDeep} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          {categories.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Browse" actionLabel="See all" onAction={() => openExplore({ serviceModel: "LOCAL" })} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRail}
                style={styles.chipRailScroll}
              >
                {categories.map((category) => (
                  <Pressable
                    key={category.id}
                    onPress={() =>
                      openExplore({
                        categorySlug: category.slug,
                        serviceModel: category.serviceModel === "PROFESSIONAL" ? "PROFESSIONAL" : "LOCAL",
                      })
                    }
                    accessibilityRole="button"
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{category.name}</Text>
                    <Text style={styles.chipCount}>{category.stats.providerCount}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader
              title={bookmarks.length > 0 ? "Saved" : "Near you"}
              actionLabel={bookmarks.length > 0 ? "See all" : "Explore"}
              onAction={() =>
                bookmarks.length > 0 ? router.push("/saved-providers") : openExplore({ serviceModel: "LOCAL" })
              }
            />

            {lead ? (
              <Pressable onPress={() => openProvider(lead.slug)} accessibilityRole="button" style={styles.leadCard}>
                <View style={styles.leadImageWrap}>
                  <Image source={getProviderHeroImage(lead)} style={styles.leadImage} />
                  {lead.badges.onlineBooking ? (
                    <View style={styles.leadBadge}>
                      <Text style={styles.leadBadgeText}>Books online</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.leadBody}>
                  <View style={styles.leadTitleRow}>
                    <Text style={styles.leadTitle} numberOfLines={1}>
                      {lead.displayName}
                    </Text>
                    <Text style={styles.leadRating}>
                      {lead.averageRating ? `★ ${lead.averageRating.toFixed(1)}` : "New"}
                      {lead.reviewCount > 0 ? <Text style={styles.leadRatingCount}> ({lead.reviewCount})</Text> : null}
                    </Text>
                  </View>
                  <Text style={styles.leadMeta} numberOfLines={1}>
                    {[lead.businessCategory, getMarketplaceLocationLabel(lead.primaryLocation), formatMarketplaceDistance(lead.distanceMiles)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  {lead.topServices.length > 0 ? (
                    <View style={styles.servicePills}>
                      {lead.topServices.filter((service) => service.priceCents > 0).slice(0, 2).map((service) => (
                        <View key={service.id} style={styles.servicePill}>
                          <Text style={styles.servicePillText}>
                            {service.name} {formatMarketplacePrice(service.priceCents)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ) : !isLoading ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No providers nearby yet</Text>
                <Text style={styles.emptyBody}>Search for a service or set your city in Account.</Text>
              </View>
            ) : null}

            {rest.map((provider) => (
              <Pressable
                key={provider.id}
                onPress={() => openProvider(provider.slug)}
                accessibilityRole="button"
                style={styles.rowCard}
              >
                <Image source={getProviderHeroImage(provider)} style={styles.rowImage} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTitleRow}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {provider.displayName}
                    </Text>
                    <Text style={styles.rowRating}>
                      {provider.averageRating ? `★ ${provider.averageRating.toFixed(1)}` : "New"}
                    </Text>
                  </View>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {[provider.businessCategory, getMarketplaceLocationLabel(provider.primaryLocation), formatMarketplaceDistance(provider.distanceMiles)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  <Text style={styles.rowPrice} numberOfLines={1}>
                    {priceLineFor(provider)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {activeRequests.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Your requests"
                actionLabel="See all"
                onAction={() => router.push("/(tabs)/workbench" as never)}
              />
              {activeRequests.slice(0, 3).map((request) => (
                <Pressable
                  key={request.id}
                  onPress={() => router.push("/(tabs)/workbench" as never)}
                  accessibilityRole="button"
                  style={styles.requestCard}
                >
                  <View style={styles.requestBody}>
                    <Text style={styles.requestTitle} numberOfLines={1}>
                      {request.requestedServiceName}
                    </Text>
                    <Text style={styles.requestMeta} numberOfLines={1}>
                      {request.matches.length} {request.matches.length === 1 ? "reply" : "replies"} ·{" "}
                      {request.city}
                      {request.stateCode ? `, ${request.stateCode}` : ""}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, request.status === "MATCHED" ? styles.statusPillMatched : null]}>
                    <Text style={[styles.statusText, request.status === "MATCHED" ? styles.statusTextMatched : null]}>
                      {formatRequestStatus(request.status)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText} accessibilityRole="alert">
                {error}
              </Text>
              <Pressable onPress={() => void loadHomeData()} accessibilityRole="button">
                <Text style={styles.errorRetry}>Try again</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 22,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.inkDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: tokens.font.bold,
  },
  greeting: {
    flex: 1,
    minWidth: 0,
  },
  greetingSmall: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.semibold,
  },
  greetingName: {
    color: tokens.colors.ink,
    fontSize: 20,
    fontFamily: tokens.font.display,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  cityChip: {
    height: 36,
    maxWidth: 120,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
  },
  cityChipText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontFamily: tokens.font.semibold,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  searchShell: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
  },
  searchInput: {
    flex: 1,
    height: 50,
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.regular,
  },
  nextCard: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.inkDeep,
    padding: 18,
    gap: 12,
  },
  nextHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nextEyebrow: {
    color: tokens.colors.brand,
    fontSize: 12,
    fontFamily: tokens.font.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  nextWhen: {
    color: tokens.colors.onNavyMuted,
    fontSize: 12,
    fontFamily: tokens.font.semibold,
  },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nextDate: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: tokens.colors.navySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  nextDateDay: {
    color: tokens.colors.onNavyMuted,
    fontSize: 10,
    fontFamily: tokens.font.bold,
    textTransform: "uppercase",
  },
  nextDateNum: {
    color: "#ffffff",
    fontSize: 20,
    fontFamily: tokens.font.display,
    lineHeight: 22,
  },
  nextBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nextTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: tokens.font.bold,
  },
  nextMeta: {
    color: tokens.colors.onNavyMuted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  nextActions: {
    flexDirection: "row",
    gap: 8,
  },
  nextPrimary: {
    flex: 1,
    height: 40,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  nextPrimaryText: {
    color: tokens.colors.inkDeep,
    fontSize: 14,
    fontFamily: tokens.font.bold,
  },
  nextSecondary: {
    flex: 1,
    height: 40,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  nextSecondaryText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  action: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontFamily: tokens.font.semibold,
  },
  section: {
    gap: 12,
  },
  chipRailScroll: {
    marginHorizontal: -20,
  },
  chipRail: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  chipCount: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontFamily: tokens.font.semibold,
  },
  leadCard: {
    borderRadius: tokens.radius.lg,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: "hidden",
  },
  leadImageWrap: {
    height: 150,
    backgroundColor: tokens.colors.navySoft,
  },
  leadImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  leadBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  leadBadgeText: {
    color: tokens.colors.inkDeep,
    fontSize: 12,
    fontFamily: tokens.font.bold,
  },
  leadBody: {
    padding: 16,
    gap: 6,
  },
  leadTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  leadTitle: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.display,
  },
  leadRating: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.bold,
  },
  leadRatingCount: {
    color: tokens.colors.muted,
    fontFamily: tokens.font.medium,
  },
  leadMeta: {
    color: tokens.colors.muted,
    fontSize: 14,
    fontFamily: tokens.font.regular,
  },
  servicePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  servicePill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#eef2f8",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  servicePillText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontFamily: tokens.font.semibold,
  },
  rowCard: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  rowImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: tokens.colors.border,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    justifyContent: "center",
  },
  rowTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.bold,
  },
  rowRating: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontFamily: tokens.font.bold,
  },
  rowMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  rowPrice: {
    color: tokens.colors.success,
    fontSize: 13,
    fontFamily: tokens.font.semibold,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: 20,
    alignItems: "center",
    gap: 4,
  },
  emptyTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.display,
  },
  emptyBody: {
    color: tokens.colors.muted,
    fontSize: 14,
    fontFamily: tokens.font.regular,
    textAlign: "center",
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  requestBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  requestTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.bold,
  },
  requestMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  statusPill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#eef2f8",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillMatched: {
    backgroundColor: tokens.colors.brandSoft,
  },
  statusText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontFamily: tokens.font.bold,
  },
  statusTextMatched: {
    color: tokens.colors.brandDeep,
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
    fontFamily: tokens.font.regular,
    lineHeight: 20,
  },
  errorRetry: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.bold,
  },
});

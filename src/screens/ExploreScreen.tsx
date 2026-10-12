import { FontAwesome6 } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SectionHeader } from "@/src/components/SectionHeader";
import { Screen } from "@/src/components/Screen";
import { ProviderCard } from "@/src/components/marketplace/ProviderCard";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import {
  bookmarkMarketplaceProvider,
  listCategoryDiscovery,
  listCustomerBookmarkedProviders,
  removeMarketplaceProviderBookmark,
  searchProviders,
} from "@/src/lib/api/marketplace";
import {
  ApiRequestError,
  type MarketplaceSearchResponse,
  type MarketplaceSearchServiceModel,
  type MarketplaceSort,
  MarketplaceCategoryDiscovery,
  MarketplaceProviderCard,
} from "@/src/lib/api/types";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

const serviceModelOptions: Array<{
  value: MarketplaceSearchServiceModel;
  label: string;
}> = [
  { value: "LOCAL", label: "Local services" },
  { value: "PROFESSIONAL", label: "Professional appointments" },
];

const sortOptions: Array<{ value: MarketplaceSort; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Top rated" },
  { value: "price-low", label: "Low to high" },
  { value: "price-high", label: "High to low" },
  { value: "distance", label: "Closest first" },
];

const PAGE_SIZE = 8;
const MIN_LOCATION_RESULTS = 6;

const usStateLookup: Record<string, string> = {
  AL: "AL",
  ALABAMA: "AL",
  AK: "AK",
  ALASKA: "AK",
  AZ: "AZ",
  ARIZONA: "AZ",
  AR: "AR",
  ARKANSAS: "AR",
  CA: "CA",
  CALIFORNIA: "CA",
  CO: "CO",
  COLORADO: "CO",
  CT: "CT",
  CONNECTICUT: "CT",
  DE: "DE",
  DELAWARE: "DE",
  FL: "FL",
  FLORIDA: "FL",
  GA: "GA",
  GEORGIA: "GA",
  HI: "HI",
  HAWAII: "HI",
  ID: "ID",
  IDAHO: "ID",
  IL: "IL",
  ILLINOIS: "IL",
  IN: "IN",
  INDIANA: "IN",
  IA: "IA",
  IOWA: "IA",
  KS: "KS",
  KANSAS: "KS",
  KY: "KY",
  KENTUCKY: "KY",
  LA: "LA",
  LOUISIANA: "LA",
  ME: "ME",
  MAINE: "ME",
  MD: "MD",
  MARYLAND: "MD",
  MA: "MA",
  MASSACHUSETTS: "MA",
  MI: "MI",
  MICHIGAN: "MI",
  MN: "MN",
  MINNESOTA: "MN",
  MS: "MS",
  MISSISSIPPI: "MS",
  MO: "MO",
  MISSOURI: "MO",
  MT: "MT",
  MONTANA: "MT",
  NE: "NE",
  NEBRASKA: "NE",
  NV: "NV",
  NEVADA: "NV",
  NH: "NH",
  NEW_HAMPSHIRE: "NH",
  "NEW HAMPSHIRE": "NH",
  NJ: "NJ",
  NEW_JERSEY: "NJ",
  "NEW JERSEY": "NJ",
  NM: "NM",
  NEW_MEXICO: "NM",
  "NEW MEXICO": "NM",
  NY: "NY",
  NEW_YORK: "NY",
  "NEW YORK": "NY",
  NC: "NC",
  NORTH_CAROLINA: "NC",
  "NORTH CAROLINA": "NC",
  ND: "ND",
  NORTH_DAKOTA: "ND",
  "NORTH DAKOTA": "ND",
  OH: "OH",
  OHIO: "OH",
  OK: "OK",
  OKLAHOMA: "OK",
  OR: "OR",
  OREGON: "OR",
  PA: "PA",
  PENNSYLVANIA: "PA",
  RI: "RI",
  RHODE_ISLAND: "RI",
  "RHODE ISLAND": "RI",
  SC: "SC",
  SOUTH_CAROLINA: "SC",
  "SOUTH CAROLINA": "SC",
  SD: "SD",
  SOUTH_DAKOTA: "SD",
  "SOUTH DAKOTA": "SD",
  TN: "TN",
  TENNESSEE: "TN",
  TX: "TX",
  TEXAS: "TX",
  UT: "UT",
  UTAH: "UT",
  VT: "VT",
  VERMONT: "VT",
  VA: "VA",
  VIRGINIA: "VA",
  WA: "WA",
  WASHINGTON: "WA",
  WV: "WV",
  WEST_VIRGINIA: "WV",
  "WEST VIRGINIA": "WV",
  WI: "WI",
  WISCONSIN: "WI",
  WY: "WY",
  WYOMING: "WY",
  DC: "DC",
  DISTRICT_OF_COLUMBIA: "DC",
  "DISTRICT OF COLUMBIA": "DC",
};

type ExploreFetchResult = {
  response: MarketplaceSearchResponse;
  broadened: boolean;
  note: string | null;
};

function normalizeLocation(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isUnexpectedPropertyError(error: unknown) {
  if (error instanceof ApiRequestError) {
    const detailMessage = error.details?.map((item) => item.message).join(" ") ?? "";
    return /property .* should not exist/i.test(detailMessage || error.message);
  }

  if (error instanceof Error) {
    return /property .* should not exist/i.test(error.message);
  }

  return false;
}

async function runMarketplaceSearch(
  params: Parameters<typeof searchProviders>[0],
) {
  const attempts: Array<Parameters<typeof searchProviders>[0]> = [
    params,
    {
      query: params?.query,
      categorySlug: undefined,
      serviceModel: params?.serviceModel,
      locationQuery: params?.locationQuery,
      city: params?.city,
      stateCode: params?.stateCode,
      latitude: params?.latitude,
      longitude: params?.longitude,
      radiusMiles: params?.radiusMiles,
      sort: params?.sort,
      page: params?.page,
      pageSize: params?.pageSize,
    },
    {
      query: params?.query,
      serviceModel: params?.serviceModel,
      locationQuery: params?.locationQuery,
      city: params?.city,
      stateCode: params?.stateCode,
      latitude: params?.latitude,
      longitude: params?.longitude,
      radiusMiles: params?.radiusMiles,
      page: params?.page,
      pageSize: params?.pageSize,
    },
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      return await searchProviders(attempt);
    } catch (error) {
      lastError = error;

      if (!isUnexpectedPropertyError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function dedupeProviders(providers: MarketplaceProviderCard[]) {
  const seen = new Set<string>();

  return providers.filter((provider) => {
    if (seen.has(provider.id)) {
      return false;
    }

    seen.add(provider.id);
    return true;
  });
}

function dedupeFilterChips(chips: MarketplaceSearchResponse["filterChips"]) {
  const seen = new Set<string>();

  return chips.filter((chip) => {
    if (seen.has(chip.label.toLowerCase())) {
      return false;
    }

    seen.add(chip.label.toLowerCase());
    return true;
  });
}

function dedupeMapPins(
  pins: Array<{
    id: string;
    slug: string;
    displayName: string;
    latitude: number | null;
    longitude: number | null;
    addressLabel: string;
  }>,
) {
  const seen = new Set<string>();

  return pins.filter((pin) => {
    if (seen.has(pin.id)) {
      return false;
    }

    seen.add(pin.id);
    return true;
  });
}

function deriveStateCode(location: string, fallbackStateCode?: string | null) {
  const normalized = location
    .trim()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();

  if (normalized) {
    const tokens = normalized.split(" ");
    const trailingToken = tokens.at(-1);

    if (trailingToken && usStateLookup[trailingToken]) {
      return usStateLookup[trailingToken];
    }

    for (let index = 0; index < tokens.length; index += 1) {
      const single = tokens[index];
      const pair = tokens.slice(index, index + 2).join(" ");
      const triple = tokens.slice(index, index + 3).join(" ");

      if (usStateLookup[triple]) {
        return usStateLookup[triple];
      }

      if (usStateLookup[pair]) {
        return usStateLookup[pair];
      }

      if (usStateLookup[single]) {
        return usStateLookup[single];
      }
    }
  }

  return fallbackStateCode?.toUpperCase() ?? undefined;
}

function mergeMarketplaceResponses(
  exactResponse: MarketplaceSearchResponse,
  stateResponse?: MarketplaceSearchResponse | null,
  broaderResponse?: MarketplaceSearchResponse | null,
) {
  const mergedResults = dedupeProviders([
    ...exactResponse.results,
    ...(stateResponse?.results ?? []),
    ...(broaderResponse?.results ?? []),
  ]);
  const mergedFeatured = dedupeProviders([
    ...exactResponse.featuredProviders,
    ...(stateResponse?.featuredProviders ?? []),
    ...(broaderResponse?.featuredProviders ?? []),
  ]);
  const primaryResponse =
    exactResponse.results.length > 0
      ? exactResponse
      : stateResponse?.results.length
        ? stateResponse
        : broaderResponse ?? exactResponse;

  return {
    ...primaryResponse,
    query: {
      ...primaryResponse.query,
      locationLabel:
        exactResponse.query.locationLabel ??
        stateResponse?.query.locationLabel ??
        broaderResponse?.query.locationLabel ??
        null,
    },
    categories:
      exactResponse.categories.length > 0
        ? exactResponse.categories
        : stateResponse?.categories.length
          ? stateResponse.categories
          : broaderResponse?.categories ?? [],
    featuredProviders: mergedFeatured.slice(0, 6),
    filterChips: dedupeFilterChips([
      ...exactResponse.filterChips,
      ...(stateResponse?.filterChips ?? []),
      ...(broaderResponse?.filterChips ?? []),
    ]),
    results: mergedResults,
    pagination: {
      page: 1,
      pageSize: mergedResults.length || PAGE_SIZE,
      total: mergedResults.length,
      totalPages: 1,
    },
    popularTreatments:
      exactResponse.popularTreatments.length > 0
        ? exactResponse.popularTreatments
        : stateResponse?.popularTreatments.length
          ? stateResponse.popularTreatments
          : broaderResponse?.popularTreatments ?? [],
    mapPins: dedupeMapPins([
      ...(exactResponse.mapPins ?? []),
      ...(stateResponse?.mapPins ?? []),
      ...(broaderResponse?.mapPins ?? []),
    ]),
  } satisfies MarketplaceSearchResponse;
}

async function searchProvidersWithPriority(options: {
  query?: string;
  categorySlug?: string;
  serviceModel: MarketplaceSearchServiceModel;
  locationQuery?: string;
  stateCode?: string;
  sort: MarketplaceSort;
}) {
  const exactResponse = await runMarketplaceSearch({
    query: options.query,
    categorySlug: options.categorySlug,
    serviceModel: options.serviceModel,
    locationQuery: options.locationQuery,
    sort: options.sort,
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const exactCount = exactResponse.results.length;
  const normalizedLocation = options.locationQuery ? normalizeLocation(options.locationQuery) : "";

  if (!normalizedLocation || exactCount >= MIN_LOCATION_RESULTS) {
    return {
      response: exactResponse,
      broadened: false,
      note: null,
    } satisfies ExploreFetchResult;
  }

  const stateCode = options.stateCode ?? deriveStateCode(normalizedLocation);
  const needsBroaderResults = exactCount < MIN_LOCATION_RESULTS;

  let stateResponse: MarketplaceSearchResponse | null = null;
  let broaderResponse: MarketplaceSearchResponse | null = null;

  if (needsBroaderResults && stateCode) {
    stateResponse = await runMarketplaceSearch({
      query: options.query,
      categorySlug: options.categorySlug,
      serviceModel: options.serviceModel,
      stateCode,
      sort: options.sort,
      page: 1,
      pageSize: PAGE_SIZE,
    });
  }

  const combinedCount = dedupeProviders([
    ...exactResponse.results,
    ...(stateResponse?.results ?? []),
  ]).length;

  if (combinedCount < MIN_LOCATION_RESULTS) {
    broaderResponse = await runMarketplaceSearch({
      query: options.query,
      categorySlug: options.categorySlug,
      serviceModel: options.serviceModel,
      sort: options.sort,
      page: 1,
      pageSize: PAGE_SIZE,
    });
  }

  if (!stateResponse && !broaderResponse) {
    return {
      response: exactResponse,
      broadened: false,
      note: null,
    } satisfies ExploreFetchResult;
  }

  const mergedResponse = mergeMarketplaceResponses(
    exactResponse,
    stateResponse,
    broaderResponse,
  );
  const note =
    exactCount > 0
      ? `Showing ${normalizedLocation} first, then broader BookMiz matches${stateCode ? ` across ${stateCode} and beyond` : ""}.`
      : `No exact matches in ${normalizedLocation} yet. Showing broader BookMiz matches${stateCode ? ` across ${stateCode} and beyond` : ""}.`;

  return {
    response: mergedResponse,
    broadened: true,
    note,
  } satisfies ExploreFetchResult;
}

function getInitialServiceModel(value?: string): MarketplaceSearchServiceModel {
  return value === "PROFESSIONAL" ? "PROFESSIONAL" : "LOCAL";
}

function getInitialSort(value?: string): MarketplaceSort {
  return sortOptions.some((option) => option.value === value)
    ? (value as MarketplaceSort)
    : "recommended";
}

function getExploreErrorMessage(error: unknown) {
  const message = getFriendlyApiError(
    error,
    "We could not load the marketplace right now.",
  );

  if (/property .* should not exist/i.test(message)) {
    return "We couldn’t apply one of those filters. Reset the search and try again.";
  }

  return message;
}

export function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    query?: string;
    categorySlug?: string;
    serviceModel?: string;
    locationQuery?: string;
    sort?: string;
  }>();
  const session = useSession();

  const [draftQuery, setDraftQuery] = useState(params.query ?? "");
  const [draftLocation, setDraftLocation] = useState(params.locationQuery ?? "");
  const [appliedQuery, setAppliedQuery] = useState(params.query ?? "");
  const [appliedLocation, setAppliedLocation] = useState(params.locationQuery ?? "");
  const [serviceModel, setServiceModel] = useState<MarketplaceSearchServiceModel>(
    getInitialServiceModel(params.serviceModel),
  );
  const [sort, setSort] = useState<MarketplaceSort>(getInitialSort(params.sort));
  const [activeCategory, setActiveCategory] = useState<string | undefined>(
    params.categorySlug,
  );
  const [categories, setCategories] = useState<MarketplaceCategoryDiscovery[]>([]);
  const [searchData, setSearchData] = useState<Awaited<
    ReturnType<typeof searchProviders>
  > | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);
  const [didBroadenResults, setDidBroadenResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequestRef = useRef(0);
  const searchDataRef = useRef<Awaited<ReturnType<typeof searchProviders>> | null>(null);
  const didBroadenResultsRef = useRef(false);

  useEffect(() => {
    setDraftQuery(params.query ?? "");
    setDraftLocation(params.locationQuery ?? "");
    setAppliedQuery(params.query ?? "");
    setAppliedLocation(params.locationQuery ?? "");
    setActiveCategory(params.categorySlug);
    setServiceModel(getInitialServiceModel(params.serviceModel));
    setSort(getInitialSort(params.sort));
  }, [
    params.categorySlug,
    params.locationQuery,
    params.query,
    params.serviceModel,
    params.sort,
  ]);

  useEffect(() => {
    searchDataRef.current = searchData;
  }, [searchData]);

  useEffect(() => {
    didBroadenResultsRef.current = didBroadenResults;
  }, [didBroadenResults]);

  const fetchExplore = useCallback(
    async (page = 1, append = false) => {
      const requestId = latestRequestRef.current + 1;
      latestRequestRef.current = requestId;

      try {
        if (requestId === latestRequestRef.current) {
          setError(null);
          if (append) {
            setIsLoadingMore(true);
          } else {
            setIsLoading(true);
          }
        }

        const normalizedLocation = normalizeLocation(appliedLocation);
        const stateCode = deriveStateCode(
          normalizedLocation,
          session.profile?.stateCode ?? session.user?.stateCode ?? null,
        );
        const [categoriesResult, marketplaceResult, bookmarksResult] = await Promise.allSettled([
          listCategoryDiscovery(serviceModel),
          append && searchDataRef.current && !didBroadenResultsRef.current
            ? runMarketplaceSearch({
                query: appliedQuery.trim() || undefined,
                categorySlug: activeCategory,
                serviceModel,
                locationQuery: normalizedLocation || undefined,
                sort,
                page,
                pageSize: PAGE_SIZE,
              })
            : searchProvidersWithPriority({
                query: appliedQuery.trim() || undefined,
                categorySlug: activeCategory,
                serviceModel,
                locationQuery: normalizedLocation || undefined,
                stateCode,
                sort,
              }),
          session.isSignedIn
            ? listCustomerBookmarkedProviders()
            : Promise.resolve([] as MarketplaceProviderCard[]),
        ]);

        if (marketplaceResult.status !== "fulfilled") {
          throw marketplaceResult.reason;
        }

        const nextCategories =
          categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
        const bookmarks =
          bookmarksResult.status === "fulfilled" ? bookmarksResult.value : [];
        const marketplace =
          "response" in marketplaceResult.value
            ? marketplaceResult.value.response
            : marketplaceResult.value;
        const nextFallbackNote =
          "note" in marketplaceResult.value ? marketplaceResult.value.note : null;
        const nextDidBroadenResults =
          "broadened" in marketplaceResult.value
            ? marketplaceResult.value.broadened
            : false;

        if (requestId !== latestRequestRef.current) {
          return;
        }

        setCategories(nextCategories);
        setSearchData((current) =>
          append && current
            ? {
                ...marketplace,
                results: [...current.results, ...marketplace.results],
              }
            : marketplace,
        );
        setBookmarkedIds(bookmarks.map((provider) => provider.id));
        setFallbackNote(nextFallbackNote);
        setDidBroadenResults(nextDidBroadenResults);
      } catch (nextError) {
        if (requestId !== latestRequestRef.current) {
          return;
        }

        const normalizedLocation = normalizeLocation(appliedLocation);
        const stateCode = deriveStateCode(
          normalizedLocation,
          session.profile?.stateCode ?? session.user?.stateCode ?? null,
        );

        if (__DEV__) {
          console.warn("[bookmiz-mobile] marketplace search failed", nextError);
        }

        try {
          const recoverySearch = await searchProvidersWithPriority({
            serviceModel,
            locationQuery: normalizedLocation || undefined,
            stateCode,
            sort: "recommended",
          });

          if (requestId !== latestRequestRef.current) {
            return;
          }

          setSearchData(recoverySearch.response);
          setFallbackNote(
            recoverySearch.note ??
              "We reset incompatible filters and showed live BookMiz matches instead.",
          );
          setDidBroadenResults(recoverySearch.broadened);
          setError(null);
        } catch (recoveryError) {
          if (__DEV__) {
            console.warn("[bookmiz-mobile] marketplace recovery failed", recoveryError);
          }

          setError(getExploreErrorMessage(nextError));
          setFallbackNote(null);
          setDidBroadenResults(false);
        }
      } finally {
        if (requestId === latestRequestRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [
      activeCategory,
      appliedLocation,
      appliedQuery,
      serviceModel,
      session.isSignedIn,
      session.profile?.stateCode,
      session.user?.stateCode,
      sort,
    ],
  );

  useEffect(() => {
    void fetchExplore(1, false);
  }, [fetchExplore]);

  const visibleCategories = useMemo(
    () => (searchData?.categories.length ? searchData.categories : categories),
    [categories, searchData?.categories],
  );

  const providers = useMemo(() => {
    if (!searchData) {
      return [];
    }

    return searchData.results.length > 0
      ? searchData.results
      : searchData.featuredProviders;
  }, [searchData]);

  const featuredProviders = useMemo(
    () => searchData?.featuredProviders ?? [],
    [searchData?.featuredProviders],
  );

  const liveCategorySuggestions = useMemo(
    () =>
      visibleCategories
        .filter((category) =>
          "providerCount" in category
            ? category.providerCount > 0
            : category.stats.providerCount > 0,
        )
        .slice(0, 6),
    [visibleCategories],
  );

  const canLoadMore =
    !!searchData &&
    !didBroadenResults &&
    searchData.pagination.page < searchData.pagination.totalPages &&
    searchData.results.length > 0;

  const locationLabel =
    searchData?.query.locationLabel ?? (appliedLocation.trim() || null);

  const heroTitle =
    serviceModel === "LOCAL" ? "Local services" : "Professional appointments";

  const heroSubtitle = searchData?.pagination.total
    ? fallbackNote ??
      `${searchData.pagination.total} provider${
        searchData.pagination.total === 1 ? "" : "s"
      }${locationLabel ? ` matched around ${locationLabel}` : " live on BookMiz"}`
    : serviceModel === "LOCAL"
      ? "Search local beauty, grooming, wellness, and home services."
      : "Search professional care, consults, and appointment-led services.";

  const toggleBookmark = useCallback(
    async (providerId: string) => {
      if (!session.isSignedIn) {
        return;
      }

      const isBookmarked = bookmarkedIds.includes(providerId);

      setBookmarkedIds((current) =>
        isBookmarked
          ? current.filter((id) => id !== providerId)
          : [...current, providerId],
      );

      try {
        if (isBookmarked) {
          await removeMarketplaceProviderBookmark(providerId);
        } else {
          await bookmarkMarketplaceProvider(providerId);
        }
      } catch {
        setBookmarkedIds((current) =>
          isBookmarked
            ? [...current, providerId]
            : current.filter((id) => id !== providerId),
        );
      }
    },
    [bookmarkedIds, session.isSignedIn],
  );

  const applySearch = useCallback(() => {
    setAppliedQuery(draftQuery);
    setAppliedLocation(draftLocation);
  }, [draftLocation, draftQuery]);

  const applyAndCloseFilters = useCallback(() => {
    applySearch();
    setFiltersOpen(false);
  }, [applySearch]);

  const resetFilters = useCallback(() => {
    setDraftQuery("");
    setDraftLocation("");
    setAppliedQuery("");
    setAppliedLocation("");
    setActiveCategory(undefined);
    setSort("recommended");
  }, []);

  const setLane = useCallback((nextLane: MarketplaceSearchServiceModel) => {
    setServiceModel(nextLane);
    setActiveCategory(undefined);
  }, []);

  return (
    <Screen
      eyebrow="Marketplace"
      title={heroTitle}
      subtitle={heroSubtitle}
      heroTopContent={
        <View style={styles.heroTopRow}>
          <View style={styles.heroTag}>
            <Text style={styles.heroTagText}>
              {serviceModel === "LOCAL" ? "Local services" : "Professional appointments"}
            </Text>
          </View>
          {locationLabel ? (
            <View style={styles.heroTag}>
              <FontAwesome6 name="location-dot" size={12} color="#fff" />
              <Text style={styles.heroTagText}>{locationLabel}</Text>
            </View>
          ) : null}
        </View>
      }
      contentTopOffset={16}
      heroBottomPadding={16}
      heroMinHeight={220}
    >
      {error ? (
        <View style={styles.alertBanner}>
          <FontAwesome6 name="triangle-exclamation" size={14} color="#d44c3f" />
          <Text style={styles.alertText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.searchCard}>
        <View style={styles.searchCardHeader}>
          <View style={styles.searchCardCopy}>
            <Text style={styles.searchCardLabel}>Marketplace search</Text>
            <Text style={styles.searchCardNote}>Search by specialty, service, or location.</Text>
          </View>
          <Pressable style={styles.refineButton} onPress={() => setFiltersOpen(true)}>
            <FontAwesome6 name="sliders" size={13} color={tokens.colors.ink} />
            <Text style={styles.refineButtonText}>Refine</Text>
          </Pressable>
        </View>

        <View style={styles.fieldStack}>
          <View style={styles.searchBox}>
            <FontAwesome6 name="magnifying-glass" size={15} color={tokens.colors.muted} />
            <TextInput
              placeholder={
                serviceModel === "PROFESSIONAL"
                  ? "Search clinics, legal consults, tutors..."
                  : "Search treatments, barber, beauty..."
              }
              placeholderTextColor={tokens.colors.mutedSoft}
              style={styles.searchInput}
              value={draftQuery}
              onChangeText={setDraftQuery}
              returnKeyType="search"
              onSubmitEditing={applySearch}
            />
          </View>

          <View style={styles.searchActionRow}>
            <View style={[styles.searchBox, styles.locationBox]}>
              <FontAwesome6 name="location-dot" size={15} color={tokens.colors.muted} />
              <TextInput
                placeholder="City, county, state, zip, or country"
                placeholderTextColor={tokens.colors.mutedSoft}
                style={styles.searchInput}
                value={draftLocation}
                onChangeText={setDraftLocation}
                returnKeyType="search"
                onSubmitEditing={applySearch}
              />
            </View>
            <Pressable style={styles.searchButton} onPress={applySearch}>
              <Text style={styles.searchButtonText}>Search</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {fallbackNote ? (
        <View style={styles.infoBanner}>
          <FontAwesome6 name="sparkles" size={13} color={tokens.colors.ink} />
          <Text style={styles.infoText}>{fallbackNote}</Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.laneRail}
      >
        {serviceModelOptions.map((option) => {
          const isActive = serviceModel === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.laneChip, isActive ? styles.laneChipActive : null]}
              onPress={() => setLane(option.value)}
            >
              <Text style={[styles.laneChipText, isActive ? styles.laneChipTextActive : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRail}
      >
        <Pressable
          style={[styles.categoryChip, !activeCategory ? styles.categoryChipActive : null]}
          onPress={() => setActiveCategory(undefined)}
        >
          <Text
            style={[
              styles.categoryChipText,
              !activeCategory ? styles.categoryChipTextActive : null,
            ]}
          >
            All
          </Text>
        </Pressable>
        {visibleCategories.map((category) => {
          const isActive = activeCategory === category.slug;
          return (
            <Pressable
              key={category.id}
              style={[styles.categoryChip, isActive ? styles.categoryChipActive : null]}
              onPress={() => setActiveCategory(category.slug)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  isActive ? styles.categoryChipTextActive : null,
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sortPanel}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRail}
        >
          {sortOptions.map((option) => {
            const isActive = sort === option.value;
            return (
              <Pressable
                key={option.value}
                style={[styles.sortChip, isActive ? styles.sortChipActive : null]}
                onPress={() => setSort(option.value)}
              >
                <Text
                  style={[styles.sortChipText, isActive ? styles.sortChipTextActive : null]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {featuredProviders.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Featured providers"
            subtitle="Live providers worth comparing first."
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredRail}
          >
            {featuredProviders.map((provider) => (
              <View key={provider.id} style={styles.featuredCardWrap}>
                <ProviderCard
                  provider={provider}
                  isBookmarked={bookmarkedIds.includes(provider.id)}
                  onPress={() => router.push(`/providers/${provider.slug}` as never)}
                  onToggleBookmark={
                    session.isSignedIn ? () => void toggleBookmark(provider.id) : undefined
                  }
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title={searchData?.headline ?? "Marketplace results"}
          subtitle={
            searchData?.pagination.total
              ? `${searchData.pagination.total} providers matched your search`
              : "Browse the providers currently live on BookMiz."
          }
        />

        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            isBookmarked={bookmarkedIds.includes(provider.id)}
            onPress={() => router.push(`/providers/${provider.slug}` as never)}
            onToggleBookmark={
              session.isSignedIn ? () => void toggleBookmark(provider.id) : undefined
            }
          />
        ))}

        {!isLoading && providers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No providers matched this search</Text>
            <Text style={styles.emptyCaption}>
              {serviceModel === "PROFESSIONAL"
                ? "Try a different specialty, clear the search term, or switch to local services."
                : "Try a different service, clear the search term, or widen the location."}
            </Text>
            <View style={styles.emptyActionRow}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  setDraftQuery("");
                  setAppliedQuery("");
                  setActiveCategory(undefined);
                }}
              >
                <Text style={styles.secondaryButtonText}>Clear search</Text>
              </Pressable>
              {serviceModel === "PROFESSIONAL" ? (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => {
                    setLane("LOCAL");
                    setActiveCategory(undefined);
                    setDraftQuery("");
                    setAppliedQuery("");
                  }}
                >
                  <Text style={styles.primaryButtonText}>Switch to local</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {!isLoading && providers.length === 0 && liveCategorySuggestions.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Popular live categories"
              subtitle="Real marketplace categories currently showing providers."
            />
            <View style={styles.liveCategoryGrid}>
              {liveCategorySuggestions.map((category) => {
                const providerCount =
                  "providerCount" in category
                    ? category.providerCount
                    : category.stats.providerCount;

                return (
                  <Pressable
                    key={category.id}
                    style={styles.liveCategoryCard}
                    onPress={() => {
                      setLane(
                        category.serviceModel === "PROFESSIONAL"
                          ? "PROFESSIONAL"
                          : "LOCAL",
                      );
                      setActiveCategory(category.slug);
                      setDraftQuery("");
                      setAppliedQuery("");
                    }}
                  >
                    <Text style={styles.liveCategoryTitle}>{category.name}</Text>
                    <Text style={styles.liveCategoryMeta}>
                      {providerCount} provider{providerCount === 1 ? "" : "s"}
                    </Text>
                    <Text style={styles.liveCategoryCaption}>
                      {category.description ?? "Browse this live category in the marketplace."}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {canLoadMore ? (
          <Pressable
            style={styles.loadMoreButton}
            onPress={() =>
              void fetchExplore((searchData?.pagination.page ?? 1) + 1, true)
            }
          >
            <Text style={styles.loadMoreButtonText}>
              {isLoadingMore ? "Loading more..." : "Load more providers"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <Text style={styles.loadingText}>Refreshing live marketplace results…</Text>
      ) : null}

      <Modal
        visible={filtersOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setFiltersOpen(false)} />
          <View style={styles.modalSheetWrap}>
            <SafeAreaView style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>Refine search</Text>
                  <Text style={styles.modalSubtitle}>
                    Update search, lane, category, and sort without leaving the feed.
                  </Text>
                </View>
                <Pressable style={styles.closeButton} onPress={() => setFiltersOpen(false)}>
                  <FontAwesome6 name="xmark" size={18} color={tokens.colors.ink} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>Search</Text>
                  <View style={styles.fieldStack}>
                    <View style={styles.searchBox}>
                      <FontAwesome6
                        name="magnifying-glass"
                        size={15}
                        color={tokens.colors.muted}
                      />
                      <TextInput
                        placeholder="Search barber, massage, makeup..."
                        placeholderTextColor={tokens.colors.mutedSoft}
                        style={styles.searchInput}
                        value={draftQuery}
                        onChangeText={setDraftQuery}
                        returnKeyType="search"
                        onSubmitEditing={applyAndCloseFilters}
                      />
                    </View>
                    <View style={styles.searchBox}>
                      <FontAwesome6 name="location-dot" size={15} color={tokens.colors.muted} />
                      <TextInput
                        placeholder="City, county, state, zip, or country"
                        placeholderTextColor={tokens.colors.mutedSoft}
                        style={styles.searchInput}
                        value={draftLocation}
                        onChangeText={setDraftLocation}
                        returnKeyType="search"
                        onSubmitEditing={applyAndCloseFilters}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>Marketplace lane</Text>
                  <View style={styles.segmentRow}>
                    {serviceModelOptions.map((option) => {
                      const isActive = serviceModel === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={[
                            styles.segmentCard,
                            isActive ? styles.segmentCardActive : null,
                          ]}
                          onPress={() => setLane(option.value)}
                        >
                          <Text
                            style={[
                              styles.segmentTitle,
                              isActive ? styles.segmentTitleActive : null,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>Category</Text>
                  <View style={styles.filterWrap}>
                    <Pressable
                      style={[
                        styles.filterChip,
                        !activeCategory ? styles.filterChipActive : null,
                      ]}
                      onPress={() => setActiveCategory(undefined)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          !activeCategory ? styles.filterChipTextActive : null,
                        ]}
                      >
                        All categories
                      </Text>
                    </Pressable>
                    {visibleCategories.map((category) => {
                      const isActive = activeCategory === category.slug;
                      return (
                        <Pressable
                          key={category.id}
                          style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                          onPress={() => setActiveCategory(category.slug)}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              isActive ? styles.filterChipTextActive : null,
                            ]}
                          >
                            {category.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>Sort by</Text>
                  <View style={styles.filterWrap}>
                    {sortOptions.map((option) => {
                      const isActive = sort === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                          onPress={() => setSort(option.value)}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              isActive ? styles.filterChipTextActive : null,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.modalFooter}>
                  <View style={styles.buttonRow}>
                    <Pressable style={styles.secondaryButton} onPress={resetFilters}>
                      <Text style={styles.secondaryButtonText}>Reset</Text>
                    </Pressable>
                    {session.profile?.city ? (
                      <Pressable
                        style={styles.secondaryButton}
                        onPress={() => {
                          const profileCity = session.profile?.city;
                          if (!profileCity) {
                            return;
                          }

                          const location = session.profile?.stateCode
                            ? `${profileCity}, ${session.profile.stateCode}`
                            : profileCity;
                          setDraftLocation(location);
                        }}
                      >
                        <Text style={styles.secondaryButtonText}>Use profile city</Text>
                      </Pressable>
                    ) : null}
                    <Pressable style={styles.primaryButton} onPress={applyAndCloseFilters}>
                      <Text style={styles.primaryButtonText}>Apply filters</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroTagText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: tokens.radius.md,
    backgroundColor: "#fff4f2",
    borderWidth: 1,
    borderColor: "#f1c7c2",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alertText: {
    flex: 1,
    color: "#b23a2f",
    fontSize: 13,
    lineHeight: 20,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: tokens.radius.md,
    backgroundColor: "#eef6d8",
    borderWidth: 1,
    borderColor: "#d7e6ab",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoText: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 13,
    lineHeight: 20,
  },
  searchCard: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 14,
  },
  searchCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  searchCardCopy: {
    flex: 1,
    gap: 4,
  },
  searchCardLabel: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  searchCardNote: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  refineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  refineButtonText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  fieldStack: {
    gap: 10,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchInput: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 15,
  },
  searchActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  locationBox: {
    flex: 1,
  },
  searchButton: {
    minWidth: 108,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  searchButtonText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  laneRail: {
    gap: 10,
    paddingRight: 10,
  },
  laneChip: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#ecf0f6",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  laneChipActive: {
    backgroundColor: "#e6f4be",
  },
  laneChipText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  laneChipTextActive: {
    color: tokens.colors.ink,
  },
  categoryRail: {
    gap: 10,
    paddingRight: 12,
  },
  categoryChip: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  categoryChipActive: {
    backgroundColor: tokens.colors.ink,
    borderColor: tokens.colors.ink,
  },
  categoryChipText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  categoryChipTextActive: {
    color: "#fff",
  },
  sortPanel: {
    marginTop: -2,
  },
  sortRail: {
    gap: 10,
    paddingRight: 12,
  },
  sortChip: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sortChipActive: {
    backgroundColor: tokens.colors.ink,
    borderColor: tokens.colors.ink,
  },
  sortChipText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  sortChipTextActive: {
    color: "#fff",
  },
  section: {
    gap: 14,
  },
  featuredRail: {
    gap: 14,
    paddingRight: 12,
  },
  featuredCardWrap: {
    width: 308,
  },
  emptyState: {
    gap: 12,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
  },
  emptyTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  emptyCaption: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  emptyActionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  liveCategoryGrid: {
    gap: 12,
  },
  liveCategoryCard: {
    gap: 6,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
  },
  liveCategoryTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  liveCategoryMeta: {
    color: tokens.colors.brandDeep,
    fontSize: 12,
    fontWeight: "800",
  },
  liveCategoryCaption: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  loadMoreButton: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  loadMoreButtonText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  loadingText: {
    color: tokens.colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(12,29,54,0.42)",
  },
  modalSheetWrap: {
    justifyContent: "flex-end",
  },
  modalSheet: {
    height: "82%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingTop: 12,
  },
  modalHandle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cfd8e6",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  modalTitle: {
    color: tokens.colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  modalSubtitle: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  modalSection: {
    gap: 12,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
  },
  modalSectionLabel: {
    color: tokens.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  modalFooter: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    flexGrow: 1,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 10,
  },
  segmentCard: {
    flex: 1,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 14,
    gap: 6,
  },
  segmentCardActive: {
    backgroundColor: tokens.colors.ink,
    borderColor: tokens.colors.ink,
  },
  segmentTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  segmentTitleActive: {
    color: "#fff",
  },
  filterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.brand,
    borderColor: tokens.colors.brand,
  },
  filterChipText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: tokens.colors.ink,
  },
});

import { FontAwesome6 } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { AuthField } from "@/src/components/auth/AuthField";
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

  const heroSubtitle = searchData?.pagination.total
    ? `${searchData.pagination.total} provider${
        searchData.pagination.total === 1 ? "" : "s"
      }${locationLabel ? ` near ${locationLabel}` : ""}`
    : serviceModel === "LOCAL"
      ? "Find beauty, grooming, wellness, and home services."
      : "Find clinics, consults, and other appointments.";

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


  const currentSortLabel =
    sortOptions.find((option) => option.value === sort)?.label ?? "Recommended";
  const showSkeleton = isLoading && providers.length === 0;

  return (
    <Screen
      title="Explore"
      subtitle={heroSubtitle}
      heroContent={
        <View style={styles.searchShell}>
          <FontAwesome6 name="magnifying-glass" size={16} color={tokens.colors.muted} />
          <TextInput
            placeholder={
              serviceModel === "PROFESSIONAL"
                ? "Clinics, consults, tutors…"
                : "Haircut, nails, massage…"
            }
            placeholderTextColor={tokens.colors.muted}
            style={styles.searchInput}
            value={draftQuery}
            onChangeText={setDraftQuery}
            returnKeyType="search"
            onSubmitEditing={applySearch}
            accessibilityLabel="Search services"
          />
          {draftQuery ? (
            <Pressable
              onPress={() => {
                setDraftQuery("");
                setAppliedQuery("");
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={styles.searchClear}
            >
              <FontAwesome6 name="xmark" size={14} color={tokens.colors.muted} />
            </Pressable>
          ) : null}
        </View>
      }
      showBack={false}
      refreshing={isLoading && providers.length > 0}
      onRefresh={() => void fetchExplore(1, false)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.railScroll}
        contentContainerStyle={styles.rail}
      >
        {serviceModelOptions.map((option) => {
          const isActive = serviceModel === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.chip, isActive ? styles.chipActive : null]}
              onPress={() => setLane(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.chipText, isActive ? styles.chipTextActive : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
        <View style={styles.railDivider} />
        <Pressable
          style={[styles.chip, !activeCategory ? styles.chipActive : null]}
          onPress={() => setActiveCategory(undefined)}
          accessibilityRole="button"
          accessibilityState={{ selected: !activeCategory }}
        >
          <Text style={[styles.chipText, !activeCategory ? styles.chipTextActive : null]}>All</Text>
        </Pressable>
        {visibleCategories.map((category) => {
          const isActive = activeCategory === category.slug;
          return (
            <Pressable
              key={category.id}
              style={[styles.chip, isActive ? styles.chipActive : null]}
              onPress={() => setActiveCategory(category.slug)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.chipText, isActive ? styles.chipTextActive : null]}>
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.railScroll}
        contentContainerStyle={styles.rail}
      >
        <Pressable
          style={styles.controlChip}
          onPress={() => setFiltersOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Change location"
        >
          <FontAwesome6 name="location-dot" size={14} color={tokens.colors.ink} />
          <Text style={styles.controlChipText} numberOfLines={1}>
            {locationLabel ?? "Anywhere"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.controlChip}
          onPress={() => setFiltersOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Change sort"
        >
          <FontAwesome6 name="arrow-down-wide-short" size={14} color={tokens.colors.ink} />
          <Text style={styles.controlChipText}>{currentSortLabel}</Text>
        </Pressable>
        <Pressable
          style={styles.controlChip}
          onPress={() => setFiltersOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open filters"
        >
          <FontAwesome6 name="sliders" size={14} color={tokens.colors.ink} />
          <Text style={styles.controlChipText}>Filters</Text>
        </Pressable>
      </ScrollView>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
          <Pressable onPress={() => void fetchExplore(1, false)} accessibilityRole="button">
            <Text style={styles.errorRetry}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {fallbackNote ? (
        <View style={styles.noteBox}>
          <FontAwesome6 name="circle-info" size={14} color={tokens.colors.brandDeep} />
          <Text style={styles.noteText}>{fallbackNote}</Text>
        </View>
      ) : null}

      {featuredProviders.length > 0 && !showSkeleton ? (
        <View style={styles.section}>
          <SectionHeader title="Featured" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.railScroll}
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
          title={searchData?.headline ?? "Results"}
          subtitle={
            searchData?.pagination.total
              ? `${searchData.pagination.total} provider${searchData.pagination.total === 1 ? "" : "s"}`
              : undefined
          }
        />

        {showSkeleton ? (
          <SkeletonRows count={4} />
        ) : (
          providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isBookmarked={bookmarkedIds.includes(provider.id)}
              onPress={() => router.push(`/providers/${provider.slug}` as never)}
              onToggleBookmark={
                session.isSignedIn ? () => void toggleBookmark(provider.id) : undefined
              }
            />
          ))
        )}

        {!isLoading && providers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No providers match</Text>
            <Text style={styles.emptyBody}>
              {serviceModel === "PROFESSIONAL"
                ? "Try another specialty, clear the search, or switch to local services."
                : "Try another service, clear the search, or widen the location."}
            </Text>
            <View style={styles.emptyActions}>
              <AuthButton
                label="Clear search"
                variant="secondary"
                style={styles.emptyButton}
                onPress={() => {
                  setDraftQuery("");
                  setAppliedQuery("");
                  setActiveCategory(undefined);
                }}
              />
              {serviceModel === "PROFESSIONAL" ? (
                <AuthButton
                  label="Switch to local"
                  variant="navy"
                  style={styles.emptyButton}
                  onPress={() => {
                    setLane("LOCAL");
                    setActiveCategory(undefined);
                    setDraftQuery("");
                    setAppliedQuery("");
                  }}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {!isLoading && providers.length === 0 && liveCategorySuggestions.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Categories with providers" />
            {liveCategorySuggestions.map((category) => {
              const providerCount =
                "providerCount" in category
                  ? category.providerCount
                  : category.stats.providerCount;

              return (
                <Pressable
                  key={category.id}
                  style={styles.categoryCard}
                  accessibilityRole="button"
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
                  <View style={styles.categoryCardBody}>
                    <Text style={styles.categoryCardTitle} numberOfLines={1}>
                      {category.name}
                    </Text>
                    <Text style={styles.categoryCardMeta} numberOfLines={2}>
                      {providerCount} provider{providerCount === 1 ? "" : "s"}
                      {category.description ? ` · ${category.description}` : ""}
                    </Text>
                  </View>
                  <FontAwesome6 name="chevron-right" size={14} color={tokens.colors.muted} />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {canLoadMore ? (
          <AuthButton
            label="Load more"
            variant="secondary"
            loading={isLoadingMore}
            style={styles.loadMore}
            onPress={() =>
              void fetchExplore((searchData?.pagination.page ?? 1) + 1, true)
            }
          />
        ) : null}
      </View>

      <Modal
        visible={filtersOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setFiltersOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close filters"
          />
          <SafeAreaView style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setFiltersOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <FontAwesome6 name="xmark" size={18} color={tokens.colors.ink} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <AuthField
                label="Service"
                placeholder="Haircut, nails, massage…"
                value={draftQuery}
                onChangeText={setDraftQuery}
                autoComplete="off"
              />
              <AuthField
                label="Location"
                placeholder="City, state, or zip"
                value={draftLocation}
                onChangeText={setDraftLocation}
                autoComplete="off"
                labelAccessory={
                  session.profile?.city ? (
                    <Pressable
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
                      accessibilityRole="button"
                      hitSlop={8}
                    >
                      <Text style={styles.fieldLink}>Use my city</Text>
                    </Pressable>
                  ) : null
                }
              />

              <View style={styles.modalGroup}>
                <Text style={styles.modalLabel}>Type</Text>
                <View style={styles.wrapRow}>
                  {serviceModelOptions.map((option) => {
                    const isActive = serviceModel === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.chip, isActive ? styles.chipActive : null]}
                        onPress={() => setLane(option.value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                      >
                        <Text style={[styles.chipText, isActive ? styles.chipTextActive : null]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.modalGroup}>
                <Text style={styles.modalLabel}>Category</Text>
                <View style={styles.wrapRow}>
                  <Pressable
                    style={[styles.chip, !activeCategory ? styles.chipActive : null]}
                    onPress={() => setActiveCategory(undefined)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !activeCategory }}
                  >
                    <Text style={[styles.chipText, !activeCategory ? styles.chipTextActive : null]}>
                      All
                    </Text>
                  </Pressable>
                  {visibleCategories.map((category) => {
                    const isActive = activeCategory === category.slug;
                    return (
                      <Pressable
                        key={category.id}
                        style={[styles.chip, isActive ? styles.chipActive : null]}
                        onPress={() => setActiveCategory(category.slug)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                      >
                        <Text style={[styles.chipText, isActive ? styles.chipTextActive : null]}>
                          {category.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.modalGroup}>
                <Text style={styles.modalLabel}>Sort</Text>
                <View style={styles.wrapRow}>
                  {sortOptions.map((option) => {
                    const isActive = sort === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.chip, isActive ? styles.chipActive : null]}
                        onPress={() => setSort(option.value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                      >
                        <Text style={[styles.chipText, isActive ? styles.chipTextActive : null]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <AuthButton
                label="Reset"
                variant="secondary"
                style={styles.modalReset}
                onPress={resetFilters}
              />
              <AuthButton label="Show results" style={styles.modalApply} onPress={applyAndCloseFilters} />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
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
    <View style={styles.skeletonList} accessibilityLabel="Loading providers">
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
    fontSize: 16,
    fontFamily: tokens.font.regular,
  },
  searchClear: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  railScroll: {
    marginHorizontal: -20,
  },
  rail: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: "center",
  },
  railDivider: {
    width: 1,
    height: 24,
    backgroundColor: tokens.colors.borderStrong,
    marginHorizontal: 4,
  },
  chip: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
  },
  chipActive: {
    backgroundColor: tokens.colors.inkDeep,
    borderColor: tokens.colors.inkDeep,
  },
  chipText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  chipTextActive: {
    color: "#ffffff",
  },
  controlChip: {
    height: 40,
    maxWidth: 200,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surfaceSoft,
  },
  controlChipText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
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
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.brandSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noteText: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: tokens.font.regular,
  },
  section: {
    gap: 12,
  },
  featuredRail: {
    paddingHorizontal: 20,
    gap: 12,
  },
  featuredCardWrap: {
    width: 300,
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
  emptyActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    alignSelf: "stretch",
  },
  emptyButton: {
    flex: 1,
    minHeight: 48,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  categoryCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  categoryCardTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.display,
  },
  categoryCardMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
  },
  loadMore: {
    minHeight: 48,
  },
  skeletonList: {
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
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(16,39,72,0.45)",
  },
  modalSheet: {
    maxHeight: "85%",
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    backgroundColor: tokens.colors.surface,
    paddingTop: 10,
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.borderStrong,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  modalTitle: {
    color: tokens.colors.ink,
    fontSize: 22,
    fontFamily: tokens.font.display,
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 18,
  },
  fieldLink: {
    color: tokens.colors.inkDeep,
    fontSize: 13,
    fontFamily: tokens.font.semibold,
  },
  modalGroup: {
    gap: 10,
  },
  modalLabel: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  modalReset: {
    flex: 1,
  },
  modalApply: {
    flex: 2,
  },
});

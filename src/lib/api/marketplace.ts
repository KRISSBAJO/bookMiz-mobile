import { mobileEnv } from "@/src/lib/mobile-env";
import { requestJson } from "@/src/lib/api/client";
import type {
  CreateServiceRequestPayload,
  CreateServiceRequestResult,
  CustomerQuoteConversation,
  CustomerQuoteRequest,
  MarketplaceBookingPageResolution,
  MarketplaceCategoryDiscovery,
  MarketplaceProviderCard,
  MarketplaceProviderProfile,
  MarketplaceRequestTemplate,
  MarketplaceSearchServiceModel,
  MarketplaceSearchResponse,
  MarketplaceSort,
  ProviderBookmarkState,
} from "@/src/lib/api/types";

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `?${query}` : "";
}

const marketplaceUrl = `${mobileEnv.bookingApiUrl}/marketplace`;

export function listCategoryDiscovery(serviceModel: MarketplaceSearchServiceModel = "LOCAL") {
  return requestJson<MarketplaceCategoryDiscovery[]>(
    `${marketplaceUrl}/categories/discovery${buildQuery({
      serviceModel,
      serviceLimit: 4,
    })}`,
    {
      method: "GET",
    },
  );
}

export function searchProviders(params?: {
  query?: string;
  term?: string;
  categorySlug?: string;
  serviceModel?: MarketplaceSearchServiceModel;
  locationQuery?: string;
  city?: string;
  stateCode?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  sort?: MarketplaceSort;
  page?: number;
  pageSize?: number;
}) {
  const url = `${marketplaceUrl}/providers/search${buildQuery({
    query: params?.query ?? params?.term,
    categorySlug: params?.categorySlug,
    serviceModel: params?.serviceModel ?? "LOCAL",
    locationQuery: params?.locationQuery,
    city: params?.city,
    stateCode: params?.stateCode,
    countryCode: params?.countryCode,
    latitude: params?.latitude,
    longitude: params?.longitude,
    radiusMiles: params?.radiusMiles,
    sort: params?.sort ?? "recommended",
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 12,
  })}`;

  if (__DEV__) {
    console.info("[bookmiz-mobile] marketplace search", url);
  }

  return requestJson<MarketplaceSearchResponse>(
    url,
    {
      method: "GET",
    },
  );
}

export function getMarketplaceProvider(slug: string) {
  return requestJson<MarketplaceProviderProfile>(
    `${marketplaceUrl}/providers/${slug}`,
    {
      method: "GET",
    },
  );
}

export function listMarketplaceRequestTemplates(params?: {
  serviceModel?: MarketplaceSearchServiceModel | "HYBRID";
  categorySlug?: string;
}) {
  return requestJson<MarketplaceRequestTemplate[]>(
    `${marketplaceUrl}/request-templates${buildQuery({
      serviceModel: params?.serviceModel,
      categorySlug: params?.categorySlug,
    })}`,
    {
      method: "GET",
    },
  );
}

export function resolveMarketplaceBookingPage(path: string) {
  return requestJson<MarketplaceBookingPageResolution>(
    `${marketplaceUrl}/booking-pages/resolve${buildQuery({ path })}`,
    {
      method: "GET",
    },
  );
}

export function listCustomerBookmarkedProviders() {
  return requestJson<MarketplaceProviderCard[]>(`${marketplaceUrl}/bookmarks`, {
    method: "GET",
    auth: true,
  });
}

export function bookmarkMarketplaceProvider(providerId: string) {
  return requestJson<ProviderBookmarkState>(
    `${marketplaceUrl}/providers/id/${providerId}/bookmark`,
    {
      method: "POST",
      auth: true,
    },
  );
}

export function removeMarketplaceProviderBookmark(providerId: string) {
  return requestJson<ProviderBookmarkState>(
    `${marketplaceUrl}/providers/id/${providerId}/bookmark/remove`,
    {
      method: "POST",
      auth: true,
    },
  );
}

export function listCustomerQuoteRequests(options: {
  requesterUserId?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  status?: string;
}) {
  return requestJson<CustomerQuoteRequest[]>(
    `${marketplaceUrl}/quotes${buildQuery({
      requesterUserId: options.requesterUserId,
      requesterEmail: options.requesterEmail,
      requesterPhone: options.requesterPhone,
      status: options.status,
    })}`,
    {
      method: "GET",
      auth: true,
    },
  );
}

export function listRequesterQuoteConversations(
  quoteRequestId: string,
  options: {
    requesterUserId?: string;
    requesterEmail?: string;
    requesterPhone?: string;
  },
) {
  return requestJson<CustomerQuoteConversation[]>(
    `${marketplaceUrl}/quotes/${quoteRequestId}/conversations${buildQuery({
      requesterUserId: options.requesterUserId,
      requesterEmail: options.requesterEmail,
      requesterPhone: options.requesterPhone,
    })}`,
    {
      method: "GET",
      auth: true,
    },
  );
}

export function sendRequesterQuoteMessage(
  quoteRequestId: string,
  conversationId: string,
  payload: {
    requesterUserId?: string;
    requesterEmail?: string;
    requesterPhone?: string;
    content: string;
  },
) {
  return requestJson<CustomerQuoteConversation>(
    `${marketplaceUrl}/quotes/${quoteRequestId}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      auth: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}

export function acceptCustomerQuoteMatch(
  quoteRequestId: string,
  matchId: string,
  payload: {
    requesterUserId?: string;
    requesterEmail?: string;
    requesterPhone?: string;
  },
) {
  return requestJson<{
    id: string;
    providerId: string;
    quoteRequestId: string;
    name: string;
    status: string;
  }>(`${marketplaceUrl}/quotes/${quoteRequestId}/select-match/${matchId}`, {
    method: "POST",
      auth: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function createServiceRequest(payload: CreateServiceRequestPayload) {
  return requestJson<CreateServiceRequestResult>(`${marketplaceUrl}/quotes`, {
    method: "POST",
      auth: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

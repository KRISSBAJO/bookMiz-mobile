import type { ImageSourcePropType } from "react-native";

import { mobileEnv } from "@/src/lib/mobile-env";
import type {
  MarketplaceLocation,
  MarketplaceProviderCard,
  MarketplaceProviderProfile,
} from "@/src/lib/api/types";

const bundledMarketplaceImages: Record<string, ImageSourcePropType> = {
  "/barber.png": require("../../assets/bookmiz/barber.png"),
  "/doctor_visit.png": require("../../assets/bookmiz/doctor-visit.png"),
  "/hero-bg.jpg": require("../../assets/bookmiz/hero-bg.jpg"),
  "/hospital.png": require("../../assets/bookmiz/hospital.png"),
  "/manicure.png": require("../../assets/bookmiz/manicure.png"),
  "/Barber.png": require("../../assets/bookmiz/barber.png"),
};

const PRICE_TIER_LABELS: Record<string, string> = {
  $: "Budget friendly",
  $$: "Mid-range",
  $$$: "Premium",
  $$$$: "Luxury",
};

/** Turns a "$$"-style tier into words; other labels pass through unchanged. */
export function formatPriceTier(label?: string | null) {
  if (!label) {
    return null;
  }
  return PRICE_TIER_LABELS[label.trim()] ?? label;
}

/**
 * Real amount first; the tier label ("$$") only when no amount is known.
 * Currency must accompany its stored amount; never infer it from a business profile.
 */
export function formatMarketplacePrice(
  value?: number | null,
  fallback?: string | null,
  currencyCode?: string,
) {
  if (value !== null && value !== undefined) {
    if (!currencyCode || !/^[A-Z]{3}$/.test(currencyCode)) return "Currency unavailable";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        currencyDisplay: "code",
      }).format(value / 100);
    } catch {
      return `${currencyCode} ${(value / 100).toFixed(2)}`;
    }
  }

  return formatPriceTier(fallback) ?? "Price on request";
}

export function formatMarketplaceDuration(minutes?: number | null) {
  if (minutes === null || minutes === undefined) {
    return "";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function formatMarketplaceDistance(distanceMiles?: number | null) {
  if (distanceMiles === null || distanceMiles === undefined) {
    return "Local";
  }

  return `${distanceMiles.toFixed(distanceMiles < 10 ? 1 : 0)} mi`;
}

export function getMarketplaceLocationLabel(
  location?: MarketplaceLocation | null,
) {
  if (!location) {
    return "BookMiz";
  }

  if (location.localityLabel) {
    return location.localityLabel;
  }

  return [location.city, location.stateCode].filter(Boolean).join(", ");
}

export function getProviderSummary(provider: MarketplaceProviderCard) {
  return (
    provider.publicSummary ??
    provider.tagline ??
    "Polished profile, clear pricing, and a cleaner decision flow on mobile."
  );
}

export function resolveMarketplaceImage(
  path?: string | null,
  fallback?: ImageSourcePropType,
): ImageSourcePropType {
  if (!path) {
    return fallback ?? bundledMarketplaceImages["/manicure.png"];
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return { uri: path };
  }

  if (bundledMarketplaceImages[path]) {
    return bundledMarketplaceImages[path];
  }

  return { uri: `${mobileEnv.webAppUrl}${path}` };
}

export function getProviderHeroImage(
  provider: MarketplaceProviderCard | MarketplaceProviderProfile["provider"],
) {
  return resolveMarketplaceImage(
    provider.coverImageUrl ?? provider.galleryPreviewUrls[0] ?? null,
  );
}

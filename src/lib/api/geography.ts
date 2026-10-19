import { requestJson } from "@/src/lib/api/client";
import { mobileEnv } from "@/src/lib/mobile-env";

export type GeographyCity = { id: string; name: string; latitude: number | null; longitude: number | null };
export type GeographyState = { id: string; code: string; name: string; cities: GeographyCity[] };
export type GeographyCountry = { id: string; code: string; name: string; states: GeographyState[] };
export type ProfileLocation = { countryCode: string; stateCode: string; city: string; homeLatitude: number | null; homeLongitude: number | null };

export function listSupportedGeography() {
  return requestJson<GeographyCountry[]>(`${mobileEnv.bookingApiUrl}/marketplace/supported-geography`);
}

export function resolveProfileLocation(countries: GeographyCountry[], value: ProfileLocation) {
  const country = countries.find((item) => item.code === value.countryCode);
  const state = country?.states.find((item) => item.code === value.stateCode);
  const city = state?.cities.find((item) => item.name === value.city);
  return { country, state, city, valid: Boolean(country && state && city) };
}

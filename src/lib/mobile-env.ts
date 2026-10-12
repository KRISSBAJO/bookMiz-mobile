export const mobileEnv = {
  identityApiUrl:
    process.env.EXPO_PUBLIC_IDENTITY_API_URL?.replace(/\/$/, "") ??
    "https://identity-api.bookmiz.com/api",
  bookingApiUrl:
    process.env.EXPO_PUBLIC_BOOKING_API_URL?.replace(/\/$/, "") ??
    "https://booking-api.bookmiz.com/api",
  webAppUrl:
    process.env.EXPO_PUBLIC_WEB_APP_URL?.replace(/\/$/, "") ??
    "https://www.bookmiz.com",
  appMode: process.env.EXPO_PUBLIC_APP_MODE ?? "preview",
};

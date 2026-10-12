import { DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { SessionProvider } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "welcome",
};

SplashScreen.preventAutoHideAsync();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: tokens.colors.surface,
    card: tokens.colors.panel,
    primary: tokens.colors.brand,
    text: tokens.colors.ink,
    border: tokens.colors.border,
  },
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SessionProvider>
      <ThemeProvider value={navigationTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="verify-code" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="password-updated" />
          <Stack.Screen name="saved-providers" />
          <Stack.Screen name="appointments" />
          <Stack.Screen name="appointments/[bookingId]" />
          <Stack.Screen name="providers/[slug]" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </SessionProvider>
  );
}

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { MobileAuthTokens } from "@/src/lib/api/types";

const SESSION_STORAGE_KEY = "bookmiz-mobile-session";

export async function loadStoredTokens() {
  const raw =
    Platform.OS === "web"
      ? globalThis.localStorage?.getItem(SESSION_STORAGE_KEY) ?? null
      : await SecureStore.getItemAsync(SESSION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as MobileAuthTokens;

    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function saveStoredTokens(tokens: MobileAuthTokens) {
  const raw = JSON.stringify(tokens);

  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, raw);
    return;
  }

  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, raw);
}

export async function clearStoredTokens() {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
}

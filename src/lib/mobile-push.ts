import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getAuthTokens } from "@/src/lib/api/client";
import {
  registerPushDevice,
  unregisterPushDevice,
} from "@/src/lib/api/notifications";
const key = "bookmiz-push-device";
const projectId = "ca508477-5d3d-40ff-9f9c-6c0faae889bf";
let registrationGeneration = 0;
let enablingGeneration: number | null = null;
type Registration = { userId: string; token: string; platform: string };

async function requestDeviceToken() {
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    throw new Error(
      "Could not set up notifications on this device. Check your connection and try again.",
    );
  }
}
export async function getPushRegistration(): Promise<Registration | null> {
  if (Platform.OS === "web") return null;
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return typeof parsed.userId === "string" &&
    typeof parsed.token === "string" &&
    ["ios", "android"].includes(parsed.platform)
    ? parsed
    : null;
}
export async function enablePush(userId: string) {
  const generation = ++registrationGeneration;
  enablingGeneration = generation;
  try {
    const accessToken = getAuthTokens()?.accessToken;
    const assertCurrent = () => {
      if (
        !accessToken ||
        generation !== registrationGeneration ||
        getAuthTokens()?.accessToken !== accessToken
      )
        throw new Error(
          "Your session changed. Please enable notifications again.",
        );
    };
    if (Platform.OS === "web")
      throw new Error("Push setup is available in the iPhone and Android app.");
    if (Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("default", {
        name: "BookMiz updates",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted)
      permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Notifications are not permitted. You can enable them in your device’s settings.",
      );
    const token = await requestDeviceToken();
    assertCurrent();
    await registerPushDevice(token, Platform.OS, accessToken);
    assertCurrent();
    await SecureStore.setItemAsync(
      key,
      JSON.stringify({ userId, token, platform: Platform.OS }),
    );
  } finally {
    if (enablingGeneration === generation) enablingGeneration = null;
  }
}
export async function refreshPushRegistration(userId: string) {
  if (enablingGeneration === registrationGeneration) return;
  const accessToken = getAuthTokens()?.accessToken;
  const saved = await getPushRegistration();
  if (saved?.userId !== userId || enablingGeneration === registrationGeneration) return;
  const generation = ++registrationGeneration;
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) {
    await disablePush(userId);
    return;
  }
  const token = await requestDeviceToken();
  if (
    !accessToken ||
    generation !== registrationGeneration ||
    getAuthTokens()?.accessToken !== accessToken
  )
    return;
  await registerPushDevice(token, Platform.OS, accessToken);
  if (
    generation !== registrationGeneration ||
    getAuthTokens()?.accessToken !== accessToken
  )
    return;
  await SecureStore.setItemAsync(key, JSON.stringify({ ...saved, token }));
}
export async function disablePush(userId: string, accessToken?: string) {
  registrationGeneration += 1;
  const saved = await getPushRegistration();
  if (!saved || saved.userId !== userId) return;
  try {
    await unregisterPushDevice(saved.token, saved.platform, accessToken);
  } finally {
    const current = await getPushRegistration();
    if (current?.userId === userId && current.token === saved.token)
      await SecureStore.deleteItemAsync(key);
  }
}

import { useEffect } from "react";
import { AppState, DeviceEventEmitter, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useSession } from "@/src/store/session-context";
import { refreshPushRegistration } from "@/src/lib/mobile-push";
export function PushNotificationBridge() {
  const session = useSession(),
    router = useRouter();
  useEffect(() => {
    if (Platform.OS === "web" || !session.user) return;
    const userId = session.user.id;
    void refreshPushRegistration(userId).catch(() => {});
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void refreshPushRegistration(userId).catch(() => {});
    });
    const open = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.content.data?.notificationId;
      if (
        typeof id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        )
      )
        router.push({
          pathname: "/(tabs)/inbox",
          params: { notificationId: id },
        });
    };
    const listener =
      Notifications.addNotificationResponseReceivedListener(open);
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    const received = Notifications.addNotificationReceivedListener(() =>
      DeviceEventEmitter.emit("bookmiz-inbox-updated"),
    );
    let active = true;
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (active && response) {
          open(response);
          void Notifications.clearLastNotificationResponseAsync().catch(
            () => {},
          );
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      appState.remove();
      listener.remove();
      received.remove();
    };
  }, [session.user?.id, router]);
  return null;
}

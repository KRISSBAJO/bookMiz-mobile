import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";

export async function openBookingCheckout(url: string) {
  const target = new URL(url);
  if (target.protocol !== "https:" || !["checkout.stripe.com", "checkout.paystack.com"].includes(target.hostname)) {
    throw new Error("The payment link could not be verified.");
  }
  if (Platform.OS === "web") window.location.assign(target.toString());
  else await WebBrowser.openBrowserAsync(target.toString());
}

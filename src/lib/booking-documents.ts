import { File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { Linking, Platform } from "react-native";
import { getAuthTokens } from "@/src/lib/api/client";
import {
  getCustomerBooking,
  uploadBookingDocument,
} from "@/src/lib/api/bookings";
import { mobileEnv } from "@/src/lib/mobile-env";
import type { SecureDocumentRecord } from "@/src/lib/api/types";

export async function addBookingDocument(bookingId: string) {
  if (Platform.OS === "web") {
    await Linking.openURL(
      `${mobileEnv.webAppUrl}/customer/appointments?booking=${encodeURIComponent(bookingId)}`,
    );
    return;
  }
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/jpeg", "image/png"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return;
  const asset = result.assets[0];
  if (!asset) return;
  const file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size) > 10 * 1024 * 1024)
      throw new Error("Choose a file smaller than 10 MB.");
    const booking = await getCustomerBooking(bookingId);
    if (!booking.documentUploadToken)
      throw new Error(
        "Document uploads need the updated backend. Please use the website for now.",
      );
    await uploadBookingDocument(bookingId, {
      uploadToken: booking.documentUploadToken,
      fileName: asset.name,
      mimeType: asset.mimeType || "application/pdf",
      contentBase64: await file.base64(),
    });
  } finally {
    const prefix = Paths.cache.uri.endsWith("/")
      ? Paths.cache.uri
      : `${Paths.cache.uri}/`;
    if (file.uri.startsWith(prefix) && file.exists) file.delete();
  }
}
export async function openBookingDocument(
  bookingId: string,
  document: SecureDocumentRecord,
) {
  if (Platform.OS === "web") {
    await Linking.openURL(
      `${mobileEnv.webAppUrl}/customer/appointments?booking=${encodeURIComponent(bookingId)}`,
    );
    return;
  }
  await getCustomerBooking(bookingId);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("File opening is unavailable on this device.");
  const accessToken = getAuthTokens()?.accessToken;
  if (!accessToken) throw new Error("Sign in again to open this document.");
  const name = document.fileName.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-100);
  const target = new File(
    Paths.cache,
    `bookmiz-${document.id.replace(/[^a-zA-Z0-9-]/g, "_")}-${name}`,
  );
  try {
    await File.downloadFileAsync(
      `${mobileEnv.bookingApiUrl}/bookings/customer/documents/${encodeURIComponent(document.id)}/download`,
      target,
      { headers: { Authorization: `Bearer ${accessToken}` }, idempotent: true },
    );
    await Sharing.shareAsync(target.uri, { mimeType: document.mimeType });
  } finally {
    if (target.exists) target.delete();
  }
}

import { mobileEnv } from "@/src/lib/mobile-env";
import { requestJson } from "@/src/lib/api/client";
import type {
  AuthResponseData,
  ForgotPasswordPayload,
  LoginPayload,
  MessageResponseData,
  ProfileSettings,
  RegisterCustomerPayload,
  ResetPasswordPayload,
  UpdateNotificationPreferencesPayload,
  UpdateProfilePayload,
} from "@/src/lib/api/types";

const authUrl = `${mobileEnv.identityApiUrl}/auth`;

export function loginMobile(payload: LoginPayload) {
  return requestJson<AuthResponseData>(`${authUrl}/mobile/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function registerCustomerMobile(payload: RegisterCustomerPayload) {
  return requestJson<AuthResponseData>(`${authUrl}/mobile/register-customer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function logoutMobile(refreshToken: string) {
  return requestJson<MessageResponseData>(`${authUrl}/mobile/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });
}

export function getCurrentAuth() {
  return requestJson<AuthResponseData>(`${authUrl}/me`, {
    method: "GET",
    auth: true,
  });
}

export function getProfileSettings() {
  return requestJson<ProfileSettings>(`${authUrl}/me/profile`, {
    method: "GET",
    auth: true,
  });
}

export function updateProfileSettings(payload: UpdateProfilePayload) {
  return requestJson<ProfileSettings>(`${authUrl}/me/profile`, {
    method: "PATCH",
    auth: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function updateNotificationPreferences(
  payload: UpdateNotificationPreferencesPayload,
) {
  return requestJson<ProfileSettings>(`${authUrl}/me/notification-preferences`, {
    method: "PATCH",
    auth: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function forgotPassword(payload: ForgotPasswordPayload) {
  return requestJson<MessageResponseData>(`${authUrl}/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function resetPassword(payload: ResetPasswordPayload) {
  return requestJson<AuthResponseData>(`${authUrl}/mobile/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

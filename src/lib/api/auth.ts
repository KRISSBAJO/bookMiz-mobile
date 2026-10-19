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
export function uploadProfilePhoto(contentBase64: string) {
  return requestJson<ProfileSettings>(`${authUrl}/me/profile/photo`, {
    method: "POST", auth: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentBase64 }),
  });
}
export function removeProfilePhoto() {
  return requestJson<ProfileSettings>(`${authUrl}/me/profile/photo`, { method: "DELETE", auth: true });
}
export function sendEmailVerification() {
  return requestJson(`${authUrl}/verify-email/send`, {
    method: "POST",
    auth: true,
  });
}
export function confirmEmailVerification(email: string, token: string) {
  return requestJson(`${authUrl}/verify-email/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token }),
  });
}
export type SecuritySession = {
  id: string;
  sessionName: string | null;
  userAgent: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string;
};
export function listSecuritySessions() {
  return requestJson<SecuritySession[]>(`${authUrl}/sessions`, { auth: true });
}
export function revokeSecuritySession(id: string) {
  return requestJson(`${authUrl}/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    auth: true,
  });
}
export function revokeAllSecuritySessions() {
  return requestJson(`${authUrl}/logout-all`, { method: "POST", auth: true });
}
export function getSecuritySummary() {
  return requestJson<{ mfaEnabled: boolean }>(`${authUrl}/security-summary`, {
    auth: true,
  });
}

export type AccountDeletionRequest = {
  id: string;
  status: "PENDING" | "IN_REVIEW" | "CANCELLED";
  requestedAt: string;
};
export function getAccountDeletionRequest() {
  return requestJson<AccountDeletionRequest | null>(
    `${authUrl}/me/deletion-request`,
    { auth: true },
  );
}
export function requestAccountDeletion() {
  return requestJson<AccountDeletionRequest>(`${authUrl}/me/deletion-request`, {
    auth: true,
    method: "POST",
  });
}
export function withdrawAccountDeletion() {
  return requestJson<AccountDeletionRequest | null>(
    `${authUrl}/me/deletion-request`,
    { auth: true, method: "DELETE" },
  );
}
export function changeMobilePassword(
  currentPassword: string,
  newPassword: string,
) {
  return requestJson<AuthResponseData>(`${authUrl}/mobile/change-password`, {
    method: "POST",
    auth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
export function setupMobileMfa() {
  return requestJson<{ secret: string; alreadyEnabled: boolean }>(
    `${authUrl}/mfa/setup`,
    { method: "POST", auth: true },
  );
}
export function updateMobileMfa(
  action: "enable" | "disable" | "recovery-codes/regenerate",
  code: string,
  recoveryCode: string,
) {
  return requestJson<{ recoveryCodes?: string[]; message: string }>(
    `${authUrl}/mfa/${action}`,
    {
      method: "POST",
      auth: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim() || undefined,
        recoveryCode: code.trim()
          ? undefined
          : recoveryCode.trim() || undefined,
      }),
    },
  );
}

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
  return requestJson<ProfileSettings>(
    `${authUrl}/me/notification-preferences`,
    {
      method: "PATCH",
      auth: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
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

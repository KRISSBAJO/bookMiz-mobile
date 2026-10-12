import { mobileEnv } from "@/src/lib/mobile-env";
import { requestWithTimeout } from "@/src/lib/api/fetch-with-timeout";
import type {
  ApiErrorEnvelope,
  ApiSuccessEnvelope,
  AuthResponseData,
  MobileAuthTokens,
} from "@/src/lib/api/types";
import { ApiRequestError } from "@/src/lib/api/types";

type RequestOptions = RequestInit & {
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

type AuthTokenChangeHandler = (tokens: MobileAuthTokens | null) => void | Promise<void>;

let authTokens: MobileAuthTokens | null = null;
let refreshPromise: Promise<AuthResponseData> | null = null;
let authFailureHandler: (() => void | Promise<void>) | null = null;
let authTokenChangeHandler: AuthTokenChangeHandler | null = null;
let tokenPersistence: Promise<void> = Promise.resolve();

export async function setAuthTokens(tokens: MobileAuthTokens | null) {
  authTokens = tokens;
  const handler = authTokenChangeHandler;
  tokenPersistence = tokenPersistence.catch(() => {}).then(async () => { await handler?.(tokens); });
  await tokenPersistence;
}

export function getAuthTokens() {
  return authTokens;
}

export function clearAuthTokens() {
  return setAuthTokens(null);
}

export function setAuthFailureHandler(handler: (() => void | Promise<void>) | null) {
  authFailureHandler = handler;
}

export function setAuthTokenChangeHandler(handler: AuthTokenChangeHandler | null) {
  authTokenChangeHandler = handler;
}

async function parseResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | ApiSuccessEnvelope<T>
    | ApiErrorEnvelope
    | null;

  if (!response.ok) {
    if (__DEV__) {
      console.warn("[bookmiz-mobile] api error response", {
        status: response.status,
      });
    }

    throw new ApiRequestError(
      payload && "error" in payload
        ? payload.error.message
        : "Something went wrong. Please try again.",
      {
        statusCode:
          payload && "error" in payload ? payload.error.statusCode : response.status,
        details: payload && "error" in payload ? payload.error.details : undefined,
      },
    );
  }

  if (!payload || !("data" in payload)) {
    throw new ApiRequestError("Unexpected response from the server.");
  }

  return payload.data;
}

async function refreshSessionInternal() {
  if (!authTokens?.refreshToken) {
    await clearAuthTokens();
    await authFailureHandler?.();
    throw new ApiRequestError("Your session has expired. Please sign in again.", {
      statusCode: 401,
    });
  }

  if (!refreshPromise) {
    refreshPromise = requestWithTimeout(`${mobileEnv.identityApiUrl}/auth/mobile/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        refreshToken: authTokens.refreshToken,
      }),
    }, parseResponse<AuthResponseData>)
      .then(async (data) => {
        await setAuthTokens({
          accessToken: data.session.accessToken,
          refreshToken: data.session.refreshToken,
        });
        return data;
      })
      .catch(async (error) => {
        if (error instanceof ApiRequestError && [401, 403].includes(error.statusCode ?? 0)) {
          await clearAuthTokens();
          await authFailureHandler?.();
        }
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function requestJson<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = false, retryOnUnauthorized = auth, headers, ...init } = options;
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  if (auth && authTokens?.accessToken) {
    requestHeaders.set("Authorization", `Bearer ${authTokens.accessToken}`);
  }

  const result = await requestWithTimeout<{ data: T } | { unauthorized: true }>(url, {
    ...init,
    headers: requestHeaders,
  }, async response => {
    if (auth && retryOnUnauthorized && response.status === 401) return { unauthorized: true } as const;
    return { data: await parseResponse<T>(response) };
  });
  if ("data" in result) return result.data;

  await refreshSessionInternal();

  const retryHeaders = new Headers(headers);
  if (!retryHeaders.has("Accept")) {
    retryHeaders.set("Accept", "application/json");
  }
  if (authTokens?.accessToken) {
    retryHeaders.set("Authorization", `Bearer ${authTokens.accessToken}`);
  }

  return requestWithTimeout(url, {
    ...init,
    headers: retryHeaders,
  }, parseResponse<T>);
}

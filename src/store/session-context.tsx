import { ApiRequestError } from "@/src/lib/api/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import {
  getCurrentAuth,
  getProfileSettings,
  loginMobile,
  logoutMobile,
  registerCustomerMobile,
  updateNotificationPreferences as updateNotificationPreferencesRequest,
  updateProfileSettings,
} from "@/src/lib/api/auth";
import {
  clearAuthTokens,
  getAuthTokens,
  setAuthFailureHandler,
  setAuthTokenChangeHandler,
  setAuthTokens,
} from "@/src/lib/api/client";
import { clearStoredTokens, loadStoredTokens, saveStoredTokens } from "@/src/lib/api/storage";
import type {
  AuthResponseData,
  LoginPayload,
  ProfileSettings,
  RegisterCustomerPayload,
  UpdateNotificationPreferencesPayload,
  UpdateProfilePayload,
} from "@/src/lib/api/types";
import type { BookMizSession, PersonaMode, SessionRole } from "@/src/types/mobile";

type SessionContextValue = BookMizSession & {
  profile: ProfileSettings | null;
  isHydrating: boolean;
  authError: string | null;
  canUseAgentMode: boolean;
  switchPersona: (persona: PersonaMode) => void;
  signIn: (payload: LoginPayload) => Promise<void>;
  signUp: (payload: RegisterCustomerPayload) => Promise<void>;
  applyAuthResponse: (auth: AuthResponseData) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<ProfileSettings>;
  updateNotificationPreferences: (
    payload: UpdateNotificationPreferencesPayload,
  ) => Promise<ProfileSettings>;
  clearAuthError: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function toSessionRoles(roles: string[]): SessionRole[] {
  const nextRoles = new Set<SessionRole>();

  for (const role of roles) {
    if (role === "CUSTOMER") {
      nextRoles.add("CUSTOMER");
    }

    if (role === "PLATFORM_AGENT" || role === "SUPER_ADMIN" || role === "AGENT") {
      nextRoles.add("AGENT");
    }
  }

  return Array.from(nextRoles);
}

function buildSessionUser(
  user:
    | {
        id: string;
        email: string;
        userType: string;
        firstName: string;
        lastName: string;
        roles: string[];
      }
    | null,
  profile: ProfileSettings | null,
) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    userType: user.userType,
    firstName: profile?.firstName ?? user.firstName,
    lastName: profile?.lastName ?? user.lastName,
    city: profile?.city ?? null,
    stateCode: profile?.stateCode ?? null,
    roles: toSessionRoles(user.roles),
  };
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<BookMizSession["user"]>(null);
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [activePersona, setActivePersona] = useState<PersonaMode>("customer");
  const [isHydrating, setIsHydrating] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearSessionState = useCallback(async (errorMessage?: string | null) => {
    setUser(null);
    setProfile(null);
    setActivePersona("customer");
    setAuthError(errorMessage ?? null);
    try { await clearAuthTokens(); }
    catch { setAuthError("Could not clear saved sign-in details. Please restart and sign out again."); }
  }, []);

  const hydrateCurrentUser = useCallback(async () => {
    const [auth, nextProfile] = await Promise.all([
      getCurrentAuth(),
      getProfileSettings(),
    ]);

    setProfile(nextProfile);
    setUser(buildSessionUser(auth.user, nextProfile));
    setActivePersona("customer");
    setAuthError(null);
  }, []);

  useEffect(() => {
    setAuthTokenChangeHandler(async (tokens) => {
      if (tokens) {
        await saveStoredTokens(tokens);
        return;
      }

      await clearStoredTokens();
    });

    return () => {
      setAuthTokenChangeHandler(null);
    };
  }, []);

  useEffect(() => {
    setAuthFailureHandler(async () => {
      await clearSessionState("Your session expired. Please sign in again.");
    });

    return () => {
      setAuthFailureHandler(null);
    };
  }, [clearSessionState]);

  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      try {
      const storedTokens = await loadStoredTokens();

      if (!storedTokens) {
        if (isActive) {
          setIsHydrating(false);
        }
        return;
      }

      await setAuthTokens(storedTokens);
        await hydrateCurrentUser();
      } catch (error) {
        if (error instanceof ApiRequestError && [401, 403].includes(error.statusCode ?? 0)) await clearSessionState();
        else setAuthError("Could not connect. Your saved session is retained; try again when online.");
      } finally {
        if (isActive) {
          setIsHydrating(false);
        }
      }
    };

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, [clearSessionState, hydrateCurrentUser]);

  const applyAuthResponse = useCallback(
    async (auth: AuthResponseData) => {
      await setAuthTokens({
        accessToken: auth.session.accessToken,
        refreshToken: auth.session.refreshToken,
      });

      try {
        await hydrateCurrentUser();
      } catch {
        setUser(buildSessionUser(auth.user, null));
        setProfile(null);
      }
    },
    [hydrateCurrentUser],
  );

  const signIn = useCallback(
    async (payload: LoginPayload) => {
      setAuthError(null);
      try {
        const auth = await loginMobile(payload);
        await applyAuthResponse(auth);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Unable to sign in.");
        throw error;
      }
    },
    [applyAuthResponse],
  );

  const signUp = useCallback(
    async (payload: RegisterCustomerPayload) => {
      setAuthError(null);
      try {
        const auth = await registerCustomerMobile(payload);
        await applyAuthResponse(auth);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Unable to create your account.");
        throw error;
      }
    },
    [applyAuthResponse],
  );

  const signOut = useCallback(async () => {
    const refreshToken = getAuthTokens()?.refreshToken;

    try {
      if (refreshToken) {
        await logoutMobile(refreshToken);
      }
    } catch {
      // Local session teardown should still happen even if the network call fails.
    } finally {
      await clearSessionState();
    }
  }, [clearSessionState]);

  const refreshProfile = useCallback(async () => {
    await hydrateCurrentUser();
  }, [hydrateCurrentUser]);

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      const nextProfile = await updateProfileSettings(payload);
      setProfile(nextProfile);
      setUser((currentUser) =>
        currentUser
          ? {
              ...currentUser,
              firstName: nextProfile.firstName,
              lastName: nextProfile.lastName,
              city: nextProfile.city,
              stateCode: nextProfile.stateCode,
            }
          : currentUser,
      );
      return nextProfile;
    },
    [],
  );

  const updateNotificationPreferences = useCallback(
    async (payload: UpdateNotificationPreferencesPayload) => {
      const nextProfile = await updateNotificationPreferencesRequest(payload);
      setProfile(nextProfile);
      return nextProfile;
    },
    [],
  );

  const canUseAgentMode = Boolean(user?.roles.includes("AGENT"));

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      profile,
      isSignedIn: Boolean(user),
      activePersona,
      isHydrating,
      authError,
      canUseAgentMode,
      switchPersona: (persona) => {
        if (persona === "agent" && !canUseAgentMode) {
          setActivePersona("customer");
          return;
        }

        setActivePersona(persona);
      },
      signIn,
      signUp,
      applyAuthResponse,
      signOut,
      refreshProfile,
      updateProfile,
      updateNotificationPreferences,
      clearAuthError: () => setAuthError(null),
    }),
    [
      activePersona,
      authError,
      canUseAgentMode,
      isHydrating,
      refreshProfile,
      signIn,
      signOut,
      signUp,
      applyAuthResponse,
      updateNotificationPreferences,
      updateProfile,
      user,
      profile,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within SessionProvider.");
  }

  return context;
}

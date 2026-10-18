import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Screen } from "@/src/components/Screen";
import { AuthButton } from "@/src/components/auth/AuthButton";
import { AuthField } from "@/src/components/auth/AuthField";
import { useSession } from "@/src/store/session-context";
import {
  changeMobilePassword,
  getAccountDeletionRequest,
  requestAccountDeletion,
  withdrawAccountDeletion,
  type AccountDeletionRequest,
  sendEmailVerification,
  confirmEmailVerification,
  getSecuritySummary,
  listSecuritySessions,
  revokeAllSecuritySessions,
  revokeSecuritySession,
  setupMobileMfa,
  updateMobileMfa,
  type SecuritySession,
} from "@/src/lib/api/auth";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import { tokens } from "@/src/theme/tokens";

export function SecurityScreen() {
  const session = useSession(),
    router = useRouter();
  const [sessions, setSessions] = useState<SecuritySession[]>([]);
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [deletion, setDeletion] = useState<AccountDeletionRequest | null>(null);
  const [deletionLoaded, setDeletionLoaded] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null);
  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await operation();
    } catch (reason) {
      setError(
        getFriendlyApiError(reason, "Could not update security settings."),
      );
    } finally {
      setBusy(false);
    }
  };
  const load = useCallback(async () => {
    const [summary, devices] = await Promise.all([
      getSecuritySummary(),
      listSecuritySessions(),
    ]);
    setMfaEnabled(summary.mfaEnabled);
    setSessions(devices);
  }, []);
  useEffect(() => {
    let active = true;
    if (session.isSignedIn)
      void getAccountDeletionRequest()
        .then((request) => {
          if (active) {
            setDeletion(request);
            setDeletionLoaded(true);
          }
        })
        .catch((reason) => {
          if (active)
            setError(
              getFriendlyApiError(
                reason,
                "Could not load deletion-request status.",
              ),
            );
        });
    return () => {
      active = false;
    };
  }, [session.isSignedIn, session.user?.id]);
  useEffect(() => {
    if (session.isSignedIn)
      void load().catch((reason) =>
        setError(
          getFriendlyApiError(reason, "Could not load security settings."),
        ),
      );
  }, [load, session.isSignedIn]);
  if (session.isHydrating) return null;
  if (!session.isSignedIn) return <Redirect href="/login" />;
  const verify = (action: "enable" | "disable" | "recovery-codes/regenerate") =>
    run(async () => {
      const result = await updateMobileMfa(action, code, recoveryCode);
      setRecoveryCodes(result.recoveryCodes ?? []);
      setCode("");
      setRecoveryCode("");
      setSecret("");
      setMessage(result.message);
      await load();
    });
  return (
    <Screen title="Security">
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.copy}>
          {message}
        </Text>
      ) : null}
      <AuthButton
        label="Refresh security settings"
        variant="secondary"
        disabled={busy}
        onPress={() => run(load)}
      />
      {!session.user?.emailVerified ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.title}>
            Verify your email
          </Text>
          <Text style={styles.copy}>
            Verify your email to access updates sent to that address.
          </Text>
          <AuthButton
            label="Send verification code"
            variant="secondary"
            disabled={busy}
            onPress={() =>
              run(async () => {
                await sendEmailVerification();
                setMessage("Verification code sent. Check your email.");
              })
            }
          />
          <AuthField
            label="Email verification code"
            value={emailCode}
            onChangeText={setEmailCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
          />
          <AuthButton
            label="Verify email"
            disabled={busy || !/^\d{6}$/.test(emailCode)}
            onPress={() =>
              run(async () => {
                if (!session.user) return;
                await confirmEmailVerification(session.user.email, emailCode);
                await session.refreshProfile();
                setEmailCode("");
                setMessage("Email verified.");
              })
            }
          />
        </View>
      ) : null}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.title}>
          Change password
        </Text>
        <AuthField
          label="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoComplete="password"
        />
        <AuthField
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <AuthField
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <Text style={styles.copy}>
          Changing your password signs out your other sessions.
        </Text>
        <AuthButton
          label="Change password"
          disabled={
            busy ||
            currentPassword.length < 8 ||
            newPassword.length < 8 ||
            newPassword !== confirmPassword
          }
          onPress={() =>
            run(async () => {
              const result = await changeMobilePassword(
                currentPassword,
                newPassword,
              );
              await session.applyAuthResponse(result);
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
              setMessage("Password changed.");
              await load();
            })
          }
        />
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.title}>
          Authenticator protection
        </Text>
        <Text style={styles.copy}>
          {mfaEnabled === null
            ? "Status unavailable"
            : mfaEnabled
              ? "MFA is enabled"
              : "MFA is off"}
        </Text>
        {mfaEnabled === false && !secret ? (
          <AuthButton
            label="Set up authenticator"
            variant="secondary"
            disabled={busy}
            onPress={() =>
              run(async () => {
                const result = await setupMobileMfa();
                setSecret(result.secret);
              })
            }
          />
        ) : null}
        {secret ? (
          <>
            <Text style={styles.copy}>
              Add this secret to your authenticator, then enter its current
              code. Keep this secret private.
            </Text>
            <Text selectable style={styles.copy}>
              {secret}
            </Text>
          </>
        ) : null}
        {secret || mfaEnabled ? (
          <>
            <AuthField
              label="Authenticator code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
            />
            {mfaEnabled ? (
              <AuthField
                label="Recovery code instead"
                value={recoveryCode}
                onChangeText={setRecoveryCode}
              />
            ) : null}
            {secret ? (
              <AuthButton
                label="Enable MFA"
                disabled={busy || code.trim().length < 6}
                onPress={() => verify("enable")}
              />
            ) : null}
            {mfaEnabled ? (
              <>
                <AuthButton
                  label="Generate new recovery codes"
                  variant="secondary"
                  disabled={busy || (!code.trim() && !recoveryCode.trim())}
                  onPress={() => verify("recovery-codes/regenerate")}
                />
                <AuthButton
                  label="Disable MFA"
                  variant="secondary"
                  disabled={busy || (!code.trim() && !recoveryCode.trim())}
                  onPress={() =>
                    Alert.alert(
                      "Disable MFA?",
                      "This removes authenticator protection from your account.",
                      [
                        { text: "Keep enabled", style: "cancel" },
                        {
                          text: "Disable",
                          style: "destructive",
                          onPress: () => void verify("disable"),
                        },
                      ],
                    )
                  }
                />
              </>
            ) : null}
          </>
        ) : null}
        {recoveryCodes.length ? (
          <>
            <Text style={styles.copy}>
              Save these one-time recovery codes somewhere private. They are
              only shown now.
            </Text>
            <Text selectable style={styles.copy}>
              {recoveryCodes.join("\n")}
            </Text>
            <AuthButton
              label="I saved my recovery codes"
              variant="secondary"
              onPress={() => setRecoveryCodes([])}
            />
          </>
        ) : null}
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.title}>
          Signed-in devices
        </Text>
        {sessions.map((device) => (
          <View key={device.id} style={styles.section}>
            <Text style={styles.copy}>
              {device.sessionName || device.userAgent || "Device session"}
            </Text>
            <Text style={styles.copy}>
              Last used{" "}
              {new Date(device.lastUsedAt || device.createdAt).toLocaleString()}
            </Text>
            <AuthButton
              label="Revoke this session"
              variant="secondary"
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  "Revoke session?",
                  "If this is your current device, you may need to sign in again.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Revoke",
                      style: "destructive",
                      onPress: () =>
                        void run(async () => {
                          await revokeSecuritySession(device.id);
                          await load();
                        }),
                    },
                  ],
                )
              }
            />
          </View>
        ))}
        <AuthButton
          label="Sign out all devices"
          variant="secondary"
          disabled={busy}
          onPress={() =>
            Alert.alert("Sign out all devices?", "This includes this device.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign out all",
                style: "destructive",
                onPress: () =>
                  void run(async () => {
                    await revokeAllSecuritySessions();
                    await session.signOut();
                    router.replace("/login");
                  }),
              },
            ])
          }
        />
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.title}>
          Delete account
        </Text>
        <Text style={styles.copy}>
          Submit a tracked request for review. Your account stays active during
          review. Outstanding bookings, refunds and payouts must be resolved;
          financial records may need to be retained.
        </Text>
        {deletion && deletion.status !== "CANCELLED" ? (
          <>
            <Text style={styles.copy}>
              {deletion.status === "IN_REVIEW"
                ? "Under review"
                : "Awaiting review"}{" "}
              · Requested {new Date(deletion.requestedAt).toLocaleDateString()}
            </Text>
            <Text selectable style={styles.copy}>
              Reference: {deletion.id}
            </Text>
            <AuthButton
              label="Withdraw deletion request"
              variant="secondary"
              disabled={busy}
              onPress={() =>
                run(async () => {
                  setDeletion(await withdrawAccountDeletion());
                  setMessage("Deletion request withdrawn.");
                })
              }
            />
          </>
        ) : (
          <AuthButton
            label="Request account deletion"
            variant="secondary"
            disabled={busy || !deletionLoaded}
            onPress={() =>
              Alert.alert(
                "Request account deletion?",
                "This sends your request for review. It does not immediately delete your account or cancel bookings.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Submit request",
                    style: "destructive",
                    onPress: () =>
                      void run(async () => {
                        setDeletion(await requestAccountDeletion());
                        setMessage(
                          "Deletion request received. You can track its status here.",
                        );
                      }),
                  },
                ],
              )
            }
          />
        )}
        {!deletionLoaded ? (
          <AuthButton
            label="Load deletion-request status"
            variant="secondary"
            disabled={busy}
            onPress={() =>
              run(async () => {
                setDeletion(await getAccountDeletionRequest());
                setDeletionLoaded(true);
              })
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  section: { gap: 12, paddingVertical: 8 },
  title: {
    fontSize: 18,
    fontFamily: tokens.font.bold,
    color: tokens.colors.ink,
  },
  copy: { fontSize: 14, lineHeight: 21, color: tokens.colors.ink },
  error: { color: tokens.colors.danger, fontSize: 14 },
});

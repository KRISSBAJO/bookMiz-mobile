import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { requireOptionalNativeModule } from 'expo';
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { AuthButton } from "@/src/components/auth/AuthButton";
import { tokens } from "@/src/theme/tokens";

export function AppUpdatesPanel() {
  const { isUpdatePending } = Updates.useUpdates();
  const [phase, setPhase] = useState<
    "idle" | "checking" | "downloading" | "ready" | "restarting"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const inFlight = useRef(false);
  const canUpdate = Platform.OS !== "web" && !__DEV__ && Updates.isEnabled;
  const ready = phase === "ready" || isUpdatePending;
  const busy =
    phase === "checking" || phase === "downloading" || phase === "restarting";
  const application = requireOptionalNativeModule<{ nativeApplicationVersion?: string; nativeBuildVersion?: string }>('ExpoApplication');
  const version = application?.nativeApplicationVersion || Constants.expoConfig?.version || "—";
  const build = application?.nativeBuildVersion;

  async function check() {
    if (inFlight.current || !canUpdate) return;
    inFlight.current = true;
    setError(false);
    setMessage(null);
    setPhase("checking");
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable && !result.isRollBackToEmbedded) {
        setMessage(
          "You have the latest update available for this version of BookMiz.",
        );
        setPhase("idle");
        return;
      }
      setPhase("downloading");
      const downloaded = await Updates.fetchUpdateAsync();
      if (!downloaded.isNew && !downloaded.isRollBackToEmbedded) {
        setMessage("No new update was downloaded. Try checking again shortly.");
        setPhase("idle");
        return;
      }
      setPhase("ready");
      setMessage(
        "Update downloaded. Save your work, then restart BookMiz to apply it.",
      );
    } catch {
      setError(true);
      setMessage(
        "Could not check or download updates. Check your connection and try again.",
      );
      setPhase("idle");
    } finally {
      inFlight.current = false;
    }
  }

  async function restart() {
    if (inFlight.current || !canUpdate || !ready) return;
    inFlight.current = true;
    setError(false);
    setPhase("restarting");
    try {
      await Updates.reloadAsync();
    } catch {
      inFlight.current = false;
      setPhase("ready");
      setError(true);
      setMessage(
        "Could not restart BookMiz. Your update is saved. Close and reopen the app, or try again.",
      );
    }
  }

  const status = !canUpdate
    ? Platform.OS === "web"
      ? "Refresh your browser to load the latest website. App updates are available in the installed iPhone and Android apps."
      : "Updates can be checked in a compatible installed release. This development preview cannot download app updates."
    : message ||
      (ready
        ? "An update is ready. Save your work before restarting BookMiz."
        : null);
  const label =
    phase === "checking"
      ? "Checking for updates…"
      : phase === "downloading"
        ? "Downloading update…"
        : phase === "restarting"
          ? "Restarting…"
          : ready
            ? "Restart to update"
            : "Check for updates";

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        App updates
      </Text>
      <Text style={styles.copy}>
        Small improvements download securely. Restart when you’re ready to apply
        them. New features may require an App Store or Google Play update.
      </Text>
      <Text style={styles.version}>Version {version}{build ? ` · Build ${build}` : ''}</Text>
      <Text style={styles.version}>Account refresh 2</Text>
      {Updates.isEmergencyLaunch ? <Text accessibilityRole="alert" style={styles.error}>BookMiz opened its saved version because an update could not start.</Text> : null}
      {status ? (
        <Text
          accessibilityRole={error ? "alert" : undefined}
          accessibilityLiveRegion="polite"
          style={[styles.copy, error ? styles.error : null]}
        >
          {status}
        </Text>
      ) : null}
      <AuthButton
        label={label}
        variant="secondary"
        disabled={!canUpdate || busy}
        onPress={ready ? restart : check}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Update details" accessibilityState={{ expanded: showDetails }} onPress={() => setShowDetails(value => !value)} style={styles.detailsButton}>
        <Text style={styles.version}>{showDetails ? 'Hide update details' : 'Show update details'}</Text>
      </Pressable>
      {showDetails ? <Text selectable style={styles.version}>Channel: {Updates.channel ?? 'Unavailable'}{'\n'}Runtime: {Updates.runtimeVersion ?? 'Unavailable'}{'\n'}Update: {Updates.updateId ?? 'Bundled version'}{'\n'}Source: {Updates.isEmbeddedLaunch ? 'Installed app' : 'Downloaded update'}{Updates.isEmergencyLaunch ? `\nRecovery: ${Updates.emergencyLaunchReason ?? 'Startup failed'}` : ''}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  detailsButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  section: { paddingVertical: 8, gap: 12 },
  title: {
    fontFamily: tokens.font.semibold,
    fontSize: 17,
    color: tokens.colors.ink,
  },
  copy: {
    fontFamily: tokens.font.regular,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.muted,
  },
  version: {
    fontFamily: tokens.font.regular,
    fontSize: 12,
    color: tokens.colors.muted,
  },
  error: { color: tokens.colors.danger },
});

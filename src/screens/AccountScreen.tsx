import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FontAwesome6 } from "@expo/vector-icons";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { PersonaSwitcher } from "@/src/components/PersonaSwitcher";
import { Screen } from "@/src/components/Screen";
import { AppUpdatesPanel } from "@/src/components/AppUpdatesPanel";
import { ProfileLocationPicker } from "@/src/components/ProfileLocationPicker";
import { ProfilePhotoEditor } from "@/src/components/ProfilePhotoEditor";
import type { ProfileLocation } from "@/src/lib/api/geography";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import type { NotificationPreferences } from "@/src/lib/api/types";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";
import {
  enablePush,
  disablePush,
  getPushRegistration,
} from "@/src/lib/mobile-push";

type IconName = React.ComponentProps<typeof FontAwesome6>["name"];

type NotificationKey =
  | "emailQuoteResponses"
  | "emailAppointmentReminders"
  | "smsAppointmentReminders"
  | "emailSavedProviderUpdates";

const notificationLabels: Array<{
  key: NotificationKey;
  title: string;
  caption: string;
}> = [
  {
    key: "emailQuoteResponses",
    title: "Quote replies",
    caption: "Email when a provider answers a request.",
  },
  {
    key: "emailAppointmentReminders",
    title: "Appointment reminders",
    caption: "Email before each booking.",
  },
  {
    key: "smsAppointmentReminders",
    title: "Text reminders",
    caption: "SMS before each booking.",
  },
  {
    key: "emailSavedProviderUpdates",
    title: "Saved provider updates",
    caption: "Email when a saved provider adds something new.",
  },
];

function initialsFor(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
) {
  const letters = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return letters || (email ?? "B").slice(0, 2).toUpperCase();
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  danger = false,
  last = false,
  accessibilityLabel,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
  accessibilityLabel?: string;
}) {
  const color = danger ? tokens.colors.danger : tokens.colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        last ? null : styles.rowDivider,
        pressed ? styles.rowPressed : null,
      ]}
    >
      <View style={[styles.rowIcon, danger ? styles.rowIconDanger : null]}>
        <FontAwesome6 name={icon} size={16} color={color} />
      </View>
      <Text
        style={[styles.rowLabel, danger ? styles.rowLabelDanger : null]}
      >
        {label}
      </Text>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <FontAwesome6
        name="chevron-right"
        size={14}
        color={danger ? tokens.colors.danger : tokens.colors.mutedSoft}
      />
    </Pressable>
  );
}

export function AccountScreen() {
  const router = useRouter();
  const session = useSession();
  const user = session.user;
  const profile = session.profile;
  const [firstName, setFirstName] = useState(
    profile?.firstName ?? user?.firstName ?? "",
  );
  const [lastName, setLastName] = useState(
    profile?.lastName ?? user?.lastName ?? "",
  );
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [locationDraft, setLocationDraft] = useState<ProfileLocation>({
    city: profile?.city ?? user?.city ?? "",
    stateCode: profile?.stateCode ?? user?.stateCode ?? "",
    countryCode: profile?.countryCode ?? "",
    homeLatitude: profile?.homeLatitude ?? null,
    homeLongitude: profile?.homeLongitude ?? null,
  });
  const [locationChanged, setLocationChanged] = useState(false);
  const [locationValid, setLocationValid] = useState(true);
  const [notificationState, setNotificationState] =
    useState<NotificationPreferences | null>(
      profile?.notificationPreferences ?? null,
    );
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingNotifications, setIsEditingNotifications] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void getPushRegistration()
      .then((saved) => {
        if (active) setPushEnabled(Boolean(user?.id && saved?.userId === user.id));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (isEditingProfile) return;
    setFirstName(profile?.firstName ?? user?.firstName ?? "");
    setLastName(profile?.lastName ?? user?.lastName ?? "");
    setPhone(profile?.phone ?? "");
    setLocationDraft({ city: profile?.city ?? user?.city ?? "", stateCode: profile?.stateCode ?? user?.stateCode ?? "", countryCode: profile?.countryCode ?? "", homeLatitude: profile?.homeLatitude ?? null, homeLongitude: profile?.homeLongitude ?? null });
    setLocationChanged(false);
    setLocationValid(true);
  }, [profile, user, isEditingProfile]);
  useEffect(() => {
    if (!isEditingNotifications)
      setNotificationState(profile?.notificationPreferences ?? null);
  }, [profile?.notificationPreferences, isEditingNotifications]);

  const canSaveProfile = useMemo(
    () => firstName.trim().length > 0 && lastName.trim().length > 0 && locationValid,
    [firstName, lastName, locationValid],
  );

  const fullName = [
    profile?.firstName ?? user?.firstName,
    profile?.lastName ?? user?.lastName,
  ]
    .filter(Boolean)
    .join(" ");
  const email = profile?.email ?? user?.email ?? "";
  const locationLabel = [
    profile?.city ?? user?.city,
    profile?.stateCode ?? user?.stateCode,
    profile?.countryCode,
  ]
    .filter(Boolean)
    .join(", ");
  const enabledNotifications = notificationLabels.filter(
    (item) => notificationState?.[item.key],
  ).length;

  return (
    <Screen title="Account" showBack={false}>
      <View style={styles.accountContent}>
      {user ? <ProfilePhotoEditor key={user.id} userId={user.id} photoUrl={profile?.avatarUrl}
        fullName={fullName} email={email} initials={initialsFor(user.firstName, user.lastName, email)}
        onSaved={session.refreshProfile} /> : null}

      {session.canUseAgentMode ? (
        <View style={styles.personaPanel}>
          <Text style={styles.personaTitle}>Workspace mode</Text>
          <Text style={styles.personaCaption}>
            Switch between the customer app and your agent desk.
          </Text>
          {user?.userType !== "CUSTOMER" ? (
            <Text style={styles.personaCaption}>
              Customer mode lets you browse. To book for yourself, sign in with
              a customer account.
            </Text>
          ) : null}
          <View style={styles.personaSwitcherWrap}>
            <PersonaSwitcher
              activePersona={session.activePersona}
              canUseAgentMode={session.canUseAgentMode}
              onChange={session.switchPersona}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.profileSection}>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingCopy}>
            <Text style={styles.editorTitle} accessibilityRole="header">Personal information</Text>
            <Text style={styles.detailLabel}>Your contact details for bookings</Text>
          </View>
          {!isEditingProfile ? (
            <AuthButton label="Edit profile" icon="pen-to-square" variant="secondary"
              style={styles.editProfileButton} onPress={() => setIsEditingProfile(true)} />
          ) : null}
        </View>
        {!isEditingProfile ? <View>
        {[
          { label: "Email", value: email || "Not provided" },
          { label: "Phone", value: profile?.phone || "Add a phone number" },
          { label: "Location", value: locationLabel || "Add your city" },
        ].map((item) => (
          <View key={item.label} style={styles.profileDetail}>
            <Text style={styles.detailLabel}>{item.label}</Text>
            <Text selectable style={styles.detailValue}>
              {item.value}
            </Text>
          </View>
        ))}
        </View> : null}
      </View>

      {isEditingProfile ? (
        <View style={styles.editor}>
          <Text style={styles.editorTitle}>Edit profile</Text>

          <View style={styles.fieldRow}>
            <View style={styles.column}>
              <Text style={styles.fieldLabel}>First name</Text>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                style={styles.fieldInput}
                placeholder="First name"
                placeholderTextColor={tokens.colors.mutedSoft}
                accessibilityLabel="First name"
              />
            </View>
            <View style={styles.column}>
              <Text style={styles.fieldLabel}>Last name</Text>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                style={styles.fieldInput}
                placeholder="Last name"
                placeholderTextColor={tokens.colors.mutedSoft}
                accessibilityLabel="Last name"
              />
            </View>
          </View>

          <View style={styles.column}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              style={styles.fieldInput}
              placeholder="+1 (555) 555-0101"
              placeholderTextColor={tokens.colors.mutedSoft}
              keyboardType="phone-pad"
              accessibilityLabel="Phone"
            />
          </View>

          <ProfileLocationPicker value={locationDraft} onChange={(value, valid) => {
            setLocationDraft(value);
            setLocationChanged(true);
            setLocationValid(valid);
          }} />
          {!locationValid ? <Text style={styles.detailLabel}>Choose a country, state or region, and city to finish changing your location.</Text> : null}

          <View style={styles.editorActions}>
            <AuthButton
              label="Cancel"
              variant="secondary"
              style={styles.editorActionButton}
              onPress={() => setIsEditingProfile(false)}
            />
            <AuthButton
              label="Save"
              style={styles.editorActionButton}
              loading={isSavingProfile}
              disabled={!canSaveProfile || isSavingProfile}
              onPress={async () => {
                try {
                  setError(null);
                  setIsSavingProfile(true);
                  await session.updateProfile({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    phone: phone.trim() || undefined,
                    ...(locationChanged ? locationDraft : {}),
                  });
                  setIsEditingProfile(false);
                } catch (nextError) {
                  const message = getFriendlyApiError(
                    nextError,
                    "We could not save your profile.",
                  );
                  setError(message);
                } finally {
                  setIsSavingProfile(false);
                }
              }}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.group}>
        <SettingsRow
          icon="bell"
          label="Notifications"
          value={notificationState ? `${enabledNotifications} on` : undefined}
          onPress={() => setIsEditingNotifications((current) => !current)}
          last
        />
      </View>

      {isEditingNotifications ? (
        <View style={styles.editor}>
          <Text style={styles.editorTitle}>Notifications</Text>
          <View style={styles.preferenceList}>
            {notificationLabels.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.preferenceRow,
                  index < notificationLabels.length - 1
                    ? styles.rowDivider
                    : null,
                ]}
              >
                <View style={styles.preferenceCopy}>
                  <Text style={styles.preferenceTitle}>{item.title}</Text>
                  <Text style={styles.preferenceCaption}>{item.caption}</Text>
                </View>
                <Switch
                  value={notificationState?.[item.key] ?? false}
                  disabled={!isEditingNotifications}
                  onValueChange={(value) =>
                    setNotificationState((current) =>
                      current ? { ...current, [item.key]: value } : current,
                    )
                  }
                  trackColor={{
                    false: tokens.colors.borderStrong,
                    true: tokens.colors.brand,
                  }}
                  thumbColor="#ffffff"
                  accessibilityLabel={item.title}
                />
              </View>
            ))}
          </View>

          <AuthButton
            label="Save"
            loading={isSavingNotifications}
            disabled={
              !notificationState ||
              isSavingNotifications ||
              !isEditingNotifications
            }
            onPress={async () => {
              if (!notificationState) {
                return;
              }

              try {
                setError(null);
                setIsSavingNotifications(true);
                await session.updateNotificationPreferences(notificationState);
                setIsEditingNotifications(false);
              } catch (nextError) {
                const message = getFriendlyApiError(
                  nextError,
                  "We could not save your notification settings.",
                );
                setError(message);
              } finally {
                setIsSavingNotifications(false);
              }
            }}
          />
          <AuthButton
            label="Cancel notification changes"
            variant="secondary"
            disabled={isSavingNotifications}
            onPress={() => setIsEditingNotifications(false)}
          />
        </View>
      ) : null}

      <View style={styles.group}>
        <SettingsRow
          icon="calendar-days"
          label="Appointments"
          onPress={() => router.push("/appointments")}
        />
        <SettingsRow
          icon="heart"
          label="Saved providers"
          onPress={() => router.push("/saved-providers")}
          last
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        </View>
      ) : null}

      <View style={styles.profileSection}>
        <View style={styles.sectionHeading}>
          <Text accessibilityRole="header" style={styles.editorTitle}>Device notifications</Text>
          <View style={[styles.statusBadge, pushEnabled ? styles.statusBadgeEnabled : null]}>
            <View style={[styles.statusDot, pushEnabled ? styles.statusDotEnabled : null]} />
            <Text style={styles.statusText}>{pushEnabled ? "Enabled" : "Off"}</Text>
          </View>
        </View>
        <Text style={styles.detailLabel}>
          Receive private activity alerts on this device. Message and payment
          details stay inside BookMiz.
        </Text>
        <AuthButton
          label={
            pushEnabled
              ? "Disable device notifications"
              : "Enable device notifications"
          }
          variant="secondary"
          style={styles.deviceButton}
          loading={pushBusy}
          disabled={pushBusy}
          onPress={async () => {
            if (!user) return;
            setPushBusy(true);
            setError(null);
            try {
              if (pushEnabled) await disablePush(user.id);
              else await enablePush(user.id);
              setPushEnabled(!pushEnabled);
            } catch (reason) {
              setError(
                getFriendlyApiError(
                  reason,
                  "Could not update device notifications. Check your device settings and try again.",
                ),
              );
            } finally {
              setPushBusy(false);
            }
          }}
        />
      </View>
      <View style={styles.group}>
        <SettingsRow
          icon="shield-halved"
          label="Security and signed-in devices"
          onPress={() => router.push("./security")}
          last
        />
      </View>
      <View style={styles.group}>
        <SettingsRow
          icon="arrow-right-from-bracket"
          label="Log out"
          danger
          last
          onPress={async () => {
            await session.signOut();
            router.replace("/welcome");
          }}
        />
      </View>
      <AppUpdatesPanel />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountContent: { width: "100%", maxWidth: 640, alignSelf: "center", gap: 16 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  sectionHeadingCopy: { gap: 4, flexShrink: 1 },
  deviceButton: { alignSelf: "flex-start", minHeight: 44, borderRadius: 10 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: tokens.colors.surfaceSoft },
  statusBadgeEnabled: { backgroundColor: tokens.colors.brandSoft },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.colors.muted },
  statusDotEnabled: { backgroundColor: "#247344" },
  statusText: { fontSize: 12, fontFamily: tokens.font.medium, color: tokens.colors.ink },
  profileSection: {
    gap: 12,
    paddingVertical: 12,
  },
  profileDetail: {
    gap: 3,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  detailLabel: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: tokens.font.regular,
  },
  detailValue: {
    color: tokens.colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: tokens.font.medium,
    flexShrink: 1,
  },
  editProfileButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    borderRadius: tokens.radius.sm,
    backgroundColor: "#ffffff",
    borderColor: tokens.colors.borderStrong,
    paddingHorizontal: 14,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.inkDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontFamily: tokens.font.bold,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  identityName: {
    color: tokens.colors.ink,
    fontSize: 21,
    fontFamily: tokens.font.display,
    letterSpacing: -0.3,
  },
  identityEmail: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  personaPanel: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.inkDeep,
    padding: 18,
    gap: 6,
  },
  personaTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: tokens.font.display,
    letterSpacing: -0.3,
  },
  personaCaption: {
    color: tokens.colors.onNavyMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
  personaSwitcherWrap: {
    paddingTop: 8,
  },
  group: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 16,
  },
  row: {
    minHeight: 56,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: tokens.colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDanger: {
    backgroundColor: tokens.colors.dangerSoft,
  },
  rowLabel: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.semibold,
  },
  rowLabelDanger: {
    color: tokens.colors.danger,
  },
  rowValue: {
    maxWidth: "45%",
    color: tokens.colors.muted,
    fontSize: 14,
    fontFamily: tokens.font.regular,
  },
  editor: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 14,
  },
  editorTitle: {
    color: tokens.colors.ink,
    fontSize: 17,
    fontFamily: tokens.font.display,
    letterSpacing: -0.3,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  columnNarrow: {
    width: 96,
    gap: 8,
  },
  fieldLabel: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  fieldInput: {
    height: 52,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: 16,
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.regular,
  },
  editorActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  editorActionButton: {
    flex: 1,
    minHeight: 48,
  },
  preferenceList: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  preferenceCopy: {
    flex: 1,
    gap: 2,
  },
  preferenceTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.semibold,
  },
  preferenceCaption: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
  },
  errorBox: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: "#f3c4c4",
    backgroundColor: tokens.colors.dangerSoft,
    padding: 14,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
});

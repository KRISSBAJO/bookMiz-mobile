import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FontAwesome6 } from "@expo/vector-icons";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { PersonaSwitcher } from "@/src/components/PersonaSwitcher";
import { Screen } from "@/src/components/Screen";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import type { NotificationPreferences } from "@/src/lib/api/types";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

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

function initialsFor(firstName?: string | null, lastName?: string | null, email?: string | null) {
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
      <Text style={[styles.rowLabel, danger ? styles.rowLabelDanger : null]} numberOfLines={1}>
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
  const [firstName, setFirstName] = useState(profile?.firstName ?? user?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? user?.lastName ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [city, setCity] = useState(profile?.city ?? user?.city ?? "");
  const [stateCode, setStateCode] = useState(profile?.stateCode ?? user?.stateCode ?? "");
  const [notificationState, setNotificationState] = useState<NotificationPreferences | null>(
    profile?.notificationPreferences ?? null,
  );
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingNotifications, setIsEditingNotifications] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(profile?.firstName ?? user?.firstName ?? "");
    setLastName(profile?.lastName ?? user?.lastName ?? "");
    setPhone(profile?.phone ?? "");
    setCity(profile?.city ?? user?.city ?? "");
    setStateCode(profile?.stateCode ?? user?.stateCode ?? "");
    setNotificationState(profile?.notificationPreferences ?? null);
  }, [profile, user]);

  const canSaveProfile = useMemo(
    () => firstName.trim().length > 0 && lastName.trim().length > 0,
    [firstName, lastName],
  );

  const fullName = [profile?.firstName ?? user?.firstName, profile?.lastName ?? user?.lastName].filter(Boolean).join(" ");
  const email = profile?.email ?? user?.email ?? "";
  const locationLabel = [profile?.city ?? user?.city, profile?.stateCode ?? user?.stateCode].filter(Boolean).join(", ");
  const enabledNotifications = notificationLabels.filter(
    (item) => notificationState?.[item.key],
  ).length;

  return (
    <Screen title="Account" showBack={false}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {initialsFor(user?.firstName, user?.lastName, email)}
          </Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.identityName} numberOfLines={1}>
            {fullName}
          </Text>
          {email ? (
            <Text style={styles.identityEmail} numberOfLines={1}>
              {email}
            </Text>
          ) : null}
        </View>
      </View>

      {session.canUseAgentMode ? (
        <View style={styles.personaPanel}>
          <Text style={styles.personaTitle}>Workspace mode</Text>
          <Text style={styles.personaCaption}>
            Switch between the customer app and your agent desk.
          </Text>
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
        <Text style={styles.editorTitle} accessibilityRole="header">Profile details</Text>
        {[
          { label: "Full name", value: fullName || "Add your name" },
          { label: "Email", value: email || "Not provided" },
          { label: "Phone", value: profile?.phone || "Add a phone number" },
          { label: "Location", value: locationLabel || "Add your city" },
        ].map((item) => (
          <View key={item.label} style={styles.profileDetail}>
            <Text style={styles.detailLabel}>{item.label}</Text>
            <Text selectable style={styles.detailValue}>{item.value}</Text>
          </View>
        ))}
        {!isEditingProfile ? (
          <AuthButton
            label="Edit profile"
            icon="pen-to-square"
            variant="secondary"
            style={styles.editProfileButton}
            onPress={() => setIsEditingProfile(true)}
          />
        ) : null}
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

          <View style={styles.fieldRow}>
            <View style={styles.column}>
              <Text style={styles.fieldLabel}>City</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                style={styles.fieldInput}
                placeholder="Chicago"
                placeholderTextColor={tokens.colors.mutedSoft}
                accessibilityLabel="City"
              />
            </View>
            <View style={styles.columnNarrow}>
              <Text style={styles.fieldLabel}>State</Text>
              <TextInput
                value={stateCode}
                onChangeText={setStateCode}
                style={styles.fieldInput}
                placeholder="IL"
                placeholderTextColor={tokens.colors.mutedSoft}
                autoCapitalize="characters"
                accessibilityLabel="State"
              />
            </View>
          </View>

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
                    city: city.trim() || undefined,
                    stateCode: stateCode.trim().toUpperCase() || undefined,
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
                  index < notificationLabels.length - 1 ? styles.rowDivider : null,
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
                  trackColor={{ false: tokens.colors.borderStrong, true: tokens.colors.brand }}
                  thumbColor="#ffffff"
                  accessibilityLabel={item.title}
                />
              </View>
            ))}
          </View>

          <AuthButton
            label="Save"
            loading={isSavingNotifications}
            disabled={!notificationState || isSavingNotifications || !isEditingNotifications}
            onPress={async () => {
              if (!notificationState) {
                return;
              }

              try {
                setError(null);
                setIsSavingNotifications(true);
                await session.updateNotificationPreferences(notificationState);
              } catch (nextError) {
                const message = getFriendlyApiError(
                  nextError,
                  "We could not save your notification settings.",
                );
                setError(message);
              } finally {
                setIsSavingNotifications(false);
                setIsEditingNotifications(false);
              }
            }}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileSection: {
    gap: 16,
    paddingVertical: 4,
  },
  profileDetail: {
    gap: 4,
  },
  detailLabel: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  detailValue: {
    color: tokens.colors.ink,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: tokens.font.medium,
    flexShrink: 1,
  },
  editProfileButton: {
    alignSelf: "flex-start",
    minHeight: 48,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.brandSoft,
    borderColor: tokens.colors.brandDeep,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
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
    fontSize: 17,
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
    height: 52,
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

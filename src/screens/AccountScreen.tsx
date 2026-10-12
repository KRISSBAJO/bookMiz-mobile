import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FontAwesome6 } from "@expo/vector-icons";
import {
  Image,
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
import { SectionHeader } from "@/src/components/SectionHeader";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import type { NotificationPreferences } from "@/src/lib/api/types";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

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
    caption: "Hear back when providers respond to your requests.",
  },
  {
    key: "emailAppointmentReminders",
    title: "Appointment reminders",
    caption: "Keep upcoming bookings from slipping through the cracks.",
  },
  {
    key: "smsAppointmentReminders",
    title: "Text reminders",
    caption: "Receive quick appointment nudges by SMS when enabled.",
  },
  {
    key: "emailSavedProviderUpdates",
    title: "Saved provider updates",
    caption: "Stay in the loop when bookmarked providers add something new.",
  },
];

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

  return (
    <Screen
      eyebrow="Account"
      title="Keep the experience personal"
      subtitle="Your real BookMiz profile, saved contact details, and notification settings."
      contentTopOffset={24}
      heroBottomPadding={40}
    >
      <View style={styles.profileCard}>
        <Image source={require("../../assets/bookmiz/logo.png")} style={styles.avatar} />
        <View style={styles.profileBody}>
          <Text style={styles.name}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.meta}>
            {profile?.email ?? user?.email}
            {profile?.city || profile?.stateCode
              ? ` · ${profile?.city ?? user?.city ?? ""}${profile?.stateCode ? `, ${profile.stateCode}` : ""}`
              : ""}
          </Text>
        </View>
      </View>

      {session.canUseAgentMode ? (
        <View style={styles.personaPanel}>
          <Text style={styles.personaTitle}>Workspace mode</Text>
          <Text style={styles.personaCaption}>
            Switch between customer flows and your live agent desk.
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

      <Pressable style={styles.appointmentsCard} onPress={() => router.push("/appointments")}>
        <View style={styles.appointmentsIcon}>
          <FontAwesome6 name="calendar-days" size={16} color={tokens.colors.ink} />
        </View>
        <View style={styles.appointmentsCopy}>
          <Text style={styles.appointmentsTitle}>Appointment center</Text>
          <Text style={styles.appointmentsCaption}>
            Open upcoming bookings, past visits, cancellation controls, and reschedule actions.
          </Text>
        </View>
        <FontAwesome6 name="arrow-right-long" size={15} color={tokens.colors.muted} />
      </Pressable>

      <View style={styles.panel}>
        <SectionHeader
          title="Profile settings"
          subtitle="Keep the essentials visible, then open edit mode only when you want to change something."
        />

        <View style={styles.inlineActions}>
          <Pressable
            style={styles.editButton}
            onPress={() => setIsEditingProfile((current) => !current)}
          >
            <Text style={styles.editButtonText}>
              {isEditingProfile ? "Close edit" : "Edit profile"}
            </Text>
          </Pressable>
        </View>

        {isEditingProfile ? (
          <>
            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.fieldLabel}>First name</Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  style={styles.fieldInput}
                  placeholder="First name"
                  placeholderTextColor={tokens.colors.mutedSoft}
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
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              style={styles.fieldInput}
              placeholder="+1 (555) 555-0101"
              placeholderTextColor={tokens.colors.mutedSoft}
            />

            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.fieldLabel}>City</Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  style={styles.fieldInput}
                  placeholder="Chicago"
                  placeholderTextColor={tokens.colors.mutedSoft}
                />
              </View>
              <View style={styles.column}>
                <Text style={styles.fieldLabel}>State</Text>
                <TextInput
                  value={stateCode}
                  onChangeText={setStateCode}
                  style={styles.fieldInput}
                  placeholder="IL"
                  placeholderTextColor={tokens.colors.mutedSoft}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <AuthButton
              label={isSavingProfile ? "Saving profile..." : "Save profile"}
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
          </>
        ) : (
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Full name</Text>
              <Text style={styles.summaryValue}>{firstName} {lastName}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Email</Text>
              <Text style={styles.summaryValue}>{profile?.email ?? user?.email ?? "—"}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Phone</Text>
              <Text style={styles.summaryValue}>{phone || "Add a phone number"}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Location</Text>
              <Text style={styles.summaryValue}>
                {[city, stateCode].filter(Boolean).join(", ") || "Add your city"}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <SectionHeader
          title="Notifications"
          subtitle="Review what is on, then open edit mode if you want to change delivery preferences."
        />
        <View style={styles.inlineActions}>
          <Pressable
            style={styles.editButton}
            onPress={() => setIsEditingNotifications((current) => !current)}
          >
            <Text style={styles.editButtonText}>
              {isEditingNotifications ? "Close edit" : "Edit notifications"}
            </Text>
          </Pressable>
        </View>
        {notificationLabels.map((item) => (
          <View key={item.key} style={styles.preferenceRow}>
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
              trackColor={{ false: "#d8dde8", true: "#b8f363" }}
              thumbColor="#ffffff"
            />
          </View>
        ))}

        <AuthButton
          label={isSavingNotifications ? "Saving preferences..." : "Save preferences"}
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

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <AuthButton
        label="Sign out"
        variant="secondary"
        onPress={async () => {
          await session.signOut();
          router.replace("/welcome");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
  },
  profileBody: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: tokens.colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  meta: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  personaPanel: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: tokens.colors.ink,
    padding: 18,
    gap: 8,
  },
  personaTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  personaCaption: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    lineHeight: 19,
  },
  personaSwitcherWrap: {
    paddingTop: 4,
  },
  appointmentsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
  },
  appointmentsIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2f7",
  },
  appointmentsCopy: {
    flex: 1,
    gap: 4,
  },
  appointmentsTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  appointmentsCaption: {
    color: tokens.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  panel: {
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
    gap: 16,
  },
  inlineActions: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  editButton: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editButtonText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryCard: {
    width: "48%",
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 14,
    gap: 6,
  },
  summaryLabel: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  summaryValue: {
    color: tokens.colors.ink,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  fieldLabel: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  fieldInput: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: tokens.colors.ink,
    fontSize: 15,
  },
  preferenceRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 14,
  },
  preferenceCopy: {
    flex: 1,
    gap: 4,
  },
  preferenceTitle: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  preferenceCaption: {
    color: tokens.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: "#d44c3f",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
});

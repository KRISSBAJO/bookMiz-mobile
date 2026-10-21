import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome6 } from "@expo/vector-icons";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { AuthField } from "@/src/components/auth/AuthField";
import { Choices } from '@/src/components/business/BusinessUI';
import { Screen } from "@/src/components/Screen";
import { getMarketplaceProvider } from "@/src/lib/api/marketplace";
import {
  createCustomerBooking,
  resumeCustomerPayment,
  getPublicBookingAvailability,
  getPublicBookingAvailabilityMonth,
} from "@/src/lib/api/bookings";
import type {
  MarketplaceProviderProfile,
  PublicAvailabilitySlot,
} from "@/src/lib/api/types";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import { useSession } from "@/src/store/session-context";
import { openBookingCheckout } from "@/src/lib/open-booking-checkout";
import { tokens } from "@/src/theme/tokens";
import { useSavedDraft } from "@/src/lib/use-saved-draft";

type StepId = "service" | "details" | "time" | "confirm";

const stepTitles: Record<StepId, string> = {
  service: "Choose a service",
  details: "Appointment details",
  time: "Pick a time",
  confirm: "Confirm",
};

const channelLabels: Record<string, string> = {
  IN_PERSON: "Office visit",
  PHONE: "Phone call",
  VIDEO: "Video call",
  HOME_VISIT: "Home visit",
};

function formatSlotTime(value: string, timeZone: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

function formatSlotDate(value: string, timeZone: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  });
}

/** "YYYY-MM-DD" for a date, shifting by `offset` days, with no timezone drift. */
function shiftDateKey(key: string, offset: number) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function dateKeyParts(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return {
    weekday: date.toLocaleDateString(undefined, {
      weekday: "short",
      timeZone: "UTC",
    }),
    day: date.getUTCDate(),
    month: date.toLocaleDateString(undefined, {
      month: "short",
      timeZone: "UTC",
    }),
  };
}

const DAY_STRIP_LENGTH = 21;

function slotPeriod(value: string, timeZone: string): "Morning" | "Afternoon" | "Evening" {
  const hour = Number(new Intl.DateTimeFormat("en", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date(value)));
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export function NativeBookingScreen() {
  const { slug, locationId: requestedLocationId } = useLocalSearchParams<{ slug: string; locationId?: string }>();
  const router = useRouter();
  const session = useSession();
  const canBook = session.user?.userType === "CUSTOMER";
  const [profile, setProfile] = useState<MarketplaceProviderProfile | null>(
    null,
  );
  const [serviceId, setServiceId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [checkoutPending, setCheckoutPending] = useState(false);
  const businessTimezone = profile?.provider.timezone || "UTC";
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [selected, setSelected] = useState<PublicAvailabilitySlot | null>(null);
  const [staffId, setStaffId] = useState("");
  const [dayOffset, setDayOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [channel, setChannel] = useState("");
  const [intake, setIntake] = useState<
    Record<string, string | string[] | boolean>
  >({});
  const [stepIndex, setStepIndex] = useState(0);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  // Slot counts per day for the strip, from the month availability endpoint.
  const [dayCounts, setDayCounts] = useState<Record<string, number>>({});
  const [dayCountsLoaded, setDayCountsLoaded] = useState(false);
  const [todayKey, setTodayKey] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const { draftError, clearDraft } = useSavedDraft(
    session.user ? `${session.user.id}_booking_${slug}` : null,
    { serviceId, locationId, date, channel, notes, intake },
    (draft) => {
      if (
        profile &&
        [
          ...profile.services.groups.flatMap((group) => group.services),
          ...profile.services.suggested,
        ].some((service) => service.id === draft.serviceId)
      )
        setServiceId(draft.serviceId);
      if (draft.date >= todayKey) {
        setDate(draft.date);
        setDayOffset(
          Math.floor(
            (Date.parse(draft.date) - Date.parse(todayKey)) /
              86400000 /
              DAY_STRIP_LENGTH,
          ) * DAY_STRIP_LENGTH,
        );
      }
      if ((!requestedLocationId || draft.locationId === requestedLocationId) && draft.locationId && profile?.provider.locations.some(item => item.id === draft.locationId)) setLocationId(draft.locationId);
      setChannel(draft.channel || "");
      setNotes(draft.notes || "");
      setIntake(draft.intake || {});
    },
    !loading && !createdId,
  );

  useEffect(() => {
    let active = true;
    setProfile(null);setSelected(null);setSlots([]);setLoading(true);setError(null);
    getMarketplaceProvider(slug)
      .then((value) => {
        if (!active) return;
        if (requestedLocationId && !value.provider.locations.some(item => item.id === requestedLocationId)) throw new Error("This business location is no longer available. Please choose another location.");
        setProfile(value);
        setLocationId(value.provider.locations.find(item => item.id === requestedLocationId)?.id || value.provider.primaryLocation?.id || value.provider.locations[0]?.id || "");
        const parts = Object.fromEntries(
          new Intl.DateTimeFormat("en", {
            timeZone: value.provider.timezone || "UTC",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
            .formatToParts(new Date())
            .map((part) => [part.type, part.value]),
        );
        setDate(`${parts.year}-${parts.month}-${parts.day}`);
        setTodayKey(`${parts.year}-${parts.month}-${parts.day}`);
        const first =
          value.services.groups.flatMap((group) => group.services)[0] ||
          value.services.suggested[0];
        if (first) setServiceId(first.id);
      })
      .catch((reason) => {
        if (active)
          setError(
            getFriendlyApiError(reason, "Could not load this business."),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, requestedLocationId]);

  const services = useMemo(
    () => profile?.services.groups.flatMap((group) => group.services) || [],
    [profile],
  );
  const service =
    services.find((value) => value.id === serviceId) ||
    profile?.services.suggested.find((value) => value.id === serviceId);
  const serviceChoices = services.length
    ? services
    : profile?.services.suggested || [];
  const channels = service
    ? service.availableChannels.length
      ? service.availableChannels
      : [service.defaultChannel]
    : [];
  const hasDetails = Boolean(
    service &&
    (channels.length > 1 ||
      service.intakeFields.length > 0 ||
      service.requiredDocumentLabels.length > 0),
  );
  const steps: StepId[] = hasDetails
    ? ["service", "details", "time", "confirm"]
    : ["service", "time", "confirm"];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const stepNumber = steps.indexOf(step) + 1;

  const missingRequired = service
    ? service.intakeFields.find(
        (field) =>
          field.required &&
          (field.type === "BOOLEAN"
            ? typeof intake[String(field.id)] !== "boolean"
            : Array.isArray(intake[String(field.id)])
              ? !(intake[String(field.id)] as string[]).length
              : !String(intake[String(field.id)] ?? "").trim()),
      )
    : undefined;

  const priceLabel =
    service?.currencyCode
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: service.currencyCode,
          currencyDisplay: "code",
        }).format(service.priceCents / 100)
      : null;

  const dayStrip = useMemo(
    () =>
      Array.from({ length: DAY_STRIP_LENGTH }, (_, index) =>
        shiftDateKey(todayKey, dayOffset + index),
      ),
    [todayKey, dayOffset],
  );

  // Day counts for the strip: this month and next, fetched once per service.
  useEffect(() => {
    if (step !== "time" || !profile || !serviceId) return;
    let active = true;
    setDayCountsLoaded(false);
    const months = [dayStrip[0], dayStrip[dayStrip.length - 1]]
      .map((key) => `${key.slice(0, 7)}-01T12:00:00.000Z`)
      .filter((value, index, all) => all.indexOf(value) === index);
    Promise.all(
      months.map((month) =>
        getPublicBookingAvailabilityMonth({
          providerId: profile.provider.id,
          serviceId,
          month,
          locationId: locationId || undefined,
        }),
      ),
    )
      .then((results) => {
        if (!active) return;
        const counts: Record<string, number> = {};
        results.forEach((result) =>
          result.days.forEach((day) => {
            counts[day.date.slice(0, 10)] = day.slotCount;
          }),
        );
        setDayCounts(counts);
        const firstOpen = dayStrip.find((key) => counts[key] > 0);
        if (firstOpen)
          setDate((current) => (counts[current] === 0 ? firstOpen : current));
      })
      .catch(() => {
        if (active) setDayCounts({});
      })
      .finally(() => {
        if (active) setDayCountsLoaded(true);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, profile?.provider.id, serviceId, todayKey, dayStrip, locationId]);

  // Slots load as soon as a day is picked; no separate "find times" step.
  useEffect(() => {
    if (step !== "time" || !profile || !serviceId) return;
    let active = true;
    setSlots([]);
    setSelected(null);
    setStaffId("");
    setSlotsLoaded(false);
    setBusy(true);
    setError(null);
    getPublicBookingAvailability({
      providerId: profile.provider.id,
      serviceId,
      date: date + "T00:00:00.000Z",
      locationId: locationId || undefined,
    })
      .then((result) => {
        if (active) {
          setSlots(result.slots);
          setSlotsLoaded(true);
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            getFriendlyApiError(
              reason,
              "Could not load appointment times. Pick a day to retry.",
            ),
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, date, serviceId, profile?.provider.id, locationId]);

  const slotGroups = useMemo(() => {
    const groups: Array<{ label: string; slots: PublicAvailabilitySlot[] }> = [
      { label: "Morning", slots: [] },
      { label: "Afternoon", slots: [] },
      { label: "Evening", slots: [] },
    ];
    slots.forEach((slot) =>
      groups
        .find((group) => group.label === slotPeriod(slot.startAt, businessTimezone))
        ?.slots.push(slot),
    );
    return groups.filter((group) => group.slots.length > 0);
  }, [slots, businessTimezone]);

  // One period shown at a time; follows the first period that has times when the day changes.
  const [period, setPeriod] = useState<string | null>(null);
  const activeGroup =
    slotGroups.find((group) => group.label === period) ?? slotGroups[0] ?? null;

  async function book() {
    if (
      !session.user ||
      !canBook ||
      !profile ||
      !service ||
      !selected ||
      busy ||
      createdId
    )
      return;
    const missing = service.intakeFields.find(
      (field) =>
        field.required &&
        (field.type === "BOOLEAN"
          ? typeof intake[String(field.id)] !== "boolean"
          : Array.isArray(intake[String(field.id)])
            ? !(intake[String(field.id)] as string[]).length
            : !String(intake[String(field.id)] ?? "").trim()),
    );
    if (missing) {
      setError(`Answer "${String(missing.label)}" before booking.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createCustomerBooking({
        providerId: profile.provider.id,
        serviceId: service.id,
        expectedPriceCents: service.priceCents,
        expectedCurrencyCode: service.currencyCode,
        expectedPolicyVersion: profile.provider.changePolicy?.version,
        startsAt: selected.startAt,
        assignedStaffId: staffId || undefined,
        locationId: selected.locationId || locationId || undefined,
        channel: channel || service.defaultChannel,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        email: session.user.email,
        phone: session.profile?.phone || undefined,
        notes,
        intakeResponses: service.intakeFields
          .filter((field) => intake[String(field.id)] !== undefined)
          .map((field) => ({
            fieldId: field.id,
            label: field.label,
            type: field.type,
            value: intake[String(field.id)],
          })),
        requestedDocumentLabels: service.requiredDocumentLabels,
      });
      setCreatedId(result.id);
      setCheckoutPending((service.priceCents ?? 0) > 0 && !result.payment?.authorizationUrl);
      await clearDraft().catch(() => {});
      if (result.payment?.authorizationUrl) {
        try { await openBookingCheckout(result.payment.authorizationUrl); } catch (error) { setCheckoutPending(true); throw error; }
      } else if (result.payment?.method === "UNAVAILABLE")
        setError(
          result.payment.message ||
            "Your booking is reserved. Contact the provider about payment.",
        );
    } catch (reason) {
      setError(
        getFriendlyApiError(reason, "Could not reserve this appointment."),
      );
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    setError(null);
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setError(null);
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  const canContinue =
    step === "service"
      ? Boolean(service)
      : step === "details"
        ? !missingRequired
        : step === "time"
          ? Boolean(selected)
          : true;

  const title = profile?.provider.displayName || "Book";
  const inFlow = session.isSignedIn && canBook && !createdId && !loading;

  return (
    <View style={styles.root}>
      <Screen
        title={title}
        eyebrow={
          inFlow
            ? `Step ${stepNumber} of ${steps.length} · ${stepTitles[step]}`
            : undefined
        }
        heroContent={
          inFlow ? (
            <View style={styles.progressTrack} accessibilityRole="progressbar">
              <View
                style={[
                  styles.progressFill,
                  { width: `${(stepNumber / steps.length) * 100}%` },
                ]}
              />
            </View>
          ) : undefined
        }
      >
        {draftError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {draftError}
          </Text>
        ) : null}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <>
            <View style={styles.skeletonLine} />
            {[0, 1, 2].map((index) => (
              <View
                key={index}
                style={[styles.skeletonRow, { opacity: 1 - index * 0.25 }]}
              />
            ))}
          </>
        ) : !session.isSignedIn ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sign in to book</Text>
            <Text style={styles.emptyBody}>
              Your appointment is saved to your account.
            </Text>
            <AuthButton
              label="Sign in"
              style={styles.emptyAction}
              onPress={() => router.push("/login")}
            />
          </View>
        ) : !canBook ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Use a customer account to book
            </Text>
            <Text style={styles.emptyBody}>
              You are signed in with a staff or admin account. Switching to
              customer mode changes the view, but does not change your account
              permissions.
            </Text>
            <AuthButton
              label="Sign out and use a customer account"
              variant="secondary"
              style={styles.emptyAction}
              onPress={async () => {
                await session.signOut();
                router.replace("/login");
              }}
            />
          </View>
        ) : createdId ? (
          <View style={styles.doneCard}>
            <View style={styles.doneIcon}>
              <FontAwesome6
                name="check"
                size={20}
                color={tokens.colors.success}
              />
            </View>
            <Text style={styles.doneTitle}>Appointment reserved</Text>
            <Text style={styles.doneBody}>
              {service?.name}
              {selected
                ? ` · ${formatSlotDate(selected.startAt, businessTimezone)}, ${formatSlotTime(selected.startAt, businessTimezone)}`
                : ""}
            </Text>
            <Text style={styles.doneCaption}>
              Open it to see payment status and details.
            </Text>
            {checkoutPending ? <AuthButton label={busy ? "Opening payment…" : "Retry online payment"} disabled={busy} onPress={() => {
              if (busy) return;
              setBusy(true); setError(null);
              void resumeCustomerPayment(createdId).then(async payment => {
                if (!payment?.authorizationUrl) throw new Error("Payment status changed. Open the appointment for the latest details.");
                await openBookingCheckout(payment.authorizationUrl); setCheckoutPending(false);
              }).catch(reason => setError(getFriendlyApiError(reason, "Could not open payment. Your appointment remains reserved."))).finally(() => setBusy(false));
            }} /> : null}
            <AuthButton
              label="View appointment"
              style={styles.emptyAction}
              onPress={() =>
                router.replace({
                  pathname: "/appointments/[bookingId]",
                  params: { bookingId: createdId },
                })
              }
            />
          </View>
        ) : step === "service" ? (
          <View style={styles.list}>
            {serviceChoices.map((value) => {
              const isSelected = serviceId === value.id;
              return (
                <Pressable
                  key={value.id}
                  style={[
                    styles.choiceRow,
                    isSelected ? styles.choiceRowSelected : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    setServiceId(value.id);
                    setSlots([]);
                    setSelected(null);
                    setChannel("");
                    setIntake({});
                    setSlotsLoaded(false);
                  }}
                >
                  <View style={styles.choiceCopy}>
                    <Text style={styles.choiceTitle} numberOfLines={2}>
                      {value.name}
                    </Text>
                    <Text style={styles.choiceMeta} numberOfLines={1}>
                      {value.durationMinutes} min
                      {value.currencyCode
                        ? ` · ${new Intl.NumberFormat(undefined, { style: "currency", currency: value.currencyCode, currencyDisplay: "code" }).format(value.priceCents / 100)}`
                        : ""}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      isSelected ? styles.radioSelected : null,
                    ]}
                  >
                    {isSelected ? (
                      <FontAwesome6 name="check" size={11} color="#ffffff" />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>
                Can’t find the service you need?
              </Text>
              <Text style={styles.caption}>
                Describe what you need and request quotes from nearby providers.
                A quote request does not reserve an appointment or charge your
                card.
              </Text>
              <AuthButton
                label="Request a service quote"
                variant="secondary"
                onPress={() => {
                  session.switchPersona("customer");
                  router.push({
                    pathname: "/(tabs)/workbench",
                    params: {
                      service: "Custom service",
                      description: `I couldn’t find the service I need on ${profile?.provider.displayName || "this business"}’s menu. I’m looking for: `,
                    },
                  });
                }}
              />
            </View>
            {serviceChoices.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No services to book</Text>
                <Text style={styles.emptyBody}>
                  This business has not listed bookable services.
                </Text>
              </View>
            ) : null}
          </View>
        ) : step === "details" && service ? (
          <View style={styles.form}>
            {profile && profile.provider.locations.length > 1 ? <Choices label="Business location" value={locationId} onChange={setLocationId} items={profile.provider.locations.map(item => ({ id: item.id, label: item.addressLabel }))} /> : null}
            <Text style={styles.fieldLabel}>Appointment times use {businessTimezone}</Text>
            {channels.length > 1 ? (
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Appointment type</Text>
                <View style={styles.chipWrap}>
                  {channels.map((value) => {
                    const isSelected =
                      (channel || service.defaultChannel) === value;
                    return (
                      <Pressable
                        key={value}
                        style={[
                          styles.chip,
                          isSelected ? styles.chipSelected : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setChannel(value)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected ? styles.chipTextSelected : null,
                          ]}
                        >
                          {channelLabels[value] || value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {service.intakeFields.map((field) => {
              const id = String(field.id),
                value = intake[id],
                options = Array.isArray(field.options)
                  ? field.options.filter(
                      (option): option is string => typeof option === "string",
                    )
                  : [];
              const update = (next: string | string[] | boolean) =>
                setIntake((current) => ({ ...current, [id]: next }));
              const label = `${String(field.label)}${field.required ? " *" : ""}`;
              const help = field.helpText ? String(field.helpText) : undefined;

              if (
                field.type === "BOOLEAN" ||
                field.type === "SELECT" ||
                field.type === "MULTI_SELECT"
              ) {
                const choices: Array<{
                  key: string;
                  label: string;
                  active: boolean;
                  onPress: () => void;
                }> =
                  field.type === "BOOLEAN"
                    ? [true, false].map((option) => ({
                        key: String(option),
                        label: option ? "Yes" : "No",
                        active: value === option,
                        onPress: () => update(option),
                      }))
                    : options.map((option) => ({
                        key: option,
                        label: option,
                        active:
                          value === option ||
                          (Array.isArray(value) && value.includes(option)),
                        onPress: () =>
                          update(
                            field.type === "SELECT"
                              ? option
                              : Array.isArray(value) && value.includes(option)
                                ? value.filter((item) => item !== option)
                                : [
                                    ...(Array.isArray(value) ? value : []),
                                    option,
                                  ],
                          ),
                      }));
                return (
                  <View key={id} style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    {help ? <Text style={styles.fieldHelp}>{help}</Text> : null}
                    <View style={styles.chipWrap}>
                      {choices.map((choice) => (
                        <Pressable
                          key={choice.key}
                          style={[
                            styles.chip,
                            choice.active ? styles.chipSelected : null,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: choice.active }}
                          onPress={choice.onPress}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              choice.active ? styles.chipTextSelected : null,
                            ]}
                          >
                            {choice.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              }

              if (field.type === "LONG_TEXT") {
                return (
                  <View key={id} style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    {help ? <Text style={styles.fieldHelp}>{help}</Text> : null}
                    <TextInput
                      accessibilityLabel={String(field.label)}
                      placeholder={String(field.placeholder || "")}
                      placeholderTextColor={tokens.colors.muted}
                      value={typeof value === "string" ? value : ""}
                      onChangeText={update}
                      multiline
                      textAlignVertical="top"
                      style={styles.textArea}
                    />
                  </View>
                );
              }

              return (
                <AuthField
                  key={id}
                  label={label}
                  placeholder={String(field.placeholder || "")}
                  value={typeof value === "string" ? value : ""}
                  onChangeText={update}
                  helperText={help}
                />
              );
            })}

            {service.requiredDocumentLabels.length ? (
              <View style={styles.noteCard}>
                <FontAwesome6
                  name="file-lines"
                  size={16}
                  color={tokens.colors.ink}
                />
                <Text style={styles.noteText}>
                  The provider asks for:{" "}
                  {service.requiredDocumentLabels.join(", ")}. Contact them to
                  send these.
                </Text>
              </View>
            ) : null}
          </View>
        ) : step === "time" ? (
          <View style={styles.form}>
            <View style={styles.footerRow}>
              <AuthButton
                label="Earlier dates"
                variant="secondary"
                disabled={dayOffset === 0}
                onPress={() => {
                  const next = Math.max(0, dayOffset - DAY_STRIP_LENGTH);
                  setDayOffset(next);
                  setDate(shiftDateKey(todayKey, next));
                }}
              />
              <AuthButton
                label="Later dates"
                variant="secondary"
                onPress={() => {
                  const next = dayOffset + DAY_STRIP_LENGTH;
                  setDayOffset(next);
                  setDate(shiftDateKey(todayKey, next));
                }}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dayStripScroll}
              contentContainerStyle={styles.dayStrip}
            >
              {dayStrip.map((key) => {
                const parts = dateKeyParts(key);
                const isSelected = key === date;
                const closed = dayCountsLoaded && dayCounts[key] === 0;
                const showMonth = key.endsWith("-01") || key === dayStrip[0];
                return (
                  <Pressable
                    key={key}
                    onPress={() => setDate(key)}
                    disabled={closed}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: isSelected,
                      disabled: closed,
                    }}
                    accessibilityLabel={`${parts.weekday} ${parts.day} ${parts.month}${closed ? ", no open times" : ""}`}
                    style={[
                      styles.dayChip,
                      isSelected ? styles.dayChipSelected : null,
                      closed ? styles.dayChipClosed : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayChipWeekday,
                        isSelected ? styles.dayChipTextSelected : null,
                      ]}
                    >
                      {key === todayKey ? "Today" : parts.weekday}
                    </Text>
                    <Text
                      style={[
                        styles.dayChipDay,
                        isSelected ? styles.dayChipTextSelected : null,
                        closed ? styles.dayChipTextClosed : null,
                      ]}
                    >
                      {parts.day}
                    </Text>
                    <Text
                      style={[
                        styles.dayChipMonth,
                        isSelected ? styles.dayChipTextSelected : null,
                      ]}
                    >
                      {showMonth
                        ? parts.month
                        : dayCounts[key]
                          ? `${dayCounts[key]} open`
                          : " "}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {busy ? (
              <View style={styles.timeGrid}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                  <View
                    key={index}
                    style={[
                      styles.timeCell,
                      styles.timeCellSkeleton,
                      { opacity: 0.9 - index * 0.08 },
                    ]}
                  />
                ))}
              </View>
            ) : slotGroups.length > 0 && activeGroup ? (
              <>
                <View style={styles.periodRow}>
                  {slotGroups.map((group) => {
                    const isActive = group.label === activeGroup.label;
                    return (
                      <Pressable
                        key={group.label}
                        onPress={() => setPeriod(group.label)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isActive }}
                        style={[
                          styles.periodTab,
                          isActive ? styles.periodTabActive : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.periodTabText,
                            isActive ? styles.periodTabTextActive : null,
                          ]}
                        >
                          {group.label}
                        </Text>
                        <Text
                          style={[
                            styles.periodTabCount,
                            isActive ? styles.periodTabTextActive : null,
                          ]}
                        >
                          {group.slots.length}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.timeGrid}>
                  {activeGroup.slots.map((slot) => {
                    const isSelected = selected?.startAt === slot.startAt;
                    return (
                      <Pressable
                        key={slot.startAt}
                        style={[
                          styles.timeCell,
                          isSelected ? styles.timeCellSelected : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={new Date(
                          slot.startAt,
                        ).toLocaleString(undefined, { timeZone: businessTimezone })}
                        onPress={() => {
                          setSelected(slot);
                          setStaffId(
                            slot.staffOptions?.[0]?.staffMemberId ?? "",
                          );
                        }}
                      >
                        <Text
                          style={[
                            styles.timeCellText,
                            isSelected ? styles.timeCellTextSelected : null,
                          ]}
                        >
                          {formatSlotTime(slot.startAt, businessTimezone).replace(
                            /\s?(AM|PM)$/i,
                            "",
                          )}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.dayHint}>
                  {activeGroup.label === "Morning" ? "AM" : "PM"} · shown in
                  your timezone
                </Text>
              </>
            ) : slotsLoaded ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nothing open on this day</Text>
                <Text style={styles.emptyBody}>Pick another day above.</Text>
              </View>
            ) : null}

            {selected?.staffOptions?.length ? (
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Choose your staff member</Text>
                {selected.staffOptions.map((staff) => (
                  <Pressable
                    key={staff.staffMemberId}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: staffId === staff.staffMemberId,
                    }}
                    onPress={() => setStaffId(staff.staffMemberId)}
                    style={[
                      styles.choiceRow,
                      staffId === staff.staffMemberId
                        ? styles.choiceRowSelected
                        : null,
                    ]}
                  >
                    <Text style={styles.choiceTitle}>{staff.displayName}</Text>
                    {staffId === staff.staffMemberId ? (
                      <FontAwesome6
                        name="check"
                        color={tokens.colors.ink}
                        size={16}
                      />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
            {selected ? (
              <View style={styles.selectedCard}>
                <View style={styles.selectedIcon}>
                  <FontAwesome6
                    name="check"
                    size={14}
                    color={tokens.colors.inkDeep}
                  />
                </View>
                <View style={styles.selectedBody}>
                  <Text style={styles.selectedTitle}>
                    {formatSlotTime(selected.startAt, businessTimezone)}
                  </Text>
                  <Text style={styles.selectedMeta}>
                    {formatSlotDate(selected.startAt, businessTimezone)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : step === "confirm" && service ? (
          <View style={styles.form}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Service</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  {service.name}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>When</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  {selected
                    ? `${formatSlotDate(selected.startAt, businessTimezone)}, ${formatSlotTime(selected.startAt, businessTimezone)}`
                    : "Not chosen"}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Type</Text>
                <Text style={styles.summaryValue}>
                  {channelLabels[channel || service.defaultChannel] ||
                    channel ||
                    service.defaultChannel}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Length</Text>
                <Text style={styles.summaryValue}>
                  {service.durationMinutes} min
                </Text>
              </View>
              {priceLabel ? (
                <View style={[styles.summaryRow, styles.summaryRowLast]}>
                  <Text style={styles.summaryLabel}>Price</Text>
                  <Text style={styles.summaryPrice}>{priceLabel}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Notes for the provider</Text>
              <TextInput
                accessibilityLabel="Appointment notes"
                placeholder="Optional"
                placeholderTextColor={tokens.colors.muted}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
                style={styles.textArea}
              />
            </View>

            <Text style={styles.caption}>
              Online payment opens after the appointment is reserved.
            </Text>
            {selected && profile?.provider.changePolicy ? (
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Your change deadlines</Text>
                <Text style={styles.caption}>Cancel by {new Date(Date.parse(selected.startAt) - profile.provider.changePolicy.cancellationNoticeHours * 3600000).toLocaleString(undefined, { timeZone: businessTimezone })}</Text>
                <Text style={styles.caption}>Reschedule by {new Date(Date.parse(selected.startAt) - profile.provider.changePolicy.rescheduleNoticeHours * 3600000).toLocaleString(undefined, { timeZone: businessTimezone })}</Text>
                <Text style={styles.caption}>{businessTimezone}. After these deadlines, contact the business. A refund is confirmed separately after processor approval.</Text>
              </View>
            ) : null}
            <Text style={styles.fieldLabel}>
              Booking and cancellation terms
            </Text>
            <Text style={styles.caption}>
              {profile?.provider.bookingPolicy ||
                "Check the appointment details for booking conditions."}
            </Text>
            <Text style={styles.caption}>
              {profile?.provider.cancellationPolicy ||
                "Cancellation eligibility is checked by the provider’s policy. Refunds are subject to that policy."}
            </Text>
            {profile?.provider.paymentPolicy ? (
              <Text style={styles.caption}>
                {profile.provider.paymentPolicy}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Screen>

      {inFlow ? (
        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          <View style={styles.footerRow}>
            {stepNumber > 1 ? (
              <AuthButton
                label="Back"
                variant="secondary"
                style={styles.footerBack}
                onPress={goBack}
              />
            ) : null}
            {step === "confirm" ? (
              <AuthButton
                label="Reserve"
                style={styles.footerPrimary}
                loading={busy}
                disabled={busy || !selected}
                onPress={() => void book()}
              />
            ) : (
              <AuthButton
                label="Continue"
                icon="arrow-right"
                style={styles.footerPrimary}
                disabled={!canContinue}
                onPress={goNext}
              />
            )}
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  progressTrack: {
    height: 4,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
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
  skeletonLine: {
    height: 4,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.border,
  },
  skeletonRow: {
    height: 68,
    borderRadius: 16,
    backgroundColor: tokens.colors.border,
  },
  list: {
    gap: 12,
  },
  form: {
    gap: 16,
  },
  choiceRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#ffffff",
  },
  choiceRowSelected: {
    borderColor: tokens.colors.inkDeep,
  },
  choiceCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  choiceTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.display,
    letterSpacing: -0.2,
  },
  choiceMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    backgroundColor: tokens.colors.inkDeep,
    borderColor: tokens.colors.inkDeep,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  fieldHelp: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: tokens.colors.inkDeep,
    borderColor: tokens.colors.inkDeep,
  },
  chipSkeleton: {
    width: 84,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.border,
  },
  chipText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  chipTextSelected: {
    color: "#ffffff",
  },
  textArea: {
    minHeight: 96,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surfaceSoft,
    color: tokens.colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: tokens.font.regular,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  noteText: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
  dayStripScroll: {
    marginHorizontal: -20,
  },
  dayStrip: {
    paddingHorizontal: 20,
    gap: 8,
  },
  dayChip: {
    width: 64,
    height: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dayChipSelected: {
    backgroundColor: tokens.colors.inkDeep,
    borderColor: tokens.colors.inkDeep,
  },
  dayChipClosed: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
  },
  dayChipWeekday: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontFamily: tokens.font.semibold,
  },
  dayChipDay: {
    color: tokens.colors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontFamily: tokens.font.display,
  },
  dayChipMonth: {
    color: tokens.colors.success,
    fontSize: 10,
    fontFamily: tokens.font.semibold,
  },
  dayChipTextSelected: {
    color: "#ffffff",
  },
  dayChipTextClosed: {
    color: tokens.colors.mutedSoft,
  },
  dayHint: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontFamily: tokens.font.regular,
    textAlign: "center",
  },
  periodRow: {
    flexDirection: "row",
    gap: 2,
    padding: 3,
    borderRadius: 12,
    backgroundColor: "#e6ebf3",
  },
  periodTab: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  periodTabActive: {
    backgroundColor: "#ffffff",
  },
  periodTabText: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.semibold,
  },
  periodTabCount: {
    color: tokens.colors.mutedSoft,
    fontSize: 12,
    fontFamily: tokens.font.medium,
  },
  periodTabTextActive: {
    color: tokens.colors.ink,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeCell: {
    width: "23.5%",
    flexGrow: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  timeCellSelected: {
    backgroundColor: tokens.colors.inkDeep,
    borderColor: tokens.colors.inkDeep,
  },
  timeCellSkeleton: {
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.border,
  },
  timeCellText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  timeCellTextSelected: {
    color: "#ffffff",
  },
  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: tokens.colors.brandSoft,
  },
  selectedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBody: {
    flex: 1,
    gap: 1,
  },
  selectedTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.semibold,
  },
  selectedMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.regular,
  },
  selectedLine: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.semibold,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryLabel: {
    width: 72,
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
  summaryValue: {
    flex: 1,
    textAlign: "right",
    color: tokens.colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: tokens.font.semibold,
  },
  summaryPrice: {
    flex: 1,
    textAlign: "right",
    color: tokens.colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: tokens.font.display,
    letterSpacing: -0.3,
  },
  caption: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    padding: 20,
    alignItems: "center",
    gap: 4,
  },
  emptyTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.display,
  },
  emptyBody: {
    color: tokens.colors.muted,
    fontSize: 14,
    textAlign: "center",
    fontFamily: tokens.font.regular,
  },
  emptyAction: {
    alignSelf: "stretch",
    marginTop: 12,
  },
  doneCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#ffffff",
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  doneIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  doneTitle: {
    color: tokens.colors.ink,
    fontSize: 17,
    fontFamily: tokens.font.display,
    letterSpacing: -0.3,
  },
  doneBody: {
    color: tokens.colors.ink,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    fontFamily: tokens.font.regular,
  },
  doneCaption: {
    color: tokens.colors.muted,
    fontSize: 13,
    textAlign: "center",
    fontFamily: tokens.font.regular,
  },
  footer: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 12,
  },
  footerBack: {
    minHeight: 56,
    paddingHorizontal: 20,
  },
  footerPrimary: {
    flex: 1,
  },
});

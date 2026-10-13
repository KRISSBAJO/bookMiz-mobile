import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome6 } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { AuthField } from "@/src/components/auth/AuthField";
import { Screen } from "@/src/components/Screen";
import { getMarketplaceProvider } from "@/src/lib/api/marketplace";
import { createCustomerBooking, getPublicBookingAvailability } from "@/src/lib/api/bookings";
import type { MarketplaceProviderProfile, PublicAvailabilitySlot } from "@/src/lib/api/types";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import { useSession } from "@/src/store/session-context";
import { openBookingCheckout } from "@/src/lib/open-booking-checkout";
import { tokens } from "@/src/theme/tokens";

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

function formatSlotTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatSlotDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function NativeBookingScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const session = useSession();
  const [profile, setProfile] = useState<MarketplaceProviderProfile | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [selected, setSelected] = useState<PublicAvailabilitySlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [channel, setChannel] = useState("");
  const [intake, setIntake] = useState<Record<string, string | string[] | boolean>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [slotsLoaded, setSlotsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getMarketplaceProvider(slug).then(value => {
      if (!active) return;
      setProfile(value);
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: value.provider.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
      setDate(`${parts.year}-${parts.month}-${parts.day}`);
      const first = value.services.groups.flatMap(group => group.services)[0] || value.services.suggested[0];
      if (first) setServiceId(first.id);
    }).catch(reason => { if (active) setError(getFriendlyApiError(reason, "Could not load this business.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const services = useMemo(() => profile?.services.groups.flatMap(group => group.services) || [], [profile]);
  const service = services.find(value => value.id === serviceId) || profile?.services.suggested.find(value => value.id === serviceId);
  const serviceChoices = services.length ? services : profile?.services.suggested || [];
  const channels = service ? (service.availableChannels.length ? service.availableChannels : [service.defaultChannel]) : [];
  const hasDetails = Boolean(service && (channels.length > 1 || service.intakeFields.length > 0 || service.requiredDocumentLabels.length > 0));
  const steps: StepId[] = hasDetails ? ["service", "details", "time", "confirm"] : ["service", "time", "confirm"];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const stepNumber = steps.indexOf(step) + 1;

  const missingRequired = service
    ? service.intakeFields.find(field => field.required && (field.type === 'BOOLEAN' ? typeof intake[String(field.id)] !== 'boolean' : Array.isArray(intake[String(field.id)]) ? !(intake[String(field.id)] as string[]).length : !String(intake[String(field.id)] ?? '').trim()))
    : undefined;

  const priceLabel = service && profile?.provider.currencyCode
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency: profile.provider.currencyCode }).format(service.priceCents / 100)
    : null;

  async function loadSlots() {
    if (!profile || !serviceId) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) { setError("Enter a date as YYYY-MM-DD."); return; }
    setBusy(true); setError(null); setSelected(null);
    try {
      const result = await getPublicBookingAvailability({ providerId: profile.provider.id, serviceId, date: date + "T00:00:00.000Z" });
      setSlots(result.slots);
      setSlotsLoaded(true);
    } catch (reason) { setError(getFriendlyApiError(reason, "Could not load appointment times.")); }
    finally { setBusy(false); }
  }

  async function book() {
    if (!session.user || !profile || !service || !selected || busy || createdId) return;
    const missing = service.intakeFields.find(field => field.required && (field.type === 'BOOLEAN' ? typeof intake[String(field.id)] !== 'boolean' : Array.isArray(intake[String(field.id)]) ? !(intake[String(field.id)] as string[]).length : !String(intake[String(field.id)] ?? '').trim()));
    if (missing) { setError(`Answer "${String(missing.label)}" before booking.`); return; }
    setBusy(true); setError(null);
    try {
      const result = await createCustomerBooking({ providerId: profile.provider.id, serviceId: service.id, startsAt: selected.startAt, assignedStaffId: selected.staffOptions?.[0]?.staffMemberId, locationId: selected.locationId, channel: channel || service.defaultChannel, firstName: session.user.firstName, lastName: session.user.lastName, email: session.user.email, phone: session.profile?.phone || undefined, notes, intakeResponses: service.intakeFields.filter(field => intake[String(field.id)] !== undefined).map(field => ({ fieldId: field.id, label: field.label, type: field.type, value: intake[String(field.id)] })), requestedDocumentLabels: service.requiredDocumentLabels });
      setCreatedId(result.id);
      if (result.payment?.authorizationUrl) {
        await openBookingCheckout(result.payment.authorizationUrl);
      } else if (result.payment?.method === "UNAVAILABLE") setError(result.payment.message || "Your booking is reserved. Contact the provider about payment.");
    } catch (reason) { setError(getFriendlyApiError(reason, "Could not reserve this appointment.")); }
    finally { setBusy(false); }
  }

  function goNext() {
    setError(null);
    setStepIndex(current => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setError(null);
    setStepIndex(current => Math.max(current - 1, 0));
  }

  const canContinue =
    step === "service" ? Boolean(serviceId) :
    step === "details" ? !missingRequired :
    step === "time" ? Boolean(selected) :
    true;

  const title = profile?.provider.displayName || "Book";
  const inFlow = session.isSignedIn && !createdId && !loading;

  return (
    <View style={styles.root}>
      <Screen
        title={title}
        eyebrow={inFlow ? `Step ${stepNumber} of ${steps.length} · ${stepTitles[step]}` : undefined}
        heroContent={
          inFlow ? (
            <View style={styles.progressTrack} accessibilityRole="progressbar">
              <View style={[styles.progressFill, { width: `${(stepNumber / steps.length) * 100}%` }]} />
            </View>
          ) : undefined
        }
      >
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
            {[0, 1, 2].map(index => (
              <View key={index} style={[styles.skeletonRow, { opacity: 1 - index * 0.25 }]} />
            ))}
          </>
        ) : !session.isSignedIn ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sign in to book</Text>
            <Text style={styles.emptyBody}>Your appointment is saved to your account.</Text>
            <AuthButton label="Sign in" style={styles.emptyAction} onPress={() => router.push("/login")} />
          </View>
        ) : createdId ? (
          <View style={styles.doneCard}>
            <View style={styles.doneIcon}>
              <FontAwesome6 name="check" size={20} color={tokens.colors.success} />
            </View>
            <Text style={styles.doneTitle}>Appointment reserved</Text>
            <Text style={styles.doneBody}>
              {service?.name}
              {selected ? ` · ${formatSlotDate(selected.startAt)}, ${formatSlotTime(selected.startAt)}` : ""}
            </Text>
            <Text style={styles.doneCaption}>Open it to see payment status and details.</Text>
            <AuthButton
              label="View appointment"
              style={styles.emptyAction}
              onPress={() => router.replace({ pathname: "/appointments/[bookingId]", params: { bookingId: createdId } })}
            />
          </View>
        ) : step === "service" ? (
          <View style={styles.list}>
            {serviceChoices.map(value => {
              const isSelected = serviceId === value.id;
              return (
                <Pressable
                  key={value.id}
                  style={[styles.choiceRow, isSelected ? styles.choiceRowSelected : null]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => { setServiceId(value.id); setSlots([]); setSelected(null); setChannel(''); setIntake({}); setSlotsLoaded(false); }}
                >
                  <View style={styles.choiceCopy}>
                    <Text style={styles.choiceTitle} numberOfLines={2}>{value.name}</Text>
                    <Text style={styles.choiceMeta} numberOfLines={1}>
                      {value.durationMinutes} min
                      {profile?.provider.currencyCode
                        ? ` · ${new Intl.NumberFormat(undefined, { style: 'currency', currency: profile.provider.currencyCode }).format(value.priceCents / 100)}`
                        : ""}
                    </Text>
                  </View>
                  <View style={[styles.radio, isSelected ? styles.radioSelected : null]}>
                    {isSelected ? <FontAwesome6 name="check" size={11} color="#ffffff" /> : null}
                  </View>
                </Pressable>
              );
            })}
            {serviceChoices.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No services to book</Text>
                <Text style={styles.emptyBody}>This business has not listed bookable services.</Text>
              </View>
            ) : null}
          </View>
        ) : step === "details" && service ? (
          <View style={styles.form}>
            {channels.length > 1 ? (
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Appointment type</Text>
                <View style={styles.chipWrap}>
                  {channels.map(value => {
                    const isSelected = (channel || service.defaultChannel) === value;
                    return (
                      <Pressable
                        key={value}
                        style={[styles.chip, isSelected ? styles.chipSelected : null]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setChannel(value)}
                      >
                        <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>
                          {channelLabels[value] || value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {service.intakeFields.map(field => {
              const id = String(field.id), value = intake[id], options = Array.isArray(field.options) ? field.options.filter((option): option is string => typeof option === 'string') : [];
              const update = (next: string | string[] | boolean) => setIntake(current => ({ ...current, [id]: next }));
              const label = `${String(field.label)}${field.required ? ' *' : ''}`;
              const help = field.helpText ? String(field.helpText) : undefined;

              if (field.type === 'BOOLEAN' || field.type === 'SELECT' || field.type === 'MULTI_SELECT') {
                const choices: Array<{ key: string; label: string; active: boolean; onPress: () => void }> =
                  field.type === 'BOOLEAN'
                    ? [true, false].map(option => ({ key: String(option), label: option ? 'Yes' : 'No', active: value === option, onPress: () => update(option) }))
                    : options.map(option => ({
                        key: option,
                        label: option,
                        active: value === option || (Array.isArray(value) && value.includes(option)),
                        onPress: () => update(field.type === 'SELECT' ? option : Array.isArray(value) && value.includes(option) ? value.filter(item => item !== option) : [...(Array.isArray(value) ? value : []), option]),
                      }));
                return (
                  <View key={id} style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    {help ? <Text style={styles.fieldHelp}>{help}</Text> : null}
                    <View style={styles.chipWrap}>
                      {choices.map(choice => (
                        <Pressable
                          key={choice.key}
                          style={[styles.chip, choice.active ? styles.chipSelected : null]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: choice.active }}
                          onPress={choice.onPress}
                        >
                          <Text style={[styles.chipText, choice.active ? styles.chipTextSelected : null]}>{choice.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              }

              if (field.type === 'LONG_TEXT') {
                return (
                  <View key={id} style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    {help ? <Text style={styles.fieldHelp}>{help}</Text> : null}
                    <TextInput
                      accessibilityLabel={String(field.label)}
                      placeholder={String(field.placeholder || '')}
                      placeholderTextColor={tokens.colors.muted}
                      value={typeof value === 'string' ? value : ''}
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
                  placeholder={String(field.placeholder || '')}
                  value={typeof value === 'string' ? value : ''}
                  onChangeText={update}
                  helperText={help}
                />
              );
            })}

            {service.requiredDocumentLabels.length ? (
              <View style={styles.noteCard}>
                <FontAwesome6 name="file-lines" size={16} color={tokens.colors.ink} />
                <Text style={styles.noteText}>
                  The provider asks for: {service.requiredDocumentLabels.join(', ')}. Contact them to send these.
                </Text>
              </View>
            ) : null}
          </View>
        ) : step === "time" ? (
          <View style={styles.form}>
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <AuthField
                  label="Date"
                  placeholder="YYYY-MM-DD"
                  value={date}
                  onChangeText={value => { setDate(value); setSlots([]); setSelected(null); setSlotsLoaded(false); }}
                  helperText="Dates follow the business timezone. Times show in yours."
                />
              </View>
              <AuthButton
                label={busy ? "" : "Find times"}
                variant="navy"
                loading={busy}
                disabled={busy || !serviceId}
                style={styles.dateButton}
                onPress={() => void loadSlots()}
              />
            </View>

            {busy ? (
              <View style={styles.chipWrap}>
                {[0, 1, 2, 3, 4].map(index => (
                  <View key={index} style={[styles.chip, styles.chipSkeleton, { opacity: 0.8 - index * 0.12 }]} />
                ))}
              </View>
            ) : slots.length > 0 ? (
              <View style={styles.chipWrap}>
                {slots.map(slot => {
                  const isSelected = selected?.startAt === slot.startAt;
                  return (
                    <Pressable
                      key={slot.startAt}
                      style={[styles.chip, isSelected ? styles.chipSelected : null]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={new Date(slot.startAt).toLocaleString()}
                      onPress={() => setSelected(slot)}
                    >
                      <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>
                        {formatSlotTime(slot.startAt)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : slotsLoaded ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No open times</Text>
                <Text style={styles.emptyBody}>Try another date.</Text>
              </View>
            ) : null}

            {selected ? (
              <Text style={styles.selectedLine}>
                {formatSlotDate(selected.startAt)} at {formatSlotTime(selected.startAt)}
              </Text>
            ) : null}
          </View>
        ) : step === "confirm" && service ? (
          <View style={styles.form}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Service</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>{service.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>When</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  {selected ? `${formatSlotDate(selected.startAt)}, ${formatSlotTime(selected.startAt)}` : "Not chosen"}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Type</Text>
                <Text style={styles.summaryValue}>{channelLabels[channel || service.defaultChannel] || channel || service.defaultChannel}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Length</Text>
                <Text style={styles.summaryValue}>{service.durationMinutes} min</Text>
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

            <Text style={styles.caption}>Online payment opens after the appointment is reserved.</Text>
          </View>
        ) : null}
      </Screen>

      {inFlow ? (
        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          <View style={styles.footerRow}>
            {stepNumber > 1 ? (
              <AuthButton label="Back" variant="secondary" style={styles.footerBack} onPress={goBack} />
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
  dateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  dateField: {
    flex: 1,
  },
  dateButton: {
    marginTop: 26,
    minHeight: 52,
    paddingHorizontal: 16,
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

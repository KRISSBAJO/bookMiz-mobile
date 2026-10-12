import { useFocusEffect } from "expo-router/react-navigation";
import { FontAwesome6 } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthButton } from "@/src/components/auth/AuthButton";
import { Screen } from "@/src/components/Screen";
import { SectionHeader } from "@/src/components/SectionHeader";
import { AgentWorkbenchScreen } from "@/src/screens/AgentWorkbenchScreen";
import {
  acceptCustomerQuoteMatch,
  createServiceRequest,
  listCustomerQuoteRequests,
  listMarketplaceRequestTemplates,
  sendRequesterQuoteMessage,
} from "@/src/lib/api/marketplace";
import type {
  CustomerQuoteConversation,
  CustomerQuoteRequest,
  MarketplaceRequestTemplate,
} from "@/src/lib/api/types";
import { getFriendlyApiError } from "@/src/lib/api/error-display";
import { formatMarketplaceDistance, formatMarketplacePrice } from "@/src/lib/marketplace-display";
import {
  buildIntakeResponses,
  buildRequestDescription,
  formatRequestedChannels,
  getChannelOptionsForServiceModel,
  normalizeRequestedChannels,
  parseTemplateIntakeFields,
  type AppointmentChannel,
  type ServiceRequestIntakeAnswerMap,
  type ServiceRequestServiceModel,
} from "@/src/lib/service-request-utils";
import { useSession } from "@/src/store/session-context";
import { tokens } from "@/src/theme/tokens";

const quoteFilters = [
  { id: "ALL", label: "All requests" },
  { id: "OPEN", label: "Open" },
  { id: "MATCHED", label: "Matched" },
  { id: "ACCEPTED", label: "Accepted" },
] as const;

type QuoteFilterId = (typeof quoteFilters)[number]["id"];
type ComposerStepId = "request" | "location" | "review";
type PickerField = "desiredDate" | "desiredWindowStart" | "desiredWindowEnd";

const composerSteps: Array<{
  id: ComposerStepId;
  label: string;
  title: string;
}> = [
  { id: "request", label: "Request", title: "Choose a brief and describe the need" },
  { id: "location", label: "Location", title: "Add where and when" },
  { id: "review", label: "Review", title: "Check details and send" },
];

const fallbackTemplates: MarketplaceRequestTemplate[] = [
  {
    id: "fallback-manicure",
    name: "Manicure",
    slug: "manicure",
    shortDescription: "Polish, gel, acrylic, or a clean nail refresh.",
    description: "Polish, gel, acrylic, or a clean nail refresh.",
    serviceModel: "LOCAL",
    suggestedSearchRadiusMiles: 10,
    defaultBudgetMinCents: 5000,
    defaultBudgetMaxCents: 14000,
    estimatedDurationLabel: "45-75 min",
    requiresDate: true,
    requiresTimeWindow: true,
    requiresAddress: false,
    allowsProviderSelection: true,
    intakeFields: [],
    businessCategory: {
      id: "fallback-beauty",
      name: "Beauty",
      slug: "beauty",
      serviceModel: "LOCAL",
    },
    checklistItems: ["Preferred style", "Timing", "Your city"],
  },
  {
    id: "fallback-haircut",
    name: "Haircut",
    slug: "haircut",
    shortDescription: "Cuts, fades, trims, and grooming requests.",
    description: "Cuts, fades, trims, and grooming requests.",
    serviceModel: "LOCAL",
    suggestedSearchRadiusMiles: 12,
    defaultBudgetMinCents: 3500,
    defaultBudgetMaxCents: 9000,
    estimatedDurationLabel: "30-60 min",
    requiresDate: true,
    requiresTimeWindow: true,
    requiresAddress: false,
    allowsProviderSelection: true,
    intakeFields: [],
    businessCategory: {
      id: "fallback-grooming",
      name: "Grooming",
      slug: "grooming",
      serviceModel: "LOCAL",
    },
    checklistItems: ["Service type", "Preferred date", "Budget range"],
  },
  {
    id: "fallback-massage",
    name: "Massage",
    slug: "massage",
    shortDescription: "At-home or in-studio wellness sessions with clear timing.",
    description: "At-home or in-studio wellness sessions with clear timing.",
    serviceModel: "LOCAL",
    suggestedSearchRadiusMiles: 12,
    defaultBudgetMinCents: 7000,
    defaultBudgetMaxCents: 18000,
    estimatedDurationLabel: "60-90 min",
    requiresDate: true,
    requiresTimeWindow: true,
    requiresAddress: true,
    allowsProviderSelection: true,
    intakeFields: [],
    businessCategory: {
      id: "fallback-wellness",
      name: "Wellness",
      slug: "wellness",
      serviceModel: "LOCAL",
    },
    checklistItems: ["Pressure or style", "Location", "Length of session"],
  },
];

function formatRequestStatus(status: CustomerQuoteRequest["status"]) {
  switch (status) {
    case "MATCHED":
      return "Matched";
    case "ACCEPTED":
      return "Accepted";
    case "CANCELLED":
      return "Cancelled";
    case "EXPIRED":
      return "Expired";
    default:
      return "Open";
  }
}

function formatDateLabel(value?: string | null) {
  if (!value) {
    return "Flexible";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTimeLabel(value?: string | null) {
  if (!value) {
    return "Flexible";
  }

  const [hour, minute] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value;
  }

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function messageSenderLabel(
  message: CustomerQuoteConversation["messages"][number],
  conversation: CustomerQuoteConversation,
) {
  const isRequester =
    message.senderRole === "REQUESTER" ||
    (!!conversation.requesterEmail && message.senderEmail === conversation.requesterEmail);

  return isRequester ? "You" : message.senderName;
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function WorkbenchScreen() {
  const session = useSession();
  const params = useLocalSearchParams<{
    service?: string;
    city?: string;
    provider?: string;
    description?: string;
  }>();

  if (session.activePersona === "agent") {
    return <AgentWorkbenchScreen />;
  }

  const [templates, setTemplates] = useState<MarketplaceRequestTemplate[]>([]);
  const [requests, setRequests] = useState<CustomerQuoteRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [filter, setFilter] = useState<QuoteFilterId>("ALL");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerStep, setComposerStep] = useState<ComposerStepId>("request");
  const [templateId, setTemplateId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState(session.profile?.city ?? session.user?.city ?? "");
  const [stateCode, setStateCode] = useState(session.profile?.stateCode ?? session.user?.stateCode ?? "");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [countyName, setCountyName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState(session.profile?.countryCode ?? "US");
  const [searchRadiusMiles, setSearchRadiusMiles] = useState("15");
  const [desiredDate, setDesiredDate] = useState("");
  const [desiredWindowStart, setDesiredWindowStart] = useState("");
  const [desiredWindowEnd, setDesiredWindowEnd] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [contactPhone, setContactPhone] = useState(session.profile?.phone ?? "");
  const [requestedChannels, setRequestedChannels] = useState<AppointmentChannel[]>([]);
  const [intakeAnswers, setIntakeAnswers] = useState<ServiceRequestIntakeAnswerMap>({});
  const [requestedDocumentLabels, setRequestedDocumentLabels] = useState<string[]>([]);
  const [activePicker, setActivePicker] = useState<null | { field: PickerField; mode: "date" | "time" }>(
    null,
  );
  const [pickerDraftValue, setPickerDraftValue] = useState(new Date());
  const [messageDraft, setMessageDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [acceptingMatchId, setAcceptingMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.service) {
      setServiceName((current) => current || params.service || "");
      setDescription((current) => current || params.description || "");
      setCity((current) => current || params.city || "");
      setComposerStep("request");
      setComposerOpen(true);
    }
  }, [params.city, params.description, params.service]);

  const loadWorkspace = useCallback(async () => {
    if (!session.user) {
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      const [nextTemplates, nextRequests] = await Promise.all([
        listMarketplaceRequestTemplates({ serviceModel: "LOCAL" }),
        listCustomerQuoteRequests({
          requesterUserId: session.user.id,
          requesterEmail: session.user.email,
          status: filter === "ALL" ? undefined : filter,
        }),
      ]);

      setTemplates(nextTemplates);
      setRequests(nextRequests);
      setSelectedRequestId((current) =>
        current && nextRequests.some((request) => request.id === current)
          ? current
          : nextRequests[0]?.id ?? null,
      );
    } catch (nextError) {
      const message = getFriendlyApiError(
        nextError,
        "We could not load your customer requests.",
      );
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filter, session.user]);

  useFocusEffect(
    useCallback(() => {
      void loadWorkspace();
    }, [loadWorkspace]),
  );

  const requestTemplates = templates.length > 0 ? templates : fallbackTemplates;

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? requests[0] ?? null,
    [requests, selectedRequestId],
  );

  useEffect(() => {
    if (!selectedRequest) {
      setSelectedConversationId(null);
      return;
    }

    const hasSelectedConversation = selectedRequest.conversations.some(
      (conversation) => conversation.id === selectedConversationId,
    );

    if (!hasSelectedConversation) {
      setSelectedConversationId(selectedRequest.conversations[0]?.id ?? null);
    }
  }, [selectedConversationId, selectedRequest]);

  const selectedConversation = useMemo(
    () =>
      selectedRequest?.conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ) ?? null,
    [selectedConversationId, selectedRequest],
  );

  const activeTemplate = useMemo(
    () => requestTemplates.find((template) => template.id === templateId) ?? null,
    [requestTemplates, templateId],
  );

  const intakeFields = useMemo(
    () => parseTemplateIntakeFields(activeTemplate?.intakeFields ?? []),
    [activeTemplate?.intakeFields],
  );

  const effectiveServiceModel = useMemo<ServiceRequestServiceModel>(
    () => activeTemplate?.serviceModel ?? "LOCAL",
    [activeTemplate?.serviceModel],
  );

  const channelOptions = useMemo(
    () => getChannelOptionsForServiceModel(effectiveServiceModel),
    [effectiveServiceModel],
  );

  const normalizedRequestedChannels = useMemo(
    () =>
      normalizeRequestedChannels(
        requestedChannels,
        effectiveServiceModel,
        activeTemplate?.requiresAddress ?? effectiveServiceModel === "LOCAL",
      ),
    [activeTemplate?.requiresAddress, effectiveServiceModel, requestedChannels],
  );

  const intakeResponses = useMemo(
    () => buildIntakeResponses(intakeFields, intakeAnswers),
    [intakeAnswers, intakeFields],
  );

  useEffect(() => {
    if (!activeTemplate) {
      return;
    }

    setServiceName(activeTemplate.name);
    setBudgetMin(
      activeTemplate.defaultBudgetMinCents ? String(activeTemplate.defaultBudgetMinCents / 100) : "",
    );
    setBudgetMax(
      activeTemplate.defaultBudgetMaxCents ? String(activeTemplate.defaultBudgetMaxCents / 100) : "",
    );
    setSearchRadiusMiles(String(activeTemplate.suggestedSearchRadiusMiles ?? 15));
    setRequestedDocumentLabels(activeTemplate.checklistItems ?? []);
    setRequestedChannels(
      normalizeRequestedChannels(
        requestedChannels,
        activeTemplate.serviceModel ?? "LOCAL",
        activeTemplate.requiresAddress,
      ),
    );
    setIntakeAnswers({});
  }, [activeTemplate]);

  const updateIntakeAnswer = useCallback(
    (fieldId: string, value: ServiceRequestIntakeAnswerMap[string]) => {
      setIntakeAnswers((current) => ({
        ...current,
        [fieldId]: value,
      }));
    },
    [],
  );

  const toggleRequestedChannel = useCallback((channel: AppointmentChannel) => {
    setRequestedChannels((current) =>
      current.includes(channel)
        ? current.filter((value) => value !== channel)
        : [...current, channel],
    );
  }, []);

  const toggleRequestedDocument = useCallback((label: string) => {
    setRequestedDocumentLabels((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label],
    );
  }, []);

  const canSubmitRequest = useMemo(
    () =>
      serviceName.trim().length >= 3 &&
      description.trim().length >= 12 &&
      city.trim().length >= 2 &&
      countryCode.trim().length >= 2,
    [city, countryCode, description, serviceName],
  );

  const canContinueFromRequest = useMemo(() => {
    if (!(serviceName.trim().length >= 3 && description.trim().length >= 12)) {
      return false;
    }

    if (activeTemplate?.requiresDate && !desiredDate.trim()) {
      return false;
    }

    if (
      activeTemplate?.requiresTimeWindow &&
      !desiredWindowStart.trim() &&
      !desiredWindowEnd.trim()
    ) {
      return false;
    }

    const missingRequiredField = intakeFields.find((field) => {
      const value = intakeAnswers[field.id];

      if (!field.required) {
        return false;
      }

      if (typeof value === "boolean") {
        return false;
      }

      if (Array.isArray(value)) {
        return value.length === 0;
      }

      return typeof value !== "string" || value.trim().length === 0;
    });

    return !missingRequiredField;
  }, [
    activeTemplate?.requiresDate,
    activeTemplate?.requiresTimeWindow,
    description,
    desiredDate,
    desiredWindowEnd,
    desiredWindowStart,
    intakeAnswers,
    intakeFields,
    serviceName,
  ]);

  const canContinueFromLocation = useMemo(
    () => city.trim().length >= 2 && countryCode.trim().length >= 2,
    [city, countryCode],
  );

  const unmatchedCount = requests.reduce(
    (count, request) => count + request.matches.length,
    0,
  );

  const resetComposer = useCallback(() => {
    setComposerStep("request");
    setTemplateId("");
    setServiceName("");
    setDescription("");
    setLine1("");
    setLine2("");
    setCountyName("");
    setPostalCode("");
    setCountryCode(session.profile?.countryCode ?? "US");
    setSearchRadiusMiles("15");
    setDesiredDate("");
    setDesiredWindowStart("");
    setDesiredWindowEnd("");
    setBudgetMin("");
    setBudgetMax("");
    setContactPhone(session.profile?.phone ?? "");
    setRequestedChannels([]);
    setIntakeAnswers({});
    setRequestedDocumentLabels([]);
    setActivePicker(null);
    setCity(session.profile?.city ?? session.user?.city ?? "");
    setStateCode(session.profile?.stateCode ?? session.user?.stateCode ?? "");
  }, [
    session.profile?.city,
    session.profile?.countryCode,
    session.profile?.phone,
    session.profile?.stateCode,
    session.user?.city,
    session.user?.stateCode,
  ]);

  const openComposer = useCallback(
    (nextTemplateId?: string) => {
      if (nextTemplateId) {
        setTemplateId(nextTemplateId);
      }

      setComposerStep("request");
      setComposerOpen(true);
    },
    [],
  );

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setComposerStep("request");
    setActivePicker(null);
  }, []);

  const resolvePickerDate = useCallback(
    (field: PickerField) => {
      if (field === "desiredDate") {
        return desiredDate ? new Date(`${desiredDate}T12:00:00`) : new Date();
      }

      const source = field === "desiredWindowStart" ? desiredWindowStart : desiredWindowEnd;

      if (!source) {
        return new Date();
      }

      const [hour, minute] = source.split(":").map((part) => Number(part));
      const next = new Date();
      next.setHours(hour || 0, minute || 0, 0, 0);
      return next;
    },
    [desiredDate, desiredWindowEnd, desiredWindowStart],
  );

  const applyPickerValue = useCallback((field: PickerField, selectedValue: Date) => {
    if (field === "desiredDate") {
      setDesiredDate(selectedValue.toISOString().slice(0, 10));
      return;
    }

    const hours = String(selectedValue.getHours()).padStart(2, "0");
    const minutes = String(selectedValue.getMinutes()).padStart(2, "0");
    const timeValue = `${hours}:${minutes}`;

    if (field === "desiredWindowStart") {
      setDesiredWindowStart(timeValue);
    } else {
      setDesiredWindowEnd(timeValue);
    }
  }, []);

  const openPicker = useCallback(
    (field: PickerField, mode: "date" | "time") => {
      setPickerDraftValue(resolvePickerDate(field));
      setActivePicker({ field, mode });
    },
    [resolvePickerDate],
  );

  const closePicker = useCallback(() => {
    setActivePicker(null);
  }, []);

  const confirmPicker = useCallback(() => {
    if (!activePicker) {
      return;
    }

    applyPickerValue(activePicker.field, pickerDraftValue);
    setActivePicker(null);
  }, [activePicker, applyPickerValue, pickerDraftValue]);

  const handlePickerChange = useCallback(
    (event: { type?: string }, selectedValue?: Date) => {
      if (!activePicker) {
        return;
      }

      if (event?.type === "dismissed") {
        setActivePicker(null);
        return;
      }

      if (!selectedValue) {
        return;
      }

      setPickerDraftValue(selectedValue);

      if (Platform.OS !== "ios") {
        applyPickerValue(activePicker.field, selectedValue);
        setActivePicker(null);
      }
    },
    [activePicker, applyPickerValue],
  );

  const handleCreateRequest = useCallback(async () => {
    if (!session.user || !canSubmitRequest) {
      return;
    }

    try {
      setError(null);
      setIsSubmitting(true);

      await createServiceRequest({
        requesterUserId: session.user.id,
        requesterName: `${session.user.firstName} ${session.user.lastName}`.trim(),
        requesterEmail: session.user.email,
        requesterPhone: contactPhone.trim() || session.profile?.phone || undefined,
        requestedServiceName: serviceName.trim(),
        requestedCategoryName: activeTemplate?.businessCategory?.name,
        description: buildRequestDescription({
          description,
          serviceModel: effectiveServiceModel,
          requestedChannels: normalizedRequestedChannels,
          searchAddress:
            [line1, line2, city, stateCode, postalCode].filter(Boolean).join(", ") || undefined,
          city,
          stateCode,
          countryCode,
          searchRadiusMiles,
          intakeResponses,
          requestedDocumentLabels,
        }),
        serviceModel: effectiveServiceModel,
        requestedChannels: normalizedRequestedChannels,
        intakeResponses,
        requestedDocumentLabels,
        city: city.trim(),
        countyName: countyName.trim() || undefined,
        stateCode: stateCode.trim().toUpperCase() || undefined,
        postalCode: postalCode.trim() || undefined,
        countryCode: countryCode.trim().toUpperCase() || "US",
        line1: line1.trim() || undefined,
        line2: line2.trim() || undefined,
        desiredDate: desiredDate.trim() || undefined,
        desiredWindowStart: desiredWindowStart.trim() || undefined,
        desiredWindowEnd: desiredWindowEnd.trim() || undefined,
        budgetMinCents: budgetMin.trim() ? Math.round(Number(budgetMin) * 100) : undefined,
        budgetMaxCents: budgetMax.trim() ? Math.round(Number(budgetMax) * 100) : undefined,
        searchRadiusMiles: searchRadiusMiles.trim() ? Number(searchRadiusMiles) : undefined,
        notificationStrategy: "AUTO_NOTIFY_ALL",
      });

      closeComposer();
      resetComposer();
      await loadWorkspace();
    } catch (nextError) {
      const message = getFriendlyApiError(
        nextError,
        "We could not create your request right now.",
      );
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeTemplate,
    budgetMax,
    budgetMin,
    canSubmitRequest,
    city,
    contactPhone,
    countryCode,
    countyName,
    description,
    desiredDate,
    desiredWindowEnd,
    desiredWindowStart,
    effectiveServiceModel,
    intakeResponses,
    line2,
    line1,
    loadWorkspace,
    closeComposer,
    normalizedRequestedChannels,
    postalCode,
    requestedDocumentLabels,
    resetComposer,
    searchRadiusMiles,
    serviceName,
    session.profile?.phone,
    session.user,
    stateCode,
  ]);

  const handleSendMessage = useCallback(async () => {
    if (!selectedRequest || !selectedConversation || !messageDraft.trim()) {
      return;
    }

    try {
      setError(null);
      setIsSendingMessage(true);
      await sendRequesterQuoteMessage(selectedRequest.id, selectedConversation.id, {
        requesterUserId: session.user?.id,
        requesterEmail: session.user?.email,
        content: messageDraft.trim(),
      });
      setMessageDraft("");
      await loadWorkspace();
    } catch (nextError) {
      const message = getFriendlyApiError(nextError, "We could not send your message.");
      setError(message);
    } finally {
      setIsSendingMessage(false);
    }
  }, [loadWorkspace, messageDraft, selectedConversation, selectedRequest, session.user?.email, session.user?.id]);

  const handleAcceptMatch = useCallback(
    async (matchId: string) => {
      if (!selectedRequest) {
        return;
      }

      try {
        setError(null);
        setAcceptingMatchId(matchId);
        await acceptCustomerQuoteMatch(selectedRequest.id, matchId, {
          requesterUserId: session.user?.id,
          requesterEmail: session.user?.email,
        });
        await loadWorkspace();
      } catch (nextError) {
        const message = getFriendlyApiError(
          nextError,
          "We could not accept that provider yet.",
        );
        setError(message);
      } finally {
        setAcceptingMatchId(null);
      }
    },
    [loadWorkspace, selectedRequest, session.user?.email, session.user?.id],
  );

  const composerStepIndex = composerSteps.findIndex((step) => step.id === composerStep);
  const reviewRows = [
    { label: "Service", value: serviceName.trim() || "Not set yet" },
    { label: "Template", value: activeTemplate?.name ?? "Custom request" },
    {
      label: "Location",
      value:
        [city.trim(), stateCode.trim().toUpperCase()].filter(Boolean).join(", ") ||
        "Location not added yet",
    },
    {
      label: "Timing",
      value:
        [
          desiredDate.trim() ? formatDateLabel(desiredDate.trim()) : "",
          desiredWindowStart.trim() ? formatTimeLabel(desiredWindowStart.trim()) : "",
          desiredWindowEnd.trim() ? formatTimeLabel(desiredWindowEnd.trim()) : "",
        ]
          .filter(Boolean)
          .join(" · ") ||
        "Flexible timing",
    },
    {
      label: "Budget",
      value:
        budgetMin.trim() || budgetMax.trim()
          ? `${budgetMin.trim() ? `$${budgetMin.trim()}` : "Open"} - ${
              budgetMax.trim() ? `$${budgetMax.trim()}` : "Open"
            }`
          : "Open budget",
    },
    {
      label: "Delivery",
      value: formatRequestedChannels(normalizedRequestedChannels, effectiveServiceModel),
    },
  ];

  return (
    <>
      <Screen
        eyebrow="Customer requests"
        title="Quotes, requests, and next moves"
        subtitle="Create a polished service request, review provider matches, and keep live conversations in one place."
        contentTopOffset={24}
        heroBottomPadding={40}
        heroContent={
          <View style={styles.heroMetrics}>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{requests.length}</Text>
              <Text style={styles.heroMetricLabel}>requests</Text>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{unmatchedCount}</Text>
              <Text style={styles.heroMetricLabel}>matches</Text>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{selectedRequest?.conversations.length ?? 0}</Text>
              <Text style={styles.heroMetricLabel}>chats</Text>
            </View>
          </View>
        }
      >
        <View style={styles.panel}>
          <View style={styles.workspaceHero}>
            <View style={styles.workspaceHeroCopy}>
              <Text style={styles.workspaceEyebrow}>Request concierge</Text>
              <Text style={styles.workspaceTitle}>One place for briefs, quotes, and replies</Text>
              <Text style={styles.workspaceBody}>
                Start with a polished brief, then keep the request, matched providers, and live
                conversation in a single flow.
              </Text>
            </View>
            <View style={styles.workspaceMetaRail}>
              <View style={styles.workspaceMetaCard}>
                <Text style={styles.workspaceMetaValue}>{requests.length}</Text>
                <Text style={styles.workspaceMetaLabel}>Open boards</Text>
              </View>
              <View style={styles.workspaceMetaCard}>
                <Text style={styles.workspaceMetaValue}>{unmatchedCount}</Text>
                <Text style={styles.workspaceMetaLabel}>Live matches</Text>
              </View>
              <View style={styles.workspaceMetaCard}>
                <Text style={styles.workspaceMetaValue}>{selectedRequest?.conversations.length ?? 0}</Text>
                <Text style={styles.workspaceMetaLabel}>Active chats</Text>
              </View>
            </View>
          </View>
          <View style={styles.actionBar}>
            <Pressable style={styles.actionButton} onPress={() => openComposer()}>
              <View style={styles.actionButtonIcon}>
                <FontAwesome6 name="wand-magic-sparkles" size={14} color="#fff" />
              </View>
              <View style={styles.actionButtonCopy}>
                <Text style={styles.actionButtonTitle}>Start a new request</Text>
                <Text style={styles.actionButtonSubtitle}>Open the guided request composer</Text>
              </View>
              <FontAwesome6 name="arrow-right" size={14} color="rgba(255,255,255,0.82)" />
            </Pressable>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRail}
            >
              {quoteFilters.map((item) => {
                const isActive = item.id === filter;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                    onPress={() => setFilter(item.id)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isActive ? styles.filterChipTextActive : null,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.templatePreviewWrap}>
            <SectionHeader
              title="Start from a request brief"
              subtitle="Use a tailored request pattern, then shape the details inside the mobile composer."
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.templateRail}
            >
              {requestTemplates.map((template) => (
                <Pressable
                  key={template.id}
                  style={styles.templateCard}
                  onPress={() => {
                    openComposer(template.id);
                  }}
                >
                  <View style={styles.templateBadgeRow}>
                    <Text style={styles.templateBadge}>
                      {template.serviceModel === "PROFESSIONAL" ? "Professional" : "Local"}
                    </Text>
                    {template.businessCategory?.name ? (
                      <Text style={styles.templateCategory}>{template.businessCategory.name}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.templateTitle}>{template.name}</Text>
                  <Text style={styles.templateBody}>{template.shortDescription}</Text>
                  <Text style={styles.templateHint}>Open request flow</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {requests.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>No requests in motion yet</Text>
              <Text style={styles.emptyText}>
                Create your first request and provider matches, quotes, and chats will start gathering here.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.requestRail}
            >
              {requests.map((request) => {
                const isActive = request.id === selectedRequest?.id;
                return (
                  <Pressable
                    key={request.id}
                    style={[styles.requestCard, isActive ? styles.requestCardActive : null]}
                    onPress={() => setSelectedRequestId(request.id)}
                  >
                    <View style={styles.requestCardTop}>
                      <Text style={styles.requestCardTitle}>{request.requestedServiceName}</Text>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>
                          {formatRequestStatus(request.status)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.requestCardMeta}>
                      {request.city}
                      {request.stateCode ? `, ${request.stateCode}` : ""} · {request.matches.length} matches
                    </Text>
                    <Text style={styles.requestCardBody} numberOfLines={3}>
                      {request.description}
                    </Text>
                    <View style={styles.requestSignalRail}>
                      <View style={styles.requestSignalPill}>
                        <Text style={styles.requestSignalText}>
                          {request.matches.length} {request.matches.length === 1 ? "match" : "matches"}
                        </Text>
                      </View>
                      <View style={styles.requestSignalPillMuted}>
                        <Text style={styles.requestSignalTextMuted}>
                          {request.desiredDate
                            ? formatDateLabel(request.desiredDate)
                            : "Flexible timing"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.requestCardDate}>
                      Updated {formatDateLabel(request.updatedAt)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.panel}>
          <SectionHeader
            title={selectedRequest ? selectedRequest.requestedServiceName : "Select a request"}
            subtitle={
              selectedRequest
                ? selectedRequest.description
                : "Choose a live request to review matches and conversations."
            }
          />
          {selectedRequest ? (
            <View style={styles.detailsGrid}>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>
                  {selectedRequest.city}
                  {selectedRequest.stateCode ? `, ${selectedRequest.stateCode}` : ""}
                </Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formatDateLabel(selectedRequest.desiredDate)}</Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Budget</Text>
                <Text style={styles.detailValue}>
                  {selectedRequest.budgetMinCents || selectedRequest.budgetMaxCents
                    ? `${formatMarketplacePrice(selectedRequest.budgetMinCents)} - ${formatMarketplacePrice(selectedRequest.budgetMaxCents)}`
                    : "Open budget"}
                </Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Conversations</Text>
                <Text style={styles.detailValue}>
                  {selectedRequest.conversations.length} active
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              Start a request or select an existing one to review providers and messages.
            </Text>
          )}
        </View>

        {selectedRequest ? (
          <View style={styles.panel}>
            <SectionHeader
              title="Matched providers"
              subtitle="Review real providers, open a conversation, or accept the strongest fit."
            />
            {selectedRequest.matches.length === 0 ? (
              <Text style={styles.emptyText}>
                No providers have matched this request yet.
              </Text>
            ) : (
              selectedRequest.matches.map((match) => {
                const conversation = selectedRequest.conversations.find(
                  (item) => item.quoteMatchId === match.id,
                );
                const isAccepted = selectedRequest.acceptedQuoteMatchId === match.id;

                return (
                  <View key={match.id} style={styles.matchCard}>
                    <View style={styles.matchTop}>
                      <View style={styles.matchIdentity}>
                        <View style={styles.matchAvatar}>
                          <Text style={styles.matchAvatarText}>
                            {getInitials(match.provider.displayName || "BM")}
                          </Text>
                        </View>
                        <View style={styles.matchCopy}>
                          <Text style={styles.matchTitle}>{match.provider.displayName}</Text>
                          <Text style={styles.matchMeta}>
                            {match.matchedService?.name ??
                              match.provider.businessCategory ??
                              "Service provider"}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.matchPill}>
                        <Text style={styles.matchPillText}>
                          {isAccepted ? "Accepted" : match.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.matchMetaRail}>
                      <View style={styles.matchMetaChip}>
                        <Text style={styles.matchMetaChipText}>
                          {match.provider.businessCategory ?? "Provider"}
                        </Text>
                      </View>
                      <View style={styles.matchMetaChip}>
                        <Text style={styles.matchMetaChipText}>
                          {formatMarketplaceDistance(match.distanceMiles)}
                        </Text>
                      </View>
                      {match.provider.averageRating ? (
                        <View style={styles.matchMetaChip}>
                          <Text style={styles.matchMetaChipText}>
                            {match.provider.averageRating.toFixed(1)} rating
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.matchInfoRow}>
                      <Text style={styles.matchPrice}>
                        {match.matchedService?.priceCents
                          ? formatMarketplacePrice(match.matchedService.priceCents)
                          : "Pricing on request"}
                      </Text>
                      <Text style={styles.matchRating}>
                        {conversation ? "Chat ready" : "Awaiting reply"}
                      </Text>
                    </View>

                    <View style={styles.matchButtonRow}>
                      {conversation ? (
                        <Pressable
                          style={styles.secondaryAction}
                          onPress={() => setSelectedConversationId(conversation.id)}
                        >
                          <Text style={styles.secondaryActionText}>Open chat</Text>
                        </Pressable>
                      ) : null}
                      {!isAccepted ? (
                        <Pressable
                          style={styles.primaryAction}
                          onPress={() => void handleAcceptMatch(match.id)}
                        >
                          <Text style={styles.primaryActionText}>
                            {acceptingMatchId === match.id ? "Accepting..." : "Accept provider"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : null}

        {selectedConversation ? (
          <View style={styles.panel}>
            <SectionHeader
              title={selectedConversation.provider?.displayName ?? "Conversation"}
              subtitle="Live customer-provider messaging for this request."
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.conversationTabs}
            >
              {selectedRequest?.conversations.map((conversation) => {
                const isActive = conversation.id === selectedConversation.id;
                return (
                  <Pressable
                    key={conversation.id}
                    style={[styles.conversationTab, isActive ? styles.conversationTabActive : null]}
                    onPress={() => setSelectedConversationId(conversation.id)}
                  >
                    <Text
                      style={[
                        styles.conversationTabText,
                        isActive ? styles.conversationTabTextActive : null,
                      ]}
                    >
                      {conversation.provider?.displayName ?? "Provider"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.messagesWrap}>
              {selectedConversation.messages.map((message) => {
                const isRequester = messageSenderLabel(message, selectedConversation) === "You";
                return (
                  <View
                    key={message.id}
                    style={[
                      styles.messageRow,
                      isRequester ? styles.messageRowRight : styles.messageRowLeft,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        isRequester ? styles.messageBubbleOwn : styles.messageBubbleOther,
                      ]}
                    >
                      <Text style={styles.messageSender}>
                        {messageSenderLabel(message, selectedConversation)}
                      </Text>
                      <Text
                        style={[
                          styles.messageContent,
                          isRequester ? styles.messageContentOwn : null,
                        ]}
                      >
                        {message.content}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.messageComposer}>
              <TextInput
                value={messageDraft}
                onChangeText={setMessageDraft}
                placeholder="Type your reply..."
                placeholderTextColor={tokens.colors.mutedSoft}
                style={styles.messageInput}
                multiline
              />
              <Pressable
                style={styles.primaryAction}
                onPress={() => void handleSendMessage()}
              >
                <Text style={styles.primaryActionText}>
                  {isSendingMessage ? "Sending..." : "Send"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {selectedRequest && !selectedConversation ? (
          <View style={styles.panel}>
            <SectionHeader
              title="Provider conversation"
              subtitle="When matched providers reply, the active thread for this request will land here."
            />
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>No live chat yet</Text>
              <Text style={styles.emptyText}>
                Accept a match or wait for a provider reply and the conversation thread will appear here.
              </Text>
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {isLoading ? <Text style={styles.loadingText}>Refreshing live request activity…</Text> : null}
      </Screen>

      <Modal
        visible={composerOpen}
        transparent
        animationType="slide"
        onRequestClose={closeComposer}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeComposer} />
          <View style={styles.modalSheetWrap}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.modalKeyboardWrap}
            >
              <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderCopy}>
                    <Text style={styles.modalTitle}>Create a service request</Text>
                    <Text style={styles.modalSubtitle}>
                      A cleaner mobile request flow modeled after the BookMiz web experience.
                    </Text>
                  </View>
                  <Pressable style={styles.closeButton} onPress={closeComposer}>
                    <FontAwesome6 name="xmark" size={18} color={tokens.colors.ink} />
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.stepRail}
                  >
                    {composerSteps.map((step, index) => {
                      const isActive = step.id === composerStep;
                      const isComplete = composerStepIndex > index;

                      return (
                        <Pressable
                          key={step.id}
                          style={[
                            styles.stepCard,
                            isActive ? styles.stepCardActive : null,
                            isComplete ? styles.stepCardComplete : null,
                          ]}
                          onPress={() => {
                            if (index <= composerStepIndex) {
                              setComposerStep(step.id);
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.stepLabel,
                              isActive ? styles.stepLabelActive : null,
                            ]}
                          >
                            {step.label}
                          </Text>
                          <Text
                            style={[
                              styles.stepTitle,
                              isActive ? styles.stepTitleActive : null,
                            ]}
                          >
                            {step.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {composerStep === "request" ? (
                    <>
                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionLabel}>Pick a request brief</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.templateRail}
                        >
                          {requestTemplates.map((template) => {
                            const isActive = template.id === templateId;
                            return (
                              <Pressable
                                key={template.id}
                                style={[
                                  styles.templateCard,
                                  isActive ? styles.templateCardActive : null,
                                ]}
                                onPress={() => setTemplateId(template.id)}
                              >
                                <Text
                                  style={[
                                    styles.templateTitle,
                                    isActive ? styles.templateTitleActive : null,
                                  ]}
                                >
                                  {template.name}
                                </Text>
                                <Text
                                  style={[
                                    styles.templateBody,
                                    isActive ? styles.templateBodyActive : null,
                                  ]}
                                >
                                  {template.shortDescription}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>

                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionLabel}>Service brief</Text>
                        <View style={styles.formGroup}>
                          <Text style={styles.fieldLabel}>Service</Text>
                          <TextInput
                            value={serviceName}
                            onChangeText={setServiceName}
                            placeholder="Legal consult, haircut, tutoring session..."
                            placeholderTextColor={tokens.colors.mutedSoft}
                            style={styles.fieldInput}
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.fieldLabel}>What do you need?</Text>
                          <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Tell BookMiz the style, timing, and details that matter."
                            placeholderTextColor={tokens.colors.mutedSoft}
                            style={[styles.fieldInput, styles.fieldInputTall]}
                            multiline
                            textAlignVertical="top"
                          />
                        </View>
                      </View>

                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionLabel}>Budget and timing</Text>
                        <View style={styles.formRow}>
                          <View style={styles.formColumn}>
                            <Text style={styles.fieldLabel}>Budget min</Text>
                            <TextInput
                              value={budgetMin}
                              onChangeText={setBudgetMin}
                              placeholder="80"
                              placeholderTextColor={tokens.colors.mutedSoft}
                              style={styles.fieldInput}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={styles.formColumn}>
                            <Text style={styles.fieldLabel}>Budget max</Text>
                            <TextInput
                              value={budgetMax}
                              onChangeText={setBudgetMax}
                              placeholder="150"
                              placeholderTextColor={tokens.colors.mutedSoft}
                              style={styles.fieldInput}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.fieldLabel}>Preferred date</Text>
                          <Pressable
                            style={styles.pickerField}
                            onPress={() => openPicker("desiredDate", "date")}
                          >
                            <Text
                              style={[
                                styles.pickerFieldText,
                                !desiredDate ? styles.pickerFieldPlaceholder : null,
                              ]}
                            >
                              {desiredDate ? formatDateLabel(desiredDate) : "Choose a date"}
                            </Text>
                            <FontAwesome6 name="calendar" size={16} color={tokens.colors.muted} />
                          </Pressable>
                        </View>

                        <View style={styles.formRow}>
                          <View style={styles.formColumn}>
                            <Text style={styles.fieldLabel}>Earliest time</Text>
                            <Pressable
                              style={styles.pickerField}
                              onPress={() => openPicker("desiredWindowStart", "time")}
                            >
                              <Text
                                style={[
                                  styles.pickerFieldText,
                                  !desiredWindowStart ? styles.pickerFieldPlaceholder : null,
                                ]}
                              >
                                {desiredWindowStart
                                  ? formatTimeLabel(desiredWindowStart)
                                  : "Set time"}
                              </Text>
                              <FontAwesome6 name="clock" size={16} color={tokens.colors.muted} />
                            </Pressable>
                          </View>
                          <View style={styles.formColumn}>
                            <Text style={styles.fieldLabel}>Latest time</Text>
                            <Pressable
                              style={styles.pickerField}
                              onPress={() => openPicker("desiredWindowEnd", "time")}
                            >
                              <Text
                                style={[
                                  styles.pickerFieldText,
                                  !desiredWindowEnd ? styles.pickerFieldPlaceholder : null,
                                ]}
                              >
                                {desiredWindowEnd
                                  ? formatTimeLabel(desiredWindowEnd)
                                  : "Set time"}
                              </Text>
                              <FontAwesome6 name="clock" size={16} color={tokens.colors.muted} />
                            </Pressable>
                          </View>
                        </View>
                      </View>

                      {intakeFields.length ? (
                        <View style={styles.modalSection}>
                          <Text style={styles.modalSectionLabel}>Intake details</Text>
                          {intakeFields.map((field) => {
                            const fieldValue = intakeAnswers[field.id];
                            const stringValue = typeof fieldValue === "string" ? fieldValue : "";
                            const selectedValues = Array.isArray(fieldValue)
                              ? fieldValue.filter((value): value is string => typeof value === "string")
                              : [];

                            return (
                              <View key={field.id} style={styles.formGroup}>
                                <Text style={styles.fieldLabel}>
                                  {field.label}
                                  {field.required ? "" : " (optional)"}
                                </Text>
                                {field.type === "LONG_TEXT" ? (
                                  <TextInput
                                    value={stringValue}
                                    onChangeText={(value) => updateIntakeAnswer(field.id, value)}
                                    placeholder={field.placeholder ?? ""}
                                    placeholderTextColor={tokens.colors.mutedSoft}
                                    style={[styles.fieldInput, styles.fieldInputMedium]}
                                    multiline
                                    textAlignVertical="top"
                                  />
                                ) : field.type === "SELECT" ? (
                                  <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.choiceRail}
                                  >
                                    {(field.options ?? []).map((option) => {
                                      const selected = stringValue === option;

                                      return (
                                        <Pressable
                                          key={option}
                                          style={[
                                            styles.choiceChip,
                                            selected ? styles.choiceChipActive : null,
                                          ]}
                                          onPress={() => updateIntakeAnswer(field.id, option)}
                                        >
                                          <Text
                                            style={[
                                              styles.choiceChipText,
                                              selected ? styles.choiceChipTextActive : null,
                                            ]}
                                          >
                                            {option}
                                          </Text>
                                        </Pressable>
                                      );
                                    })}
                                  </ScrollView>
                                ) : field.type === "MULTI_SELECT" ? (
                                  <View style={styles.choiceWrap}>
                                    {(field.options ?? []).map((option) => {
                                      const selected = selectedValues.includes(option);
                                      const nextValues = selected
                                        ? selectedValues.filter((value) => value !== option)
                                        : [...selectedValues, option];

                                      return (
                                        <Pressable
                                          key={option}
                                          style={[
                                            styles.choiceChip,
                                            selected ? styles.choiceChipActive : null,
                                          ]}
                                          onPress={() => updateIntakeAnswer(field.id, nextValues)}
                                        >
                                          <Text
                                            style={[
                                              styles.choiceChipText,
                                              selected ? styles.choiceChipTextActive : null,
                                            ]}
                                          >
                                            {option}
                                          </Text>
                                        </Pressable>
                                      );
                                    })}
                                  </View>
                                ) : field.type === "BOOLEAN" ? (
                                  <View style={styles.choiceWrap}>
                                    {[true, false].map((option) => {
                                      const selected = fieldValue === option;

                                      return (
                                        <Pressable
                                          key={String(option)}
                                          style={[
                                            styles.choiceChip,
                                            selected ? styles.choiceChipActive : null,
                                          ]}
                                          onPress={() => updateIntakeAnswer(field.id, option)}
                                        >
                                          <Text
                                            style={[
                                              styles.choiceChipText,
                                              selected ? styles.choiceChipTextActive : null,
                                            ]}
                                          >
                                            {option ? "Yes" : "No"}
                                          </Text>
                                        </Pressable>
                                      );
                                    })}
                                  </View>
                                ) : (
                                  <TextInput
                                    value={stringValue}
                                    onChangeText={(value) => updateIntakeAnswer(field.id, value)}
                                    placeholder={field.placeholder ?? ""}
                                    placeholderTextColor={tokens.colors.mutedSoft}
                                    style={styles.fieldInput}
                                  />
                                )}
                                {field.helpText ? (
                                  <Text style={styles.fieldHelp}>{field.helpText}</Text>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      ) : null}

                      {activeTemplate?.checklistItems.length ? (
                        <View style={styles.modalSection}>
                          <Text style={styles.modalSectionLabel}>Documents and prep</Text>
                          <View style={styles.choiceWrap}>
                            {activeTemplate.checklistItems.map((item) => {
                              const selected = requestedDocumentLabels.includes(item);

                              return (
                                <Pressable
                                  key={item}
                                  style={[
                                    styles.choiceChip,
                                    selected ? styles.choiceChipActive : null,
                                  ]}
                                  onPress={() => toggleRequestedDocument(item)}
                                >
                                  <Text
                                    style={[
                                      styles.choiceChipText,
                                      selected ? styles.choiceChipTextActive : null,
                                    ]}
                                  >
                                    {item}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  {composerStep === "location" ? (
                    <>
                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionLabel}>Delivery preference</Text>
                        <View style={styles.choiceWrap}>
                          {channelOptions.map((option) => {
                            const selected = normalizedRequestedChannels.includes(option.value);

                            return (
                              <Pressable
                                key={option.value}
                                style={[
                                  styles.deliveryCard,
                                  selected ? styles.deliveryCardActive : null,
                                ]}
                                onPress={() => toggleRequestedChannel(option.value)}
                              >
                                <Text
                                  style={[
                                    styles.deliveryCardTitle,
                                    selected ? styles.deliveryCardTitleActive : null,
                                  ]}
                                >
                                  {option.label}
                                </Text>
                                <Text
                                  style={[
                                    styles.deliveryCardBody,
                                    selected ? styles.deliveryCardBodyActive : null,
                                  ]}
                                >
                                  {option.description}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionLabel}>Search area</Text>
                        <View style={styles.formRow}>
                          <View style={styles.formColumn}>
                            <Text style={styles.fieldLabel}>City</Text>
                            <TextInput
                              value={city}
                              onChangeText={setCity}
                              placeholder="Chicago"
                              placeholderTextColor={tokens.colors.mutedSoft}
                              style={styles.fieldInput}
                            />
                          </View>
                          <View style={styles.formColumn}>
                            <Text style={styles.fieldLabel}>State</Text>
                            <TextInput
                              value={stateCode}
                              onChangeText={setStateCode}
                              placeholder="IL"
                              placeholderTextColor={tokens.colors.mutedSoft}
                              style={styles.fieldInput}
                              autoCapitalize="characters"
                            />
                          </View>
                        </View>

                        <View style={styles.formRow}>
                          <View style={styles.formColumn}>
                            <Text style={styles.fieldLabel}>Country</Text>
                            <TextInput
                              value={countryCode}
                              onChangeText={setCountryCode}
                              placeholder="US"
                              placeholderTextColor={tokens.colors.mutedSoft}
                              style={styles.fieldInput}
                              autoCapitalize="characters"
                            />
                          </View>
                          <View style={styles.formColumn}>
                            <Text style={styles.fieldLabel}>Search radius</Text>
                            <TextInput
                              value={searchRadiusMiles}
                              onChangeText={setSearchRadiusMiles}
                              placeholder="15"
                              placeholderTextColor={tokens.colors.mutedSoft}
                              style={styles.fieldInput}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.fieldLabel}>Address line 1</Text>
                          <TextInput
                            value={line1}
                            onChangeText={setLine1}
                            placeholder="1105 Berry Street"
                            placeholderTextColor={tokens.colors.mutedSoft}
                            style={styles.fieldInput}
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.fieldLabel}>Address line 2</Text>
                          <TextInput
                            value={line2}
                            onChangeText={setLine2}
                            placeholder="Apartment, suite, gate code..."
                            placeholderTextColor={tokens.colors.mutedSoft}
                            style={styles.fieldInput}
                          />
                        </View>

                        <View style={styles.formRow}>
                          <View style={styles.formColumn}>
                            <Text style={styles.fieldLabel}>County</Text>
                            <TextInput
                              value={countyName}
                              onChangeText={setCountyName}
                              placeholder="Davidson County"
                              placeholderTextColor={tokens.colors.mutedSoft}
                              style={styles.fieldInput}
                            />
                          </View>
                          <View style={styles.formColumn}>
                            <Text style={styles.fieldLabel}>Postal code</Text>
                            <TextInput
                              value={postalCode}
                              onChangeText={setPostalCode}
                              placeholder="37203"
                              placeholderTextColor={tokens.colors.mutedSoft}
                              style={styles.fieldInput}
                            />
                          </View>
                        </View>

                        <View style={styles.formRow}>
                          <View style={styles.formColumn}>
                            <Text style={styles.fieldLabel}>Contact phone</Text>
                            <TextInput
                              value={contactPhone}
                              onChangeText={setContactPhone}
                              placeholder="+1 555 555 0101"
                              placeholderTextColor={tokens.colors.mutedSoft}
                              style={styles.fieldInput}
                            />
                          </View>
                          <View style={styles.formColumn}>
                            <Text style={styles.fieldLabel}>Coverage summary</Text>
                            <View style={styles.summaryBox}>
                              <Text style={styles.summaryText}>
                                {[
                                  city.trim(),
                                  stateCode.trim().toUpperCase(),
                                  countryCode.trim().toUpperCase(),
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "Set your service area"}
                              </Text>
                              <Text style={styles.summaryHint}>
                                {searchRadiusMiles.trim() || "15"} mile search radius
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </>
                  ) : null}

                  {composerStep === "review" ? (
                    <>
                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionLabel}>Review request</Text>
                        <View style={styles.reviewCard}>
                          {reviewRows.map((row) => (
                            <View key={row.label} style={styles.reviewRow}>
                              <Text style={styles.reviewLabel}>{row.label}</Text>
                              <Text style={styles.reviewValue}>{row.value}</Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionLabel}>Request summary</Text>
                        <Text style={styles.reviewDescription}>
                          {buildRequestDescription({
                            description,
                            serviceModel: effectiveServiceModel,
                            requestedChannels: normalizedRequestedChannels,
                            searchAddress:
                              [line1, line2, city, stateCode, postalCode].filter(Boolean).join(", ") ||
                              undefined,
                            city,
                            stateCode,
                            countryCode,
                            searchRadiusMiles,
                            intakeResponses,
                            requestedDocumentLabels,
                          }) || "Add a short description so providers know what you need."}
                        </Text>
                      </View>

                      {activeTemplate?.checklistItems.length ? (
                        <View style={styles.checklistCard}>
                          <Text style={styles.checklistTitle}>Providers will look for</Text>
                          {activeTemplate.checklistItems.map((item) => (
                            <View key={item} style={styles.checklistRow}>
                              <FontAwesome6
                                name="check"
                                size={11}
                                color={tokens.colors.brandDeep}
                              />
                              <Text style={styles.checklistText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  {error ? <Text style={styles.modalErrorText}>{error}</Text> : null}

                  <View style={styles.modalFooter}>
                    <View style={styles.composerFooterRow}>
                      {composerStep !== "request" ? (
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() =>
                            setComposerStep(
                              composerStep === "review" ? "location" : "request",
                            )
                          }
                        >
                          <Text style={styles.secondaryButtonText}>Back</Text>
                        </Pressable>
                      ) : (
                        <Pressable style={styles.secondaryButton} onPress={closeComposer}>
                          <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </Pressable>
                      )}

                      {composerStep === "request" ? (
                        <Pressable
                          style={[
                            styles.primaryActionWide,
                            !canContinueFromRequest ? styles.buttonDisabled : null,
                          ]}
                          disabled={!canContinueFromRequest}
                          onPress={() => setComposerStep("location")}
                        >
                          <Text style={styles.primaryActionText}>Continue</Text>
                        </Pressable>
                      ) : null}

                      {composerStep === "location" ? (
                        <Pressable
                          style={[
                            styles.primaryActionWide,
                            !canContinueFromLocation ? styles.buttonDisabled : null,
                          ]}
                          disabled={!canContinueFromLocation}
                          onPress={() => setComposerStep("review")}
                        >
                          <Text style={styles.primaryActionText}>Review request</Text>
                        </Pressable>
                      ) : null}

                      {composerStep === "review" ? (
                        <AuthButton
                          label={isSubmitting ? "Sending request..." : "Send request"}
                          disabled={!canSubmitRequest || isSubmitting}
                          onPress={() => void handleCreateRequest()}
                          style={styles.composerSubmitButton}
                        />
                      ) : null}
                    </View>
                  </View>
                </ScrollView>
              </SafeAreaView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!activePicker}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        <View style={styles.pickerModalRoot}>
          <Pressable style={styles.pickerBackdrop} onPress={closePicker} />
          {activePicker ? (
            <View style={styles.pickerSheetWrap}>
              <SafeAreaView style={styles.pickerSheet} edges={["bottom"]}>
                <View style={styles.pickerHeader}>
                  <View style={styles.pickerHeaderCopy}>
                    <Text style={styles.pickerTitle}>
                      {activePicker.field === "desiredDate"
                        ? "Choose a date"
                        : activePicker.field === "desiredWindowStart"
                          ? "Set earliest time"
                          : "Set latest time"}
                    </Text>
                    <Text style={styles.pickerSubtitle}>
                      {activePicker.mode === "date"
                        ? "Pick the day you would like the request to go out."
                        : "Choose a clean time window for providers to respond to."}
                    </Text>
                  </View>
                  <Pressable style={styles.closeButton} onPress={closePicker}>
                    <FontAwesome6 name="xmark" size={18} color={tokens.colors.ink} />
                  </Pressable>
                </View>

                <View style={styles.pickerBody}>
                  <DateTimePicker
                    value={pickerDraftValue}
                    mode={activePicker.mode}
                    display={
                      Platform.OS === "ios"
                        ? activePicker.mode === "date"
                          ? "inline"
                          : "spinner"
                        : "default"
                    }
                    onChange={handlePickerChange}
                    style={styles.dateTimePicker}
                  />
                </View>

                {Platform.OS === "ios" ? (
                  <View style={styles.pickerFooter}>
                    <Pressable style={styles.secondaryButton} onPress={closePicker}>
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.primaryActionWide} onPress={confirmPicker}>
                      <Text style={styles.primaryActionText}>Done</Text>
                    </Pressable>
                  </View>
                ) : null}
              </SafeAreaView>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  pickerModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  pickerSheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalKeyboardWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  heroMetrics: {
    flexDirection: "row",
    gap: 12,
  },
  heroMetricCard: {
    flex: 1,
    borderRadius: tokens.radius.lg,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 3,
  },
  heroMetricValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  heroMetricLabel: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  panel: {
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
    gap: 14,
  },
  workspaceHero: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.ink,
    padding: 18,
    gap: 16,
  },
  workspaceHeroCopy: {
    gap: 8,
  },
  workspaceEyebrow: {
    color: tokens.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  workspaceTitle: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  workspaceBody: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    lineHeight: 22,
  },
  workspaceMetaRail: {
    flexDirection: "row",
    gap: 10,
  },
  workspaceMetaCard: {
    flex: 1,
    borderRadius: tokens.radius.md,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  workspaceMetaValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  workspaceMetaLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "700",
  },
  actionBar: {
    gap: 12,
  },
  actionButton: {
    minHeight: 68,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.inkDeep,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: tokens.colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  actionButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonCopy: {
    flex: 1,
    gap: 4,
  },
  actionButtonTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  actionButtonSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 18,
  },
  templatePreviewWrap: {
    gap: 12,
  },
  filterRail: {
    gap: 10,
    paddingRight: 8,
  },
  filterChip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.brand,
    borderColor: tokens.colors.brand,
  },
  filterChipText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: tokens.colors.ink,
  },
  requestRail: {
    gap: 12,
    paddingRight: 8,
  },
  requestCard: {
    width: 280,
    borderRadius: 26,
    backgroundColor: "#fbfcff",
    borderWidth: 1,
    borderColor: "#dce3ef",
    padding: 16,
    gap: 10,
    shadowColor: tokens.colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  requestCardActive: {
    borderColor: tokens.colors.ink,
    backgroundColor: "#fff",
    shadowOpacity: 0.1,
  },
  requestCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  requestCardTitle: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  statusPill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#ecf8d1",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusPillText: {
    color: tokens.colors.ink,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  requestCardMeta: {
    color: tokens.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  requestCardBody: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  requestSignalRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  requestSignalPill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#eefad1",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  requestSignalPillMuted: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#f1f4f9",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  requestSignalText: {
    color: "#699d00",
    fontSize: 11,
    fontWeight: "800",
  },
  requestSignalTextMuted: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  requestCardDate: {
    color: tokens.colors.mutedSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailCard: {
    width: "48%",
    borderRadius: 22,
    backgroundColor: "#fbfcff",
    borderWidth: 1,
    borderColor: "#dce3ef",
    padding: 14,
    gap: 6,
    shadowColor: tokens.colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  detailLabel: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  detailValue: {
    color: tokens.colors.ink,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
  },
  matchCard: {
    borderRadius: 26,
    backgroundColor: "#fbfcff",
    borderWidth: 1,
    borderColor: "#dce3ef",
    padding: 16,
    gap: 12,
    shadowColor: tokens.colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  matchTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  matchIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  matchAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f5efe7",
    alignItems: "center",
    justifyContent: "center",
  },
  matchAvatarText: {
    color: tokens.colors.gold,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  matchCopy: {
    flex: 1,
    gap: 4,
  },
  matchTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  matchMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  matchMetaRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  matchMetaChip: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#f3f6fa",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  matchMetaChipText: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  matchPill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#eef3fb",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  matchPillText: {
    color: tokens.colors.ink,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  matchInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matchPrice: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  matchRating: {
    color: tokens.colors.brandDeep,
    fontSize: 12,
    fontWeight: "700",
  },
  matchButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryAction: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryAction: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    color: tokens.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  conversationTabs: {
    gap: 10,
    paddingRight: 8,
  },
  conversationTab: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  conversationTabActive: {
    backgroundColor: tokens.colors.ink,
    borderColor: tokens.colors.ink,
  },
  conversationTabText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  conversationTabTextActive: {
    color: "#fff",
  },
  messagesWrap: {
    gap: 10,
  },
  messageRow: {
    flexDirection: "row",
  },
  messageRowLeft: {
    justifyContent: "flex-start",
  },
  messageRowRight: {
    justifyContent: "flex-end",
  },
  messageBubble: {
    maxWidth: "82%",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  messageBubbleOwn: {
    backgroundColor: tokens.colors.ink,
  },
  messageBubbleOther: {
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  messageSender: {
    color: tokens.colors.mutedSoft,
    fontSize: 11,
    fontWeight: "700",
  },
  messageContent: {
    color: tokens.colors.ink,
    fontSize: 13,
    lineHeight: 20,
  },
  messageContentOwn: {
    color: "#fff",
  },
  messageComposer: {
    gap: 12,
  },
  messageInput: {
    minHeight: 98,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: tokens.colors.ink,
    fontSize: 15,
    textAlignVertical: "top",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(12,29,54,0.42)",
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(12,29,54,0.5)",
  },
  modalSheet: {
    width: "100%",
    height: "88%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingTop: 12,
    overflow: "hidden",
  },
  pickerSheet: {
    width: "100%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingTop: 12,
    overflow: "hidden",
  },
  stepRail: {
    gap: 10,
    paddingRight: 8,
  },
  stepCard: {
    width: 200,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  stepCardActive: {
    borderColor: tokens.colors.ink,
    backgroundColor: tokens.colors.ink,
  },
  stepCardComplete: {
    borderColor: "#d6efb4",
    backgroundColor: "#f6fde8",
  },
  stepLabel: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  stepLabelActive: {
    color: "rgba(255,255,255,0.72)",
  },
  stepTitle: {
    color: tokens.colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  stepTitleActive: {
    color: "#fff",
  },
  modalHandle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cfd8e6",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  pickerHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  modalTitle: {
    color: tokens.colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  modalSubtitle: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  pickerTitle: {
    color: tokens.colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  pickerSubtitle: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  dateTimePicker: {
    alignSelf: "stretch",
    backgroundColor: "#fff",
    borderRadius: 24,
  },
  pickerFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },
  modalSection: {
    gap: 12,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
  },
  modalSectionLabel: {
    color: tokens.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  templateRail: {
    gap: 10,
    paddingRight: 8,
  },
  templateCard: {
    width: 240,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 8,
    shadowColor: tokens.colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  templateBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  templateBadge: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#eefad1",
    color: "#699d00",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: "uppercase",
  },
  templateCategory: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#f3f6fa",
    color: tokens.colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: "uppercase",
  },
  templateCardActive: {
    backgroundColor: tokens.colors.ink,
    borderColor: tokens.colors.ink,
  },
  templateTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  templateTitleActive: {
    color: "#fff",
  },
  templateBody: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  templateBodyActive: {
    color: "rgba(255,255,255,0.8)",
  },
  templateHint: {
    color: tokens.colors.brandDeep,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  formGroup: {
    gap: 8,
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
  },
  formColumn: {
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
  fieldInputTall: {
    minHeight: 128,
  },
  fieldInputMedium: {
    minHeight: 104,
  },
  fieldHelp: {
    color: tokens.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  pickerField: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pickerFieldText: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  pickerFieldPlaceholder: {
    color: tokens.colors.mutedSoft,
    fontWeight: "600",
  },
  choiceRail: {
    gap: 10,
    paddingRight: 8,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choiceChip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceChipActive: {
    backgroundColor: tokens.colors.ink,
    borderColor: tokens.colors.ink,
  },
  choiceChipText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  choiceChipTextActive: {
    color: "#fff",
  },
  deliveryCard: {
    width: "48%",
    minWidth: 148,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#fff",
    padding: 16,
    gap: 6,
  },
  deliveryCardActive: {
    backgroundColor: tokens.colors.ink,
    borderColor: tokens.colors.ink,
    shadowColor: tokens.colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  deliveryCardTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  deliveryCardTitleActive: {
    color: "#fff",
  },
  deliveryCardBody: {
    color: tokens.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  deliveryCardBodyActive: {
    color: "rgba(255,255,255,0.82)",
  },
  summaryBox: {
    minHeight: 96,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#f8fbff",
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "space-between",
    gap: 10,
  },
  summaryText: {
    color: tokens.colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  summaryHint: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  checklistCard: {
    borderRadius: tokens.radius.md,
    backgroundColor: "#f7fce9",
    borderWidth: 1,
    borderColor: "#d9efbb",
    padding: 16,
    gap: 10,
  },
  checklistTitle: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checklistText: {
    color: tokens.colors.ink,
    fontSize: 13,
    lineHeight: 19,
  },
  reviewCard: {
    borderRadius: tokens.radius.lg,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 14,
  },
  reviewRow: {
    gap: 4,
  },
  reviewLabel: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  reviewValue: {
    color: tokens.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  reviewDescription: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  emptyTitle: {
    color: tokens.colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  emptyPanel: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 8,
  },
  emptyText: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  modalFooter: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.panel,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
  },
  composerFooterRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: 22,
    minWidth: 112,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  primaryActionWide: {
    flex: 1,
    minHeight: 54,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    shadowColor: tokens.colors.ink,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  composerSubmitButton: {
    flex: 1,
    minHeight: 54,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  modalErrorText: {
    color: tokens.colors.danger,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  errorText: {
    color: "#d44c3f",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  loadingText: {
    color: tokens.colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
});

import { useFocusEffect } from "expo-router/react-navigation";
import { FontAwesome6 } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
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
import { AuthField } from "@/src/components/auth/AuthField";
import { Screen } from "@/src/components/Screen";
import { SectionHeader } from "@/src/components/SectionHeader";
import { QuoteChatModal } from "@/src/components/QuoteChatModal";
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
import {
  formatMarketplaceDistance,
  formatMarketplacePrice,
} from "@/src/lib/marketplace-display";
import {
  buildIntakeResponses,
  buildRequestDescription,
  canAcceptQuoteMatch,
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
import { useSavedDraft } from "@/src/lib/use-saved-draft";
import { localRequestDate, requestScheduleError, requestCalendarDate } from "@/src/lib/request-schedule";

const quoteFilters = [
  { id: "ALL", label: "All" },
  { id: "OPEN", label: "Open" },
  { id: "MATCHED", label: "Matched" },
  { id: "ACCEPTED", label: "Booked" },
] as const;

type QuoteFilterId = (typeof quoteFilters)[number]["id"];
type ComposerStepId = "request" | "location" | "review";
type PickerField = "desiredDate" | "desiredWindowStart" | "desiredWindowEnd";

const composerSteps: Array<{
  id: ComposerStepId;
  label: string;
  title: string;
}> = [
  { id: "request", label: "Request", title: "What you need" },
  { id: "location", label: "Location", title: "Where" },
  { id: "review", label: "Review", title: "Check and send" },
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
    shortDescription:
      "At-home or in-studio wellness sessions with clear timing.",
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
      return "Booked";
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

  const date = requestCalendarDate(value);
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

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function WorkbenchScreen({ requestId }: { requestId?: string } = {}) {
  const session = useSession();
  return session.activePersona === "agent" ? (
    <AgentWorkbenchScreen />
  ) : (
    <CustomerWorkbenchScreen requestId={requestId} />
  );
}

function CustomerWorkbenchScreen({ requestId }: { requestId?: string }) {
  const router = useRouter();
  const session = useSession();
  const params = useLocalSearchParams<{
    service?: string;
    city?: string;
    provider?: string;
    description?: string;
    requestId?: string;
  }>();

  const [templates, setTemplates] = useState<MarketplaceRequestTemplate[]>([]);
  const [requests, setRequests] = useState<CustomerQuoteRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [filter, setFilter] = useState<QuoteFilterId>("ALL");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerStep, setComposerStep] = useState<ComposerStepId>("request");
  const [templateId, setTemplateId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState(
    session.profile?.city ?? session.user?.city ?? "",
  );
  const [stateCode, setStateCode] = useState(
    session.profile?.stateCode ?? session.user?.stateCode ?? "",
  );
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [countyName, setCountyName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState(
    session.profile?.countryCode ?? "US",
  );
  const [searchRadiusMiles, setSearchRadiusMiles] = useState("15");
  const composerScroll = useRef<ScrollView>(null);
  const fieldOffsets = useRef<Record<string, number>>({});
  const pendingField = useRef<string | null>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [desiredDate, setDesiredDate] = useState("");
  const [desiredWindowStart, setDesiredWindowStart] = useState("");
  const [desiredWindowEnd, setDesiredWindowEnd] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const restoringTemplate = useRef<string | null>(null);
  const [contactPhone, setContactPhone] = useState(
    session.profile?.phone ?? "",
  );
  const [requestedChannels, setRequestedChannels] = useState<
    AppointmentChannel[]
  >([]);
  const [intakeAnswers, setIntakeAnswers] =
    useState<ServiceRequestIntakeAnswerMap>({});
  const [requestedDocumentLabels, setRequestedDocumentLabels] = useState<
    string[]
  >([]);
  const [activePicker, setActivePicker] = useState<null | {
    field: PickerField;
    mode: "date" | "time";
  }>(null);
  const [pickerDraftValue, setPickerDraftValue] = useState(new Date());
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>(
    {},
  );
  const [chatOpen, setChatOpen] = useState(false);
  const workspaceGeneration = useRef(0);
  const workspaceLoading = useRef(false);
  const pollAfter = useRef(0);
  const sendingRef = useRef(false);
  const [chatErrors, setChatErrors] = useState<Record<string, string | null>>({});
  const [syncIssue, setSyncIssue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [acceptingMatchId, setAcceptingMatchId] = useState<string | null>(null);
  const acceptingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const { draftError, clearDraft } = useSavedDraft(
    session.user ? `${session.user.id}_request` : null,
    {
      serviceName,
      description,
      city,
      stateCode,
      countryCode,
      line1,
      line2,
      countyName,
      postalCode,
      desiredDate,
      desiredWindowStart,
      desiredWindowEnd,
      budgetMin,
      budgetMax,
      currencyCode,
      contactPhone,
      requestedChannels,
      intakeAnswers,
      requestedDocumentLabels,
      templateId,
      searchRadiusMiles,
    },
    (draft) => {
      if (params.service) return;
      restoringTemplate.current = draft.templateId || null;
      setTemplateId(draft.templateId || "");
      setCurrencyCode(draft.currencyCode || "USD");
      setServiceName(draft.serviceName || "");
      setDescription(draft.description || "");
      setCity(draft.city || "");
      setStateCode(draft.stateCode || "");
      setCountryCode(draft.countryCode || "US");
      setLine1(draft.line1 || "");
      setLine2(draft.line2 || "");
      setCountyName(draft.countyName || "");
      setPostalCode(draft.postalCode || "");
      setDesiredDate(draft.desiredDate || "");
      setDesiredWindowStart(draft.desiredWindowStart || "");
      setDesiredWindowEnd(draft.desiredWindowEnd || "");
      setBudgetMin(draft.budgetMin || "");
      setBudgetMax(draft.budgetMax || "");
      setContactPhone(draft.contactPhone || "");
      setRequestedChannels(draft.requestedChannels || []);
      setIntakeAnswers(draft.intakeAnswers || {});
      setRequestedDocumentLabels(draft.requestedDocumentLabels || []);
      setSearchRadiusMiles(draft.searchRadiusMiles || "15");
    },
  );

  useEffect(() => {
    if (params.service) {
      setServiceName((current) => current || params.service || "");
      setDescription((current) => current || params.description || "");
      setCity((current) => current || params.city || "");
      setComposerStep("request");
      setComposerOpen(true);
    }
  }, [params.city, params.description, params.service]);

  const loadWorkspace = useCallback(
    async (silent = false) => {
      if (!session.user) {
        return;
      }
      if (silent && (workspaceLoading.current || Date.now() < pollAfter.current)) return;
      workspaceLoading.current = true;

      const generation = ++workspaceGeneration.current;
      try {
        if (!silent) {
          setError(null);
          setIsLoading(true);
        }

        const [nextTemplates, nextRequests] = await Promise.all([
          silent ? Promise.resolve(null) : listMarketplaceRequestTemplates({ serviceModel: "LOCAL" }),
          listCustomerQuoteRequests({
            requesterUserId: session.user.id,
            requesterEmail: session.user.email,
            status: filter === "ALL" ? undefined : filter,
          }),
        ]);

        if (generation !== workspaceGeneration.current) return;
        if (nextTemplates) setTemplates(nextTemplates);
        setSyncIssue(null);
        setRequests(nextRequests);
        setSelectedRequestId((current) =>
          current && nextRequests.some((request) => request.id === current)
            ? current
            : (nextRequests[0]?.id ?? null),
        );
      } catch (nextError) {
        const status = (nextError as { statusCode?: number })?.statusCode;
        const retry = (nextError as { retryAfterSeconds?: number })?.retryAfterSeconds;
        if (status === 429) pollAfter.current = Date.now() + (retry || 30) * 1000;
        if (silent && generation === workspaceGeneration.current) setSyncIssue("Messages could not refresh. We’ll try again shortly.");
        const message = getFriendlyApiError(
          nextError,
          "We could not load your customer requests.",
        );
        if (!silent && generation === workspaceGeneration.current)
          setError(message);
      } finally {
        if (generation === workspaceGeneration.current) {
          setIsLoading(false);
          workspaceLoading.current = false;
        }
      }
    },
    [filter, session.user?.id, session.user?.email],
  );

  useFocusEffect(
    useCallback(() => {
      void loadWorkspace();
      const timer = setInterval(() => {
        if (AppState.currentState === "active") void loadWorkspace(true);
      }, chatOpen ? 5000 : 15000);
      return () => {
        clearInterval(timer);
        workspaceGeneration.current += 1;
        workspaceLoading.current = false;
      };
    }, [loadWorkspace, chatOpen]),
  );

  const requestTemplates = templates.length > 0 ? templates : fallbackTemplates;
  useEffect(() => {
    if (params.requestId && requests.some((item) => item.id === params.requestId)) {
      router.push(`/requests/${encodeURIComponent(params.requestId)}` as Href);
      router.setParams({ requestId: undefined });
    }
  }, [params.requestId, requests, router]);

  const selectedRequest = useMemo(
    () =>
      requestId ? requests.find(request => request.id === requestId) ?? null :
      requests.find((request) => request.id === selectedRequestId) ??
      requests[0] ??
      null,
    [requests, selectedRequestId, requestId],
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
  const chatError = selectedConversation ? chatErrors[selectedConversation.id] ?? null : null;
  const messageDraft = selectedConversation
    ? (messageDrafts[selectedConversation.id] ?? "")
    : "";
  const setMessageDraft = (value: string) => {
    if (selectedConversation)
      setMessageDrafts((current) => ({
        ...current,
        [selectedConversation.id]: value,
      }));
  };

  const activeTemplate = useMemo(
    () =>
      requestTemplates.find((template) => template.id === templateId) ?? null,
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
    if (restoringTemplate.current === activeTemplate.id) {
      restoringTemplate.current = null;
      return;
    }

    setServiceName(activeTemplate.name);
    setBudgetMin(
      activeTemplate.defaultBudgetMinCents
        ? String(activeTemplate.defaultBudgetMinCents / 100)
        : "",
    );
    setBudgetMax(
      activeTemplate.defaultBudgetMaxCents
        ? String(activeTemplate.defaultBudgetMaxCents / 100)
        : "",
    );
    setSearchRadiusMiles(
      String(activeTemplate.suggestedSearchRadiusMiles ?? 15),
    );
    setRequestedDocumentLabels(activeTemplate.checklistItems ?? []);
    setRequestedChannels(
      normalizeRequestedChannels(
        requestedChannels,
        activeTemplate.serviceModel ?? "LOCAL",
        activeTemplate.requiresAddress,
      ),
    );
    setIntakeAnswers({});
  }, [activeTemplate?.id]);

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

  const requestDetailsValid = useMemo(() => {
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
  const validBudget = (value: string) =>
    !value.trim() ||
    (/^\d+(\.\d{1,2})?$/.test(value.trim()) &&
      Number(value) >= 0 &&
      Number(value) <= 10000000);
  const budgetValid =
    validBudget(budgetMin) &&
    validBudget(budgetMax) &&
    (!budgetMin.trim() ||
      !budgetMax.trim() ||
      Number(budgetMin) <= Number(budgetMax));
  const scheduleError = requestScheduleError(desiredDate, desiredWindowStart, desiredWindowEnd);
  const requestValidationError = scheduleError || (!budgetValid
    ? "Enter a valid budget with the maximum at least as much as the minimum."
    : !requestDetailsValid ? "Complete the service, description and required request details."
    : !canContinueFromLocation || !/^[A-Za-z]{2}$/.test(countryCode.trim())
      ? "Enter a city and a two-letter country code."
      : !/^[A-Z]{3}$/.test(currencyCode) ? "Choose a valid request currency." : null);
  const canContinueFromRequest = requestDetailsValid && budgetValid && !scheduleError;
  const missingIntake = intakeFields.find(field => {
    if (!field.required) return false;
    const value = intakeAnswers[field.id];
    return typeof value !== "boolean" && (Array.isArray(value) ? !value.length : typeof value !== "string" || !value.trim());
  });
  const requestIssue = serviceName.trim().length < 3 ? {field:"service", message:"Enter a service name with at least 3 characters."}
    : description.trim().length < 12 ? {field:"description", message:"Describe your request in at least 12 characters."}
    : !/^[A-Z]{3}$/.test(currencyCode) ? {field:"currency", message:"Enter a 3-letter currency code, such as USD or NGN."}
    : !budgetValid ? {field:"budget", message:"Enter a valid budget with the maximum at least as much as the minimum."}
    : activeTemplate?.requiresDate && !desiredDate ? {field:"date", message:"Choose your preferred date."}
    : activeTemplate?.requiresTimeWindow && (!desiredWindowStart || !desiredWindowEnd) ? {field:"time", message:"Choose both an earliest and a latest time."}
    : scheduleError ? {field: scheduleError.includes("date") ? "date" : "time", message:scheduleError}
    : missingIntake ? {field:missingIntake.id, message:`Complete ${missingIntake.label}.`} : null;
  const locationIssue = city.trim().length < 2 ? {field:"city",message:"Enter the city where you need the service."}
    : !/^[A-Za-z]{2}$/.test(countryCode.trim()) ? {field:"country",message:"Enter a two-letter country code, such as US or NG."} : null;
  const recordField = (field: string) => (event: {nativeEvent:{layout:{y:number}}}) => {
    fieldOffsets.current[field] = event.nativeEvent.layout.y;
    if (pendingField.current === field) {
      composerScroll.current?.scrollTo({y:Math.max(0, event.nativeEvent.layout.y - 20), animated:true});
      pendingField.current = null;
    }
  };
  const showIssue = useCallback((issue: {field:string;message:string}, step: ComposerStepId) => {
    pendingField.current = issue.field;
    setValidationAttempted(true);
    setError(issue.message);
    setComposerStep(step);
    composerScroll.current?.scrollTo({y:Math.max(0,(fieldOffsets.current[issue.field] ?? 0)-20),animated:true});
  }, []);
  const canSubmitRequest =
    canContinueFromRequest &&
    canContinueFromLocation &&
    budgetValid &&
    !scheduleError &&
    /^[A-Za-z]{2}$/.test(countryCode.trim()) &&
    /^[A-Z]{3}$/.test(currencyCode);

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

  const openComposer = useCallback((nextTemplateId?: string) => {
    setValidationAttempted(false);
    setError(null);
    if (nextTemplateId) {
      setTemplateId(nextTemplateId);
    }

    setComposerStep("request");
    setComposerOpen(true);
  }, []);

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

      const source =
        field === "desiredWindowStart" ? desiredWindowStart : desiredWindowEnd;

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

  const applyPickerValue = useCallback(
    (field: PickerField, selectedValue: Date) => {
      if (field === "desiredDate") {
        setDesiredDate(localRequestDate(selectedValue));
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
    },
    [],
  );

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
      setError(
        "Check required answers, location, date, time window, and budget range before sending.",
      );
      return;
    }

    try {
      setError(null);
      setIsSubmitting(true);

      await createServiceRequest({
        requesterUserId: session.user.id,
        requesterName:
          `${session.user.firstName} ${session.user.lastName}`.trim(),
        requesterEmail: session.user.email,
        requesterPhone:
          contactPhone.trim() || session.profile?.phone || undefined,
        requestedServiceName: serviceName.trim(),
        requestedCategoryName: activeTemplate?.businessCategory?.name,
        description: buildRequestDescription({
          description,
          serviceModel: effectiveServiceModel,
          requestedChannels: normalizedRequestedChannels,
          searchAddress:
            [line1, line2, city, stateCode, postalCode]
              .filter(Boolean)
              .join(", ") || undefined,
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
        currencyCode,
        budgetMinCents: budgetMin.trim()
          ? Math.round(Number(budgetMin) * 100)
          : undefined,
        budgetMaxCents: budgetMax.trim()
          ? Math.round(Number(budgetMax) * 100)
          : undefined,
        searchRadiusMiles: searchRadiusMiles.trim()
          ? Number(searchRadiusMiles)
          : undefined,
        notificationStrategy: "AUTO_NOTIFY_ALL",
      });

      await clearDraft().catch(() => {});
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
    currencyCode,
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
    if (
      !selectedRequest ||
      !selectedConversation ||
      !messageDraft.trim() ||
      sendingRef.current
    ) {
      return;
    }

    try {
      setChatErrors((current) => ({ ...current, [selectedConversation.id]: null }));
      sendingRef.current = true;
      setIsSendingMessage(true);
      const updatedConversation = await sendRequesterQuoteMessage(
        selectedRequest.id,
        selectedConversation.id,
        {
          requesterUserId: session.user?.id,
          requesterEmail: session.user?.email,
          content: messageDraft.trim(),
        },
      );
      if (updatedConversation.id && Array.isArray(updatedConversation.messages)) {
        setRequests((current) => current.map((request) => request.id === selectedRequest.id
          ? { ...request, conversations: request.conversations.map((item) => item.id === updatedConversation.id ? { ...item, ...updatedConversation, provider: updatedConversation.provider ?? item.provider } : item) }
          : request));
      }
      setMessageDrafts((current) =>
        current[selectedConversation.id] === messageDraft
          ? { ...current, [selectedConversation.id]: "" }
          : current,
      );
      await loadWorkspace(true);
    } catch (nextError) {
      const message = getFriendlyApiError(
        nextError,
        "We could not send your message.",
      );
      setChatErrors((current) => ({ ...current, [selectedConversation.id]: message }));
    } finally {
      sendingRef.current = false;
      setIsSendingMessage(false);
    }
  }, [
    loadWorkspace,
    messageDraft,
    selectedConversation,
    selectedRequest,
    session.user?.email,
    session.user?.id,
    isSendingMessage,
  ]);

  const handleAcceptMatch = useCallback(
    async (matchId: string) => {
      if (!selectedRequest || acceptingRef.current || !canAcceptQuoteMatch(selectedRequest, matchId)) {
        return;
      }

      acceptingRef.current = true;
      try {
        setError(null);
        setAcceptingMatchId(matchId);
        await acceptCustomerQuoteMatch(selectedRequest.id, matchId, {
          requesterUserId: session.user?.id,
          requesterEmail: session.user?.email,
        });
        // Hide every competing acceptance action immediately, even if refreshing fails.
        workspaceGeneration.current += 1;
        workspaceLoading.current = false;
        setRequests((current) => current.map((request) => request.id !== selectedRequest.id ? request : {
          ...request, status: "ACCEPTED", acceptedQuoteMatchId: matchId,
          matches: request.matches.map((match) => ({ ...match,
            status: match.id === matchId ? "ACCEPTED" :
              match.status === "AVAILABLE" || match.status === "UNLOCKED" ? "EXPIRED" : match.status,
          })),
        }));
        await loadWorkspace();
      } catch (nextError) {
        const message = getFriendlyApiError(
          nextError,
          "We could not accept that provider yet.",
        );
        setError(message);
        // A different device may have already selected a provider.
        await loadWorkspace(true);
      } finally {
        acceptingRef.current = false;
        setAcceptingMatchId(null);
      }
    },
    [loadWorkspace, selectedRequest, session.user?.email, session.user?.id],
  );

  const composerStepIndex = composerSteps.findIndex(
    (step) => step.id === composerStep,
  );
  const reviewRows = [
    { label: "Service", value: serviceName.trim() || "Not set yet" },
    { label: "Template", value: activeTemplate?.name ?? "Custom request" },
    {
      label: "Location",
      value:
        [city.trim(), stateCode.trim().toUpperCase()]
          .filter(Boolean)
          .join(", ") || "Location not added yet",
    },
    {
      label: "Timing",
      value:
        [
          desiredDate.trim() ? formatDateLabel(desiredDate.trim()) : "",
          desiredWindowStart.trim()
            ? formatTimeLabel(desiredWindowStart.trim())
            : "",
          desiredWindowEnd.trim()
            ? formatTimeLabel(desiredWindowEnd.trim())
            : "",
        ]
          .filter(Boolean)
          .join(" · ") || "Flexible timing",
    },
    {
      label: "Budget",
      value:
        budgetMin.trim() || budgetMax.trim()
          ? `${budgetMin.trim() ? `${currencyCode} ${budgetMin.trim()}` : "Open"} - ${
              budgetMax.trim() ? `${currencyCode} ${budgetMax.trim()}` : "Open"
            }`
          : "Open budget",
    },
    {
      label: "Delivery",
      value: formatRequestedChannels(
        normalizedRequestedChannels,
        effectiveServiceModel,
      ),
    },
  ];

  const showEmpty = !isLoading && requests.length === 0;
  const stepNumber = composerStepIndex + 1;

  const footerPrimary =
    composerStep === "request" ? (
      <AuthButton
        label="Continue"
        onPress={() => {
          if (requestIssue) { showIssue(requestIssue, "request"); return; }
          setError(null); setValidationAttempted(false); setComposerStep("location");
          composerScroll.current?.scrollTo({y:0,animated:false});
        }}
        style={styles.footerPrimary}
      />
    ) : composerStep === "location" ? (
      <AuthButton
        label="Review"
        onPress={() => {
          if (requestIssue) { showIssue(requestIssue, "request"); return; }
          if (locationIssue) { showIssue(locationIssue, "location"); return; }
          setError(null); setValidationAttempted(false); setComposerStep("review");
          composerScroll.current?.scrollTo({y:0,animated:false});
        }}
        style={styles.footerPrimary}
      />
    ) : (
      <AuthButton
        label="Send request"
        disabled={!canSubmitRequest}
        loading={isSubmitting}
        onPress={() => void handleCreateRequest()}
        style={styles.footerPrimary}
      />
    );

  return (
    <>
      <Screen
        title={requestId ? "Request details" : "Requests"}
        showBack={Boolean(requestId)}
        refreshing={isLoading && requests.length > 0}
        onRefresh={() => void loadWorkspace()}
      >
        {!requestId && !showEmpty ? (
          <AuthButton
            label="Start a request"
            icon="plus"
            onPress={() => openComposer()}
          />
        ) : null}
        {draftError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {draftError}
          </Text>
        ) : null}

        {error && !composerOpen ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
            <Pressable
              onPress={() => void loadWorkspace()}
              accessibilityRole="button"
            >
              <Text style={styles.errorRetry}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!requestId ? <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.railScroll}
          contentContainerStyle={styles.chipRail}
        >
          {quoteFilters.map((item) => {
            const isActive = item.id === filter;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                style={[styles.chip, isActive ? styles.chipActive : null]}
                onPress={() => setFilter(item.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.chipTextActive : null,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView> : null}

        {isLoading && requests.length === 0 ? <SkeletonRows /> : null}

        {!requestId && showEmpty ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {filter === "ALL"
                ? "No requests yet"
                : `No ${quoteFilters.find((item) => item.id === filter)?.label.toLowerCase()} requests`}
            </Text>
            <Text style={styles.emptyBody}>
              Tell us what you need and nearby providers send you quotes.
            </Text>
            <AuthButton
              label="Start a request"
              icon="plus"
              onPress={() => openComposer()}
              style={styles.emptyAction}
            />
          </View>
        ) : null}

        {!requestId && requests.length > 0 ? (
          <View style={styles.list}>
            {requests.map((request) => {
              const isActive = false;
              const date = request.desiredDate
                ? requestCalendarDate(request.desiredDate)
                : null;
              const hasDate = !!date && !Number.isNaN(date.getTime());
              return (
                <Pressable
                  key={request.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  style={[styles.row, isActive ? styles.rowActive : null]}
                  onPress={() => router.push(`/requests/${encodeURIComponent(request.id)}` as Href)}
                >
                  <View style={styles.dateTile}>
                    {hasDate && date ? (
                      <>
                        <Text style={styles.dateTileDay}>
                          {date.toLocaleDateString(undefined, {
                            month: "short",
                          })}
                        </Text>
                        <Text style={styles.dateTileNum}>{date.getDate()}</Text>
                      </>
                    ) : (
                      <FontAwesome6
                        name="calendar-days"
                        size={18}
                        color={tokens.colors.muted}
                      />
                    )}
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {request.requestedServiceName}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {request.city}
                      {request.stateCode ? `, ${request.stateCode}` : ""} ·{" "}
                      {request.matches.length}{" "}
                      {request.matches.length === 1 ? "match" : "matches"}
                    </Text>
                  </View>
                  <StatusPill status={request.status} />
                  <FontAwesome6
                    name="chevron-right"
                    size={14}
                    color={tokens.colors.mutedSoft}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {requestId && !isLoading && !selectedRequest ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Request unavailable</Text><Text style={styles.emptyBody}>This request could not be found in your account. Go back to your requests and refresh.</Text></View> : null}
        {requestId && selectedRequest ? (
          <View style={styles.section}>
            <SectionHeader
              title={selectedRequest.requestedServiceName}
              subtitle={[
                formatDateLabel(selectedRequest.desiredDate),
                selectedRequest.budgetMinCents || selectedRequest.budgetMaxCents
                  ? `${formatMarketplacePrice(selectedRequest.budgetMinCents, null, selectedRequest.currencyCode)} - ${formatMarketplacePrice(selectedRequest.budgetMaxCents, null, selectedRequest.currencyCode)}`
                  : "Open budget",
                `${selectedRequest.conversations.length} ${selectedRequest.conversations.length === 1 ? "chat" : "chats"}`,
              ].join(" · ")}
            />
            <View style={styles.reviewCard}>
              <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Status</Text><StatusPill status={selectedRequest.status}/></View>
              <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Location</Text><Text style={styles.reviewValue}>{[selectedRequest.city, selectedRequest.stateCode, selectedRequest.countryCode].filter(Boolean).join(", ")}</Text></View>
              <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Preferred time</Text><Text style={styles.reviewValue}>{selectedRequest.desiredWindowStart && selectedRequest.desiredWindowEnd ? `${formatTimeLabel(selectedRequest.desiredWindowStart)} – ${formatTimeLabel(selectedRequest.desiredWindowEnd)}` : "Any time"}</Text></View>
            </View>
            {selectedRequest.description ? (
              <Text style={styles.description}>
                {selectedRequest.description}
              </Text>
            ) : null}

            {selectedRequest.matches.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No matches yet</Text>
                <Text style={styles.emptyBody}>
                  Providers near you have been notified.
                </Text>
              </View>
            ) : (
              selectedRequest.matches.map((match) => {
                const conversation = selectedRequest.conversations.find(
                  (item) => item.quoteMatchId === match.id,
                );
                const isAccepted =
                  selectedRequest.acceptedQuoteMatchId === match.id;
                const metaParts = [
                  match.matchedService?.name ?? match.provider.businessCategory,
                  formatMarketplaceDistance(match.distanceMiles),
                  match.provider.averageRating
                    ? `★ ${match.provider.averageRating.toFixed(1)}`
                    : null,
                ].filter(Boolean);

                return (
                  <View key={match.id} style={styles.matchCard}>
                    <View style={styles.matchTop}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {getInitials(match.provider.displayName || "BM")}
                        </Text>
                      </View>
                      <View style={styles.rowBody}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {match.provider.displayName}
                        </Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {metaParts.join(" · ")}
                        </Text>
                      </View>
                      <View style={styles.matchEnd}>
                        <Text style={styles.matchPrice}>
                          {match.matchedService?.priceCents
                            ? formatMarketplacePrice(
                                match.matchedService.priceCents,
                                null,
                                match.matchedService.currencyCode,
                              )
                            : "Quote"}
                        </Text>
                        <StatusPill
                          status={isAccepted ? "ACCEPTED" : match.status}
                        />
                      </View>
                    </View>

                    <View style={styles.matchActions}>
                      {conversation ? (
                        <AuthButton
                          label="Open chat"
                          variant="secondary"
                          style={styles.matchButton}
                          onPress={() => {
                            setSelectedConversationId(conversation.id);
                            setChatOpen(true);
                          }}
                        />
                      ) : (
                        <Text style={styles.matchHint}>
                          Waiting for a reply
                        </Text>
                      )}
                      {canAcceptQuoteMatch(selectedRequest, match.id) ? (
                        <AuthButton
                          label="Accept"
                          variant="navy"
                          style={styles.matchButton}
                          loading={acceptingMatchId === match.id}
                          disabled={acceptingMatchId !== null}
                          onPress={() => void handleAcceptMatch(match.id)}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}

            {selectedConversation ? <QuoteChatModal visible={chatOpen}
              conversation={selectedConversation} conversations={selectedRequest.conversations}
              serviceName={selectedRequest.requestedServiceName} draft={messageDraft}
              sending={isSendingMessage} error={chatError} syncIssue={syncIssue}
              onClose={() => setChatOpen(false)} onSelect={setSelectedConversationId}
              onDraftChange={setMessageDraft} onSend={() => void handleSendMessage()}
              onRefresh={() => void loadWorkspace(true)} /> : null}
          </View>
        ) : null}
      </Screen>

      <Modal
        visible={composerOpen}
        animationType="slide"
        onRequestClose={closeComposer}
      >
        <SafeAreaView style={styles.composerRoot} edges={["top"]}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.modalKeyboardWrap}
            >
              <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderCopy}>
                    <Text style={styles.modalTitle}>New request</Text>
                    <Text style={styles.stepCaption}>
                      Step {stepNumber} of {composerSteps.length} ·{" "}
                      {composerSteps[composerStepIndex]?.label}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.closeButton}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    onPress={closeComposer}
                  >
                    <FontAwesome6
                      name="xmark"
                      size={18}
                      color={tokens.colors.ink}
                    />
                  </Pressable>
                </View>
                <View
                  style={styles.progressRow}
                  accessibilityRole="progressbar"
                >
                  {composerSteps.map((step, index) => (
                    <Pressable
                      key={step.id}
                      accessibilityRole="button"
                      accessibilityLabel={step.label}
                      hitSlop={10}
                      style={[
                        styles.progressSegment,
                        index <= composerStepIndex
                          ? styles.progressSegmentDone
                          : null,
                      ]}
                      onPress={() => {
                        if (index <= composerStepIndex) {
                          setComposerStep(step.id);
                        }
                      }}
                    />
                  ))}
                </View>

                <ScrollView
                  ref={composerScroll}
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {composerStep === "request" ? (
                    <>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Template</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.railScroll}
                          contentContainerStyle={styles.chipRail}
                        >
                          {requestTemplates.map((template) => {
                            const isActive = template.id === templateId;
                            return (
                              <Pressable
                                key={template.id}
                                accessibilityRole="button"
                                accessibilityState={{ selected: isActive }}
                                style={[
                                  styles.chip,
                                  isActive ? styles.chipActive : null,
                                ]}
                                onPress={() => setTemplateId(template.id)}
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    isActive ? styles.chipTextActive : null,
                                  ]}
                                >
                                  {template.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                        {activeTemplate?.shortDescription ? (
                          <Text style={styles.fieldHelp}>
                            {activeTemplate.shortDescription}
                          </Text>
                        ) : null}
                      </View>

                      <View onLayout={recordField("currency")}><AuthField
                        label="Budget currency"
                        placeholder="USD, NGN, GBP…"
                        value={currencyCode}
                        onChangeText={(value) =>
                          setCurrencyCode(value.toUpperCase().slice(0, 3))
                        }
                        autoComplete="off"
                      />{validationAttempted && requestIssue?.field === "currency" ? <Text accessibilityRole="alert" style={styles.errorText}>{requestIssue.message}</Text> : null}</View>
                      {!/^[A-Z]{3}$/.test(currencyCode) ? (
                        <Text
                          accessibilityRole="alert"
                          style={styles.errorText}
                        >
                          Enter a 3-letter currency code, such as USD or NGN.
                        </Text>
                      ) : null}
                      <View onLayout={recordField("service")}><AuthField
                        label="Service"
                        placeholder="What do you need?"
                        value={serviceName}
                        onChangeText={setServiceName}
                        autoComplete="off"
                      />{validationAttempted && requestIssue?.field === "service" ? <Text accessibilityRole="alert" style={styles.errorText}>{requestIssue.message}</Text> : null}</View>

                      <View style={styles.fieldGroup} onLayout={recordField("description")}>
                        <Text style={styles.fieldLabel}>Details</Text>
                        <TextInput
                          value={description}
                          onChangeText={setDescription}
                          placeholder="Style, timing and anything else providers should know"
                          placeholderTextColor={tokens.colors.muted}
                          style={styles.textArea}
                          multiline
                          textAlignVertical="top"
                          accessibilityLabel="Details"
                        />
                        {validationAttempted && requestIssue?.field === "description" ? <Text accessibilityRole="alert" style={styles.errorText}>{requestIssue.message}</Text> : null}
                      </View>

                      <View onLayout={recordField("budget")}><AuthField
                        label={`Budget from (${currencyCode})`}
                        placeholder="Optional"
                        value={budgetMin}
                        onChangeText={setBudgetMin}
                        keyboardType="number-pad"
                        autoComplete="off"
                      />{validationAttempted && requestIssue?.field === "budget" ? <Text accessibilityRole="alert" style={styles.errorText}>{requestIssue.message}</Text> : null}</View>
                      <AuthField
                        label={`Budget up to (${currencyCode})`}
                        placeholder="Optional"
                        value={budgetMax}
                        onChangeText={setBudgetMax}
                        keyboardType="number-pad"
                        autoComplete="off"
                      />

                      <View style={styles.fieldGroup} onLayout={recordField("date")}>
                        <Text style={styles.fieldLabel}>
                          Preferred date
                          {activeTemplate?.requiresDate ? "" : " (optional)"}
                        </Text>
                        {validationAttempted && requestIssue?.field === "date" ? <Text accessibilityRole="alert" style={styles.errorText}>{requestIssue.message}</Text> : null}
                        <Pressable
                          style={styles.pickerField}
                          accessibilityRole="button"
                          onPress={() => openPicker("desiredDate", "date")}
                        >
                          <Text
                            style={[
                              styles.pickerFieldText,
                              !desiredDate
                                ? styles.pickerFieldPlaceholder
                                : null,
                            ]}
                          >
                            {desiredDate
                              ? formatDateLabel(desiredDate)
                              : "Choose a date"}
                          </Text>
                          <FontAwesome6
                            name="calendar-days"
                            size={16}
                            color={tokens.colors.muted}
                          />
                        </Pressable>
                      </View>

                      <View style={styles.fieldGroup} onLayout={recordField("time")}>
                        <Text style={styles.fieldLabel}>Earliest time</Text>
                        {validationAttempted && requestIssue?.field === "time" ? <Text accessibilityRole="alert" style={styles.errorText}>{requestIssue.message}</Text> : null}
                        <Pressable
                          style={styles.pickerField}
                          accessibilityRole="button"
                          onPress={() =>
                            openPicker("desiredWindowStart", "time")
                          }
                        >
                          <Text
                            style={[
                              styles.pickerFieldText,
                              !desiredWindowStart
                                ? styles.pickerFieldPlaceholder
                                : null,
                            ]}
                          >
                            {desiredWindowStart
                              ? formatTimeLabel(desiredWindowStart)
                              : "Any time"}
                          </Text>
                          <FontAwesome6
                            name="clock"
                            size={16}
                            color={tokens.colors.muted}
                          />
                        </Pressable>
                      </View>

                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Latest time</Text>
                        <Pressable
                          style={styles.pickerField}
                          accessibilityRole="button"
                          onPress={() => openPicker("desiredWindowEnd", "time")}
                        >
                          <Text
                            style={[
                              styles.pickerFieldText,
                              !desiredWindowEnd
                                ? styles.pickerFieldPlaceholder
                                : null,
                            ]}
                          >
                            {desiredWindowEnd
                              ? formatTimeLabel(desiredWindowEnd)
                              : "Any time"}
                          </Text>
                          <FontAwesome6
                            name="clock"
                            size={16}
                            color={tokens.colors.muted}
                          />
                        </Pressable>
                      </View>

                      {scheduleError ? (
                        <Text accessibilityRole="alert" style={styles.errorText}>{scheduleError}</Text>
                      ) : null}

                      {intakeFields.map((field) => {
                        const fieldValue = intakeAnswers[field.id];
                        const stringValue =
                          typeof fieldValue === "string" ? fieldValue : "";
                        const selectedValues = Array.isArray(fieldValue)
                          ? fieldValue.filter(
                              (value): value is string =>
                                typeof value === "string",
                            )
                          : [];
                        const label = `${field.label}${field.required ? "" : " (optional)"}`;

                        if (field.type === "LONG_TEXT") {
                          return (
                            <View key={field.id} style={styles.fieldGroup} onLayout={recordField(field.id)}>
                              {validationAttempted && requestIssue?.field === field.id ? <Text accessibilityRole="alert" style={styles.errorText}>{requestIssue.message}</Text> : null}
                              <Text style={styles.fieldLabel}>{label}</Text>
                              <TextInput
                                value={stringValue}
                                onChangeText={(value) =>
                                  updateIntakeAnswer(field.id, value)
                                }
                                placeholder={field.placeholder ?? ""}
                                placeholderTextColor={tokens.colors.muted}
                                style={styles.textArea}
                                multiline
                                textAlignVertical="top"
                                accessibilityLabel={field.label}
                              />
                              {field.helpText ? (
                                <Text style={styles.fieldHelp}>
                                  {field.helpText}
                                </Text>
                              ) : null}
                            </View>
                          );
                        }

                        if (
                          field.type === "SELECT" ||
                          field.type === "MULTI_SELECT" ||
                          field.type === "BOOLEAN"
                        ) {
                          const options =
                            field.type === "BOOLEAN"
                              ? [
                                  {
                                    key: "true",
                                    label: "Yes",
                                    selected: fieldValue === true,
                                    onPress: () =>
                                      updateIntakeAnswer(field.id, true),
                                  },
                                  {
                                    key: "false",
                                    label: "No",
                                    selected: fieldValue === false,
                                    onPress: () =>
                                      updateIntakeAnswer(field.id, false),
                                  },
                                ]
                              : (field.options ?? []).map((option) => {
                                  const selected =
                                    field.type === "SELECT"
                                      ? stringValue === option
                                      : selectedValues.includes(option);
                                  const nextValues = selected
                                    ? selectedValues.filter(
                                        (value) => value !== option,
                                      )
                                    : [...selectedValues, option];
                                  return {
                                    key: option,
                                    label: option,
                                    selected,
                                    onPress: () =>
                                      field.type === "SELECT"
                                        ? updateIntakeAnswer(field.id, option)
                                        : updateIntakeAnswer(
                                            field.id,
                                            nextValues,
                                          ),
                                  };
                                });

                          return (
                            <View key={field.id} style={styles.fieldGroup} onLayout={recordField(field.id)}>
                              {validationAttempted && requestIssue?.field === field.id ? <Text accessibilityRole="alert" style={styles.errorText}>{requestIssue.message}</Text> : null}
                              <Text style={styles.fieldLabel}>{label}</Text>
                              <View style={styles.chipWrap}>
                                {options.map((option) => (
                                  <Pressable
                                    key={option.key}
                                    accessibilityRole="button"
                                    accessibilityState={{
                                      selected: option.selected,
                                    }}
                                    style={[
                                      styles.chip,
                                      option.selected
                                        ? styles.chipActive
                                        : null,
                                    ]}
                                    onPress={option.onPress}
                                  >
                                    <Text
                                      style={[
                                        styles.chipText,
                                        option.selected
                                          ? styles.chipTextActive
                                          : null,
                                      ]}
                                    >
                                      {option.label}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                              {field.helpText ? (
                                <Text style={styles.fieldHelp}>
                                  {field.helpText}
                                </Text>
                              ) : null}
                            </View>
                          );
                        }

                        return (
                          <View key={field.id} onLayout={recordField(field.id)}><AuthField
                            label={label}
                            placeholder={field.placeholder ?? ""}
                            value={stringValue}
                            onChangeText={(value) =>
                              updateIntakeAnswer(field.id, value)
                            }
                            helperText={field.helpText ?? undefined}
                            autoComplete="off"
                          />{validationAttempted && requestIssue?.field === field.id ? <Text accessibilityRole="alert" style={styles.errorText}>{requestIssue.message}</Text> : null}</View>
                        );
                      })}

                      {activeTemplate?.checklistItems.length ? (
                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>What to include</Text>
                          <View style={styles.chipWrap}>
                            {activeTemplate.checklistItems.map((item) => {
                              const selected =
                                requestedDocumentLabels.includes(item);
                              return (
                                <Pressable
                                  key={item}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected }}
                                  style={[
                                    styles.chip,
                                    selected ? styles.chipActive : null,
                                  ]}
                                  onPress={() => toggleRequestedDocument(item)}
                                >
                                  <Text
                                    style={[
                                      styles.chipText,
                                      selected ? styles.chipTextActive : null,
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
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>
                          How you want it done
                        </Text>
                        {channelOptions.map((option) => {
                          const selected = normalizedRequestedChannels.includes(
                            option.value,
                          );
                          return (
                            <Pressable
                              key={option.value}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: selected }}
                              style={[
                                styles.optionRow,
                                selected ? styles.optionRowActive : null,
                              ]}
                              onPress={() =>
                                toggleRequestedChannel(option.value)
                              }
                            >
                              <View style={styles.rowBody}>
                                <Text style={styles.optionTitle}>
                                  {option.label}
                                </Text>
                                <Text style={styles.rowMeta}>
                                  {option.description}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.check,
                                  selected ? styles.checkActive : null,
                                ]}
                              >
                                {selected ? (
                                  <FontAwesome6
                                    name="check"
                                    size={12}
                                    color={tokens.colors.inkDeep}
                                  />
                                ) : null}
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>

                      <View onLayout={recordField("city")}><AuthField
                        label="City"
                        placeholder="City"
                        value={city}
                        onChangeText={setCity}
                        autoComplete="off"
                      />{validationAttempted && locationIssue?.field === "city" ? <Text accessibilityRole="alert" style={styles.errorText}>{locationIssue.message}</Text> : null}</View>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>State</Text>
                        <View style={styles.inputShell}>
                          <TextInput
                            value={stateCode}
                            onChangeText={setStateCode}
                            placeholder="State code"
                            placeholderTextColor={tokens.colors.muted}
                            style={styles.input}
                            autoCapitalize="characters"
                            accessibilityLabel="State"
                          />
                        </View>
                      </View>
                      <View style={styles.fieldGroup} onLayout={recordField("country")}>
                        <Text style={styles.fieldLabel}>Country</Text>
                        {validationAttempted && locationIssue?.field === "country" ? <Text accessibilityRole="alert" style={styles.errorText}>{locationIssue.message}</Text> : null}
                        <View style={styles.inputShell}>
                          <TextInput
                            value={countryCode}
                            onChangeText={setCountryCode}
                            placeholder="Country code"
                            placeholderTextColor={tokens.colors.muted}
                            style={styles.input}
                            autoCapitalize="characters"
                            accessibilityLabel="Country"
                          />
                        </View>
                      </View>
                      <AuthField
                        label="Search radius (miles)"
                        placeholder="15"
                        value={searchRadiusMiles}
                        onChangeText={setSearchRadiusMiles}
                        keyboardType="number-pad"
                        autoComplete="off"
                      />
                      <AuthField
                        label="Address line 1 (optional)"
                        placeholder="Street address"
                        value={line1}
                        onChangeText={setLine1}
                        autoComplete="off"
                      />
                      <AuthField
                        label="Address line 2 (optional)"
                        placeholder="Apartment, suite, gate code"
                        value={line2}
                        onChangeText={setLine2}
                        autoComplete="off"
                      />
                      <AuthField
                        label="County (optional)"
                        placeholder="County"
                        value={countyName}
                        onChangeText={setCountyName}
                        autoComplete="off"
                      />
                      <AuthField
                        label="Postal code (optional)"
                        placeholder="Postal code"
                        value={postalCode}
                        onChangeText={setPostalCode}
                        autoComplete="off"
                      />
                      <AuthField
                        label="Contact phone (optional)"
                        placeholder="Phone number"
                        value={contactPhone}
                        onChangeText={setContactPhone}
                        autoComplete="off"
                      />
                    </>
                  ) : null}

                  {composerStep === "review" ? (
                    <>
                      <View style={styles.reviewCard}>
                        {reviewRows.map((row, index) => (
                          <View
                            key={row.label}
                            style={[
                              styles.reviewRow,
                              index > 0 ? styles.reviewRowBorder : null,
                            ]}
                          >
                            <Text style={styles.reviewLabel}>{row.label}</Text>
                            <Text style={styles.reviewValue}>{row.value}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>
                          What providers see
                        </Text>
                        <Text style={styles.description}>
                          {buildRequestDescription({
                            description,
                            serviceModel: effectiveServiceModel,
                            requestedChannels: normalizedRequestedChannels,
                            searchAddress:
                              [line1, line2, city, stateCode, postalCode]
                                .filter(Boolean)
                                .join(", ") || undefined,
                            city,
                            stateCode,
                            countryCode,
                            searchRadiusMiles,
                            intakeResponses,
                            requestedDocumentLabels,
                          }) ||
                            "Add a short description so providers know what you need."}
                        </Text>
                      </View>

                      {requestedDocumentLabels.length ? (
                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>
                            You will include
                          </Text>
                          {requestedDocumentLabels.map((item) => (
                            <View key={item} style={styles.checklistRow}>
                              <FontAwesome6
                                name="check"
                                size={14}
                                color={tokens.colors.success}
                              />
                              <Text style={styles.checklistText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  {requestValidationError && composerStep === "review" ? (
                    <View style={styles.errorBox}>
                      <Text accessibilityRole="alert" style={styles.errorText}>{requestValidationError}</Text>
                      <AuthButton label="Edit request details" onPress={() => {
                        const issue = requestIssue || locationIssue;
                        if (issue) showIssue(issue, requestIssue ? "request" : "location");
                      }} />
                    </View>
                  ) : null}
                  {!budgetValid && composerStep === "request" ? (
                    <Text accessibilityRole="alert" style={styles.errorText}>Enter a valid budget with the maximum at least as much as the minimum.</Text>
                  ) : null}
                  {error ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText} accessibilityRole="alert">
                        {error}
                      </Text>
                    </View>
                  ) : null}
                </ScrollView>

                <View style={styles.modalFooter}>
                  <AuthButton
                    label={composerStep === "request" ? "Cancel" : "Back"}
                    variant="secondary"
                    style={styles.footerSecondary}
                    onPress={
                      composerStep === "request"
                        ? closeComposer
                        : () =>
                            setComposerStep(
                              composerStep === "review"
                                ? "location"
                                : "request",
                            )
                    }
                  />
                  {footerPrimary}
                </View>
              </SafeAreaView>
            </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={!!activePicker}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={closePicker}
          />
          {activePicker ? (
            <View style={styles.pickerSheetWrap}>
              <SafeAreaView style={styles.pickerSheet} edges={["bottom"]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderCopy}>
                    <Text style={styles.modalTitle}>
                      {activePicker.field === "desiredDate"
                        ? "Preferred date"
                        : activePicker.field === "desiredWindowStart"
                          ? "Earliest time"
                          : "Latest time"}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.closeButton}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    onPress={closePicker}
                  >
                    <FontAwesome6
                      name="xmark"
                      size={18}
                      color={tokens.colors.ink}
                    />
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
                  <View style={styles.modalFooter}>
                    <AuthButton
                      label="Cancel"
                      variant="secondary"
                      style={styles.footerSecondary}
                      onPress={closePicker}
                    />
                    <AuthButton
                      label="Done"
                      style={styles.footerPrimary}
                      onPress={confirmPicker}
                    />
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

function StatusPill({
  status,
}: {
  status: CustomerQuoteRequest["status"] | string;
}) {
  const tone =
    status === "MATCHED"
      ? styles.pillMatched
      : status === "ACCEPTED"
        ? styles.pillBooked
        : status === "CANCELLED" ||
            status === "EXPIRED" ||
            status === "DECLINED"
          ? styles.pillMuted
          : null;
  const textTone =
    status === "MATCHED"
      ? styles.pillTextMatched
      : status === "ACCEPTED"
        ? styles.pillTextBooked
        : status === "CANCELLED" ||
            status === "EXPIRED" ||
            status === "DECLINED"
          ? styles.pillTextMuted
          : null;
  const label =
    status === "ACCEPTED"
      ? "Booked"
      : status === "OPEN" ||
          status === "MATCHED" ||
          status === "CANCELLED" ||
          status === "EXPIRED"
        ? formatRequestStatus(status as CustomerQuoteRequest["status"])
        : status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");

  return (
    <View style={[styles.pill, tone]}>
      <Text style={[styles.pillText, textTone]}>{label}</Text>
    </View>
  );
}

function SkeletonRows() {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.list}>
      {[0, 1, 2].map((index) => (
        <Animated.View key={index} style={[styles.row, { opacity }]}>
          <View style={[styles.dateTile, styles.skeletonBlock]} />
          <View style={styles.rowBody}>
            <View style={[styles.skeletonBlock, styles.skeletonLineShort]} />
            <View style={[styles.skeletonBlock, styles.skeletonLine]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  list: {
    gap: 12,
  },
  railScroll: {
    marginHorizontal: -20,
  },
  chipRail: {
    gap: 8,
    paddingHorizontal: 20,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    height: 40,
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: tokens.colors.inkDeep,
    borderColor: tokens.colors.inkDeep,
  },
  chipText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.semibold,
  },
  chipTextActive: {
    color: "#ffffff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  rowActive: {
    borderColor: tokens.colors.inkDeep,
  },
  dateTile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dateTileDay: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontFamily: tokens.font.semibold,
  },
  dateTileNum: {
    color: tokens.colors.ink,
    fontSize: 18,
    lineHeight: 22,
    fontFamily: tokens.font.display,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.bold,
  },
  rowMeta: {
    color: tokens.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: tokens.font.regular,
  },
  pill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillMatched: {
    backgroundColor: tokens.colors.brandSoft,
  },
  pillBooked: {
    backgroundColor: tokens.colors.successSoft,
  },
  pillMuted: {
    backgroundColor: tokens.colors.surfaceSoft,
  },
  pillText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontFamily: tokens.font.bold,
  },
  pillTextMatched: {
    color: tokens.colors.brandDeep,
  },
  pillTextBooked: {
    color: tokens.colors.success,
  },
  pillTextMuted: {
    color: tokens.colors.mutedSoft,
  },
  description: {
    color: tokens.colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: tokens.font.regular,
  },
  matchCard: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 14,
    gap: 12,
  },
  matchTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.inkDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: tokens.font.bold,
  },
  matchEnd: {
    alignItems: "flex-end",
    gap: 6,
  },
  matchPrice: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.bold,
  },
  matchActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  matchButton: {
    flex: 1,
    minHeight: 44,
  },
  matchHint: {
    flex: 1,
    color: tokens.colors.muted,
    fontSize: 13,
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
    lineHeight: 20,
    textAlign: "center",
    fontFamily: tokens.font.regular,
  },
  emptyAction: {
    alignSelf: "stretch",
    marginTop: 12,
  },
  errorBox: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: "#f3c4c4",
    backgroundColor: tokens.colors.dangerSoft,
    padding: 14,
    gap: 6,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: tokens.font.regular,
  },
  errorRetry: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontFamily: tokens.font.bold,
  },
  skeletonBlock: {
    backgroundColor: tokens.colors.border,
    borderWidth: 0,
    borderRadius: 7,
  },
  skeletonLineShort: {
    height: 14,
    width: "55%",
  },
  skeletonLine: {
    height: 12,
    width: "90%",
  },
  composerRoot: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(16, 39, 72, 0.45)",
  },
  modalKeyboardWrap: {
    flex: 1,
  },
  modalSheet: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    flex: 1,
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    backgroundColor: tokens.colors.surface,
    paddingTop: 12,
    overflow: "hidden",
  },
  pickerSheetWrap: {
    justifyContent: "flex-end",
  },
  pickerSheet: {
    width: "100%",
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    backgroundColor: tokens.colors.surface,
    paddingTop: 12,
    overflow: "hidden",
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.borderStrong,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    color: tokens.colors.ink,
    fontSize: 22,
    lineHeight: 26,
    fontFamily: tokens.font.display,
    letterSpacing: -0.4,
  },
  stepCaption: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontFamily: tokens.font.medium,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.borderStrong,
  },
  progressSegmentDone: {
    backgroundColor: tokens.colors.brand,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  footerSecondary: {
    minWidth: 112,
    minHeight: 56,
  },
  footerPrimary: {
    flex: 1,
  },
  fieldGroup: {
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
  inputShell: {
    height: 52,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  input: {
    height: 50,
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.regular,
  },
  textArea: {
    minHeight: 120,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.regular,
  },
  pickerField: {
    height: 52,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pickerFieldText: {
    color: tokens.colors.ink,
    fontSize: 16,
    fontFamily: tokens.font.regular,
  },
  pickerFieldPlaceholder: {
    color: tokens.colors.muted,
  },
  optionRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionRowActive: {
    borderColor: tokens.colors.inkDeep,
  },
  optionTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.semibold,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkActive: {
    borderColor: tokens.colors.brand,
    backgroundColor: tokens.colors.brand,
  },
  reviewCard: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 14,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  reviewRowBorder: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  reviewLabel: {
    width: 88,
    color: tokens.colors.muted,
    fontSize: 14,
    fontFamily: tokens.font.regular,
  },
  reviewValue: {
    flex: 1,
    color: tokens.colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: tokens.font.semibold,
    textAlign: "right",
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checklistText: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontFamily: tokens.font.regular,
  },
  pickerBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  dateTimePicker: {
    alignSelf: "stretch",
    backgroundColor: "#ffffff",
    borderRadius: 16,
  },
});

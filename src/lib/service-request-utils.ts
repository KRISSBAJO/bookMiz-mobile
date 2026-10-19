import type { CustomerQuoteRequest, MarketplaceRequestTemplate } from "@/src/lib/api/types";

export function canAcceptQuoteMatch(request: CustomerQuoteRequest, matchId: string): boolean {
  return (request.status === "OPEN" || request.status === "MATCHED") &&
    !request.acceptedQuoteMatchId && !request.acceptedProviderId && !request.acceptedAt &&
    !request.matches.some((match) => match.status === "ACCEPTED") &&
    request.matches.some((match) => match.id === matchId && match.status === "UNLOCKED");
}

export type ServiceRequestServiceModel = "LOCAL" | "PROFESSIONAL" | "HYBRID";

export type AppointmentChannel = "IN_PERSON" | "HOME_VISIT" | "VIDEO" | "PHONE";

export type ProfessionalIntakeFieldType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "SELECT"
  | "MULTI_SELECT"
  | "BOOLEAN";

export type ProfessionalIntakeField = {
  id: string;
  label: string;
  type: ProfessionalIntakeFieldType;
  placeholder: string | null;
  helpText: string | null;
  options: string[] | null;
  required: boolean;
};

export type ProfessionalIntakeResponse = {
  fieldId: string;
  label: string;
  type: ProfessionalIntakeFieldType;
  value: string | string[] | boolean;
};

export type ServiceRequestIntakeAnswer = string | string[] | boolean;

export type ServiceRequestIntakeAnswerMap = Record<
  string,
  ServiceRequestIntakeAnswer | undefined
>;

export type ServiceRequestChannelOption = {
  value: AppointmentChannel;
  label: string;
  description: string;
};

function normalizeFieldType(rawType: unknown): ProfessionalIntakeFieldType {
  const normalized = typeof rawType === "string" ? rawType.trim().toLowerCase() : "";

  if (normalized === "textarea" || normalized === "long_text") {
    return "LONG_TEXT";
  }

  if (normalized === "select") {
    return "SELECT";
  }

  if (normalized === "multiselect" || normalized === "multi_select") {
    return "MULTI_SELECT";
  }

  if (normalized === "boolean" || normalized === "checkbox") {
    return "BOOLEAN";
  }

  return "SHORT_TEXT";
}

export function parseTemplateIntakeFields(
  input: MarketplaceRequestTemplate["intakeFields"],
): ProfessionalIntakeField[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const fields: ProfessionalIntakeField[] = [];

  input.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const record = item as Record<string, unknown>;
    const fieldId =
      typeof record.id === "string"
        ? record.id
        : typeof record.key === "string"
          ? record.key
          : `field-${index + 1}`;

    fields.push({
      id: fieldId,
      label:
        typeof record.label === "string"
          ? record.label
          : typeof record.name === "string"
            ? record.name
            : `Field ${index + 1}`,
      type: normalizeFieldType(record.type),
      placeholder: typeof record.placeholder === "string" ? record.placeholder : null,
      helpText:
        typeof record.helpText === "string"
          ? record.helpText
          : typeof record.description === "string"
            ? record.description
            : null,
      options: Array.isArray(record.options)
        ? record.options.filter((option): option is string => typeof option === "string")
        : null,
      required: Boolean(record.required),
    });
  });

  return fields;
}

export function buildDefaultRequestedChannels(
  serviceModel: ServiceRequestServiceModel,
  requiresAddress: boolean,
): AppointmentChannel[] {
  if (serviceModel === "LOCAL") {
    return ["HOME_VISIT"];
  }

  if (serviceModel === "PROFESSIONAL") {
    return requiresAddress ? ["IN_PERSON"] : ["VIDEO"];
  }

  return requiresAddress ? ["IN_PERSON", "VIDEO"] : ["VIDEO"];
}

export function getChannelOptionsForServiceModel(
  serviceModel: ServiceRequestServiceModel,
): ServiceRequestChannelOption[] {
  const inPersonLabel = serviceModel === "LOCAL" ? "I can travel" : "Office visit";
  const inPersonDescription =
    serviceModel === "LOCAL"
      ? "Meet at the provider's location."
      : "Meet at the office or practice location.";

  const options: ServiceRequestChannelOption[] = [
    {
      value: "IN_PERSON",
      label: inPersonLabel,
      description: inPersonDescription,
    },
  ];

  if (serviceModel === "LOCAL") {
    options.push({
      value: "HOME_VISIT",
      label: "Provider comes to me",
      description: "Match providers who can travel to your location.",
    });
    return options;
  }

  options.push(
    {
      value: "VIDEO",
      label: "Video call",
      description: "Meet remotely over a video session.",
    },
    {
      value: "PHONE",
      label: "Phone call",
      description: "Handle the session over the phone.",
    },
  );

  if (serviceModel === "HYBRID") {
    options.push({
      value: "HOME_VISIT",
      label: "Provider comes to me",
      description: "Match providers who travel for on-site sessions.",
    });
  }

  return options;
}

export function normalizeRequestedChannels(
  channels: AppointmentChannel[] | undefined,
  serviceModel: ServiceRequestServiceModel,
  requiresAddress: boolean,
) {
  const allowedChannels = new Set(
    getChannelOptionsForServiceModel(serviceModel).map((option) => option.value),
  );

  const normalized = Array.from(
    new Set((channels ?? []).filter((channel) => allowedChannels.has(channel))),
  );

  return normalized.length > 0
    ? normalized
    : buildDefaultRequestedChannels(serviceModel, requiresAddress);
}

export function formatRequestedChannels(
  channels: AppointmentChannel[],
  serviceModel: ServiceRequestServiceModel,
) {
  const labels = new Map(
    getChannelOptionsForServiceModel(serviceModel).map((option) => [
      option.value,
      option.label,
    ]),
  );

  return channels.map((channel) => labels.get(channel) ?? channel).join(", ");
}

export function buildIntakeResponses(
  fields: ProfessionalIntakeField[],
  answers: ServiceRequestIntakeAnswerMap,
): ProfessionalIntakeResponse[] {
  const responses: ProfessionalIntakeResponse[] = [];

  fields.forEach((field) => {
    const rawValue = answers[field.id];

    if (field.type === "BOOLEAN") {
      if (typeof rawValue === "boolean") {
        responses.push({
          fieldId: field.id,
          label: field.label,
          type: field.type,
          value: rawValue,
        });
      }
      return;
    }

    if (field.type === "MULTI_SELECT") {
      if (Array.isArray(rawValue) && rawValue.length > 0) {
        responses.push({
          fieldId: field.id,
          label: field.label,
          type: field.type,
          value: rawValue.filter((entry): entry is string => typeof entry === "string"),
        });
      }
      return;
    }

    if (typeof rawValue === "string" && rawValue.trim()) {
      responses.push({
        fieldId: field.id,
        label: field.label,
        type: field.type,
        value: rawValue.trim(),
      });
    }
  });

  return responses;
}

export function buildRequestDescription(input: {
  description: string;
  serviceModel: ServiceRequestServiceModel;
  requestedChannels: AppointmentChannel[];
  searchAddress?: string;
  city?: string;
  stateCode?: string;
  countryCode?: string;
  searchRadiusMiles?: string;
  intakeResponses?: ProfessionalIntakeResponse[];
  requestedDocumentLabels?: string[];
}) {
  const locationLabel =
    input.searchAddress ||
    [input.city, input.stateCode, input.countryCode].filter(Boolean).join(", ");
  const sections: string[] = [];

  sections.push(
    `Delivery preference: ${formatRequestedChannels(
      input.requestedChannels,
      input.serviceModel,
    )}`,
  );

  if (locationLabel) {
    sections.push(`Service area: ${locationLabel}`);
  }

  if (input.searchRadiusMiles) {
    sections.push(`Search radius: ${input.searchRadiusMiles} miles`);
  }

  if (input.intakeResponses && input.intakeResponses.length > 0) {
    sections.push(
      [
        "Intake details:",
        ...input.intakeResponses.map((response) => {
          const value = Array.isArray(response.value)
            ? response.value.join(", ")
            : typeof response.value === "boolean"
              ? response.value
                ? "Yes"
                : "No"
              : response.value;
          return `- ${response.label}: ${value}`;
        }),
      ].join("\n"),
    );
  }

  if (input.requestedDocumentLabels && input.requestedDocumentLabels.length > 0) {
    sections.push(
      [
        "Requested documents or prep:",
        ...input.requestedDocumentLabels.map((label) => `- ${label}`),
      ].join("\n"),
    );
  }

  if (input.description.trim()) {
    sections.push(input.description.trim());
  }

  return sections.filter(Boolean).join("\n\n");
}

export type ApiSuccessEnvelope<T> = {
  success: true;
  timestamp: string;
  path: string;
  data: T;
};

export type ApiErrorEnvelope = {
  success: false;
  timestamp: string;
  path: string;
  error: {
    statusCode: number;
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
};

export class ApiRequestError extends Error {
  statusCode?: number;
  details?: Array<{ field?: string; message: string }>;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      details?: Array<{ field?: string; message: string }>;
    },
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = options?.statusCode;
    this.details = options?.details;
  }
}

export type MobileAuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  userType: string;
  emailVerified: boolean;
};

export type AuthOrganization = {
  id: string;
  displayName: string;
  slug: string;
  role: string;
  onboardingProfile?: Record<string, unknown> | null;
};

export type AuthSession = MobileAuthTokens & {
  id: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  usesHttpOnlyCookies: boolean;
};

export type AuthResponseData = {
  message: string;
  user: AuthUser;
  organizations: AuthOrganization[];
  session: AuthSession;
  development?: Record<string, unknown>;
};

export type MessageResponseData = {
  message: string;
  meta?: Record<string, unknown>;
};

export type NotificationPreferences = {
  emailQuoteResponses: boolean;
  emailAppointmentReminders: boolean;
  emailSavedProviderUpdates: boolean;
  emailMarketing: boolean;
  smsQuoteResponses: boolean;
  smsAppointmentReminders: boolean;
  smsMarketing: boolean;
};

export type ProfileSettings = {
  userId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  phone: string | null;
  timezone: string | null;
  locale: string | null;
  city: string | null;
  stateCode: string | null;
  countryCode: string | null;
  homeLatitude: number | null;
  homeLongitude: number | null;
  notificationPreferences: NotificationPreferences;
};

export type RegisterCustomerPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
  rememberMe?: boolean;
  mfaCode?: string;
  recoveryCode?: string;
};

export type UpdateProfilePayload = Partial<{
  firstName: string;
  lastName: string;
  phone: string;
  timezone: string;
  locale: string;
  city: string;
  stateCode: string;
  countryCode: string;
  homeLatitude: number | null;
  homeLongitude: number | null;
}>;

export type UpdateNotificationPreferencesPayload = Partial<NotificationPreferences>;

export type ForgotPasswordPayload = {
  email: string;
};

export type ResetPasswordPayload = {
  email: string;
  token: string;
  newPassword: string;
};

export type MarketplaceServiceModel = "LOCAL" | "PROFESSIONAL" | "HYBRID";

export type MarketplaceSearchServiceModel = "LOCAL" | "PROFESSIONAL";

export type MarketplaceSort =
  | "recommended"
  | "rating"
  | "price-low"
  | "price-high"
  | "distance";

export type MarketplaceLocation = {
  id: string;
  line1: string;
  city: string;
  countyName: string | null;
  stateCode: string | null;
  postalCode: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  addressLabel: string;
  localityLabel: string;
};

export type MarketplaceCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconName: string | null;
  serviceModel: MarketplaceServiceModel;
  providerCount: number;
};

export type MarketplaceCategoryDiscovery = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconName: string | null;
  serviceModel: MarketplaceServiceModel;
  stats: {
    providerCount: number;
    featuredProviderCount: number;
    serviceCount: number;
    requestTemplateCount: number;
    startingPriceCents: number | null;
  };
  services: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    priceCents: number;
    compareAtPriceCents?: number | null;
    imageUrl: string | null;
    provider: {
      id: string;
      slug: string;
      displayName: string;
      averageRating: number;
      reviewCount: number;
      priceRangeLabel: string | null;
    };
  }>;
};

export type MarketplaceProviderCard = {
  id: string;
  slug: string;
  displayName: string;
  currencyCode?: string;
  timezone?: string;
  businessCategory: string | null;
  categorySlug: string | null;
  serviceModel: MarketplaceServiceModel;
  tagline: string | null;
  publicSummary: string | null;
  priceRangeLabel: string | null;
  averageRating: number;
  reviewCount: number;
  score: number;
  distanceMiles: number | null;
  yearsInBusiness: number | null;
  badges: {
    promoted: boolean;
    recommended: boolean;
    mobileService: boolean;
    onlineBooking: boolean;
  };
  primaryLocation: MarketplaceLocation | null;
  coverImageUrl: string | null;
  galleryPreviewUrls: string[];
  topServices: Array<{
    id: string;
    name: string;
    priceCents: number;
    compareAtPriceCents?: number | null;
    durationMinutes: number;
    label: string | null;
  }>;
  lowestPriceCents: number | null;
};

export type MarketplaceSearchResponse = {
  headline: string;
  query: {
    term: string;
    categorySlug: string | null;
    categoryName: string | null;
    serviceModel: MarketplaceSearchServiceModel;
    locationLabel: string | null;
    sort: MarketplaceSort;
    page: number;
    pageSize: number;
  };
  categories: MarketplaceCategory[];
  featuredProviders: MarketplaceProviderCard[];
  filterChips: Array<{
    label: string;
    count: number;
  }>;
  results: MarketplaceProviderCard[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  popularTreatments: Array<{
    label: string;
    href: string;
  }>;
  mapPins?: Array<{
    id: string;
    slug: string;
    displayName: string;
    latitude: number | null;
    longitude: number | null;
    addressLabel: string;
  }>;
};

export type MarketplaceProviderProfile = {
  breadcrumbs: Array<{
    label: string;
    href?: string;
  }>;
  provider: MarketplaceProviderCard & {
    description: string | null;
    websiteUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    tiktokUrl: string | null;
    businessEmail: string | null;
    businessPhone: string | null;
    bookingPolicy: string | null;
    cancellationPolicy: string | null;
    paymentPolicy: string | null;
    locations: MarketplaceLocation[];
    map: {
      latitude: number | null;
      longitude: number | null;
      addressLabel: string;
    } | null;
  };
  gallery: Array<{
    id: string;
    kind: string;
    url: string;
    altText: string | null;
    caption: string | null;
  }>;
  hours: {
    isOpenNow: boolean;
    todayLabel: string;
    week: Array<{
      weekday: number;
      dayLabel: string;
      isClosed: boolean;
      slots: Array<{
        startTime: string;
        endTime: string;
        label: string;
      }>;
    }>;
  };
  services: {
    suggested: Array<{
      id: string;
      name: string;
      description: string | null;
      bookingInstructions: string | null;
      availableChannels: string[];
      defaultChannel: string;
      intakeFields: Array<Record<string, unknown>>;
      requiredDocumentLabels: string[];
      priceCents: number;
      compareAtPriceCents: number | null;
      durationMinutes: number;
      marketplaceLabel: string | null;
      requiresApproval: boolean;
      imageUrl: string | null;
    }>;
    groups: Array<{
      id: string;
      name: string;
      services: Array<{
        id: string;
        name: string;
        description: string | null;
        bookingInstructions: string | null;
        availableChannels: string[];
        defaultChannel: string;
        intakeFields: Array<Record<string, unknown>>;
        requiredDocumentLabels: string[];
        priceCents: number;
        compareAtPriceCents: number | null;
        durationMinutes: number;
        marketplaceLabel: string | null;
        requiresApproval: boolean;
        imageUrl: string | null;
      }>;
    }>;
  };
  reviewSummary: {
    averageRating: number;
    totalReviews: number;
    ratingBreakdown: Array<{
      rating: number;
      count: number;
    }>;
    clientPhotos: Array<{
      id: string;
      url: string;
      altText: string | null;
      caption: string | null;
    }>;
    reviews: Array<{
      id: string;
      rating: number;
      title: string | null;
      content: string | null;
      reviewerName: string | null;
      createdAt: string;
      visitDate: string | null;
      isVerifiedBooking: boolean;
      serviceName: string | null;
      staffName: string | null;
      responseText: string | null;
      responseAt: string | null;
      responseByName: string | null;
      media: Array<{
        id: string;
        url: string;
        altText: string | null;
        caption: string | null;
      }>;
    }>;
  };
  popularTreatments: Array<{
    label: string;
    href: string;
  }>;
};

export type MarketplaceRequestTemplate = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string | null;
  suggestedSearchRadiusMiles: number;
  defaultBudgetMinCents: number | null;
  defaultBudgetMaxCents: number | null;
  estimatedDurationLabel: string | null;
  requiresDate: boolean;
  requiresTimeWindow: boolean;
  requiresAddress: boolean;
  allowsProviderSelection: boolean;
  intakeFields: Array<Record<string, unknown>>;
  checklistItems: string[];
  serviceModel: MarketplaceServiceModel;
  businessCategory: {
    id: string;
    slug: string;
    name: string;
    serviceModel: MarketplaceServiceModel;
  } | null;
};

export type MarketplaceBookingPageResolution = {
  providerId: string;
  slug: string;
  displayName: string;
  bookingPagePath: string;
  publicUrl: string;
  targetPath: string;
};

export type BookingMeetingRecord = {
  provider: "GOOGLE_MEET" | "ZOOM" | null;
  status: "ACTIVE" | "CANCELLED" | null;
  code: string | null;
  joinUrl: string | null;
  hostUrl: string | null;
  title: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  cancelledAt: string | null;
};

export type PublicAvailabilityStaffOption = {
  staffMemberId: string;
  displayName: string;
};

export type PublicAvailabilitySlot = {
  startAt: string;
  endAt: string;
  locationId?: string;
  staffOptions: PublicAvailabilityStaffOption[];
};

export type PublicAvailabilityResponse = {
  providerId: string;
  serviceId: string;
  date: string;
  slots: PublicAvailabilitySlot[];
};

export type PublicAvailabilityMonthDaySummary = {
  date: string;
  slotCount: number;
  firstSlotStartAt?: string;
  lastSlotStartAt?: string;
};

export type PublicAvailabilityMonthResponse = {
  providerId: string;
  serviceId: string;
  month: string;
  days: PublicAvailabilityMonthDaySummary[];
};

export type SecureDocumentRecord = {
  id: string;
  scope: "BOOKING_INTAKE" | "PROVIDER_VERIFICATION";
  label: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type CustomerBookingRecord = {
  id: string;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "CHECKED_IN"
    | "COMPLETED"
    | "CANCELLED";
  channel: "IN_PERSON" | "VIDEO" | "PHONE" | string;
  startsAt: string;
  endsAt: string;
  totalPriceCents: number;
  currencyCode?: string;
  paymentStatus?: string;
  paymentMode?: "test" | "live" | null;
  depositCents: number | null;
  notes: string | null;
  cancelledReason: string | null;
  provider: {
    id: string;
    slug: string;
    displayName: string;
  };
  service: {
    id: string;
    name: string;
    durationMinutes: number;
  };
  assignedStaff: {
    id: string;
    displayName: string | null;
    firstName: string;
    lastName: string | null;
  } | null;
  location: {
    id: string;
    name: string | null;
    line1: string;
    city: string;
    stateCode: string | null;
  } | null;
  meeting: BookingMeetingRecord;
  documents: SecureDocumentRecord[];
};

export type RescheduleCustomerBookingPayload = {
  startsAt: string;
  reason?: string;
};

export type PlatformAgentAttribution = {
  id: string;
  agentIdentityUserId: string;
  providerId: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  startsAt: string;
  attributionEndsAt: string;
  endedAt: string | null;
  endedReason: string | null;
  notes: string | null;
  createdAt: string;
  provider: {
    id: string;
    organizationId: string;
    displayName: string;
    businessEmail: string | null;
    currencyCode: string;
    serviceModel: "LOCAL" | "PROFESSIONAL" | "HYBRID";
    primaryLocation: {
      city: string;
      stateCode: string | null;
      countryCode: string;
    } | null;
  } | null;
};

export type PlatformAgentCommission = {
  id: string;
  agentIdentityUserId: string;
  attributionId: string;
  providerId: string;
  payoutRequestId: string | null;
  countryCode: string;
  currencyCode: string;
  sourceType: "SUBSCRIPTION" | "QUOTE_UNLOCK" | "MANUAL_ADJUSTMENT" | "REVERSAL";
  status: "PENDING" | "AVAILABLE" | "REQUESTED" | "PAID" | "REVERSED" | "CANCELLED";
  sourceId: string;
  grossAmountCents: number;
  commissionPercent: number;
  commissionAmountCents: number;
  note: string | null;
  availableAt: string;
  requestedAt: string | null;
  paidAt: string | null;
  reversedAt: string | null;
  createdAt: string;
  provider: {
    id: string;
    displayName: string;
    businessEmail: string | null;
    currencyCode: string;
  } | null;
};

export type PlatformAgentPayoutAccount = {
  id: string;
  processor: "STRIPE" | "PAYSTACK" | "MANUAL";
  isDefault: boolean;
  status: "PENDING_VERIFICATION" | "ACTIVE" | "DISABLED";
  countryCode: string;
  currencyCode: string;
  accountHolderName: string;
  bankName: string;
  bankCode: string | null;
  branchCode: string | null;
  accountNumberLast4: string | null;
  routingNumberLast4: string | null;
  accountReference: string | null;
  destinationLabel: string | null;
  verificationNotes: string | null;
  payoutNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformAgentPayoutRequest = {
  id: string;
  agentIdentityUserId: string;
  processor: "STRIPE" | "PAYSTACK" | "MANUAL";
  status: "REQUESTED" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";
  amountCents: number;
  currencyCode: string;
  availableBalanceSnapshotCents: number;
  pendingBalanceSnapshotCents: number;
  agentNote: string | null;
  adminNote: string | null;
  externalTransferReference: string | null;
  destinationSummary: string | null;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  payoutAccount: PlatformAgentPayoutAccount | null;
  commissions?: PlatformAgentCommission[];
};

export type PlatformPayoutBankDirectory = Array<{
  code: string;
  name: string;
  currency: string | null;
  active: boolean;
}>;

export type PlatformPayoutAccountResolution = {
  accountName: string;
  accountNumber: string;
  bankId?: number | null;
};

export type AgentDashboard = {
  summary: {
    activeProviderCount: number;
    expiringAttributionCount: number;
    pendingCommissionCents: number;
    availableCommissionCents: number;
    requestedCommissionCents: number;
    paidCommissionCents: number;
    minimumPayoutCents: number;
  };
  payoutWorkspace: {
    defaultPayoutAccountId: string | null;
    operatingCountryCode: string;
    recommendedProcessor: "STRIPE" | "PAYSTACK" | "MANUAL";
    minimumPayoutCents: number;
    account: PlatformAgentPayoutAccount | null;
    accounts: PlatformAgentPayoutAccount[];
    requests: PlatformAgentPayoutRequest[];
  };
  attributions: PlatformAgentAttribution[];
  commissions: PlatformAgentCommission[];
};

export type AgentOperationsRequestSummary = {
  id: string;
  requesterName: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
  requestedServiceName: string;
  requestedCategoryName: string | null;
  description: string;
  serviceModel: "LOCAL" | "PROFESSIONAL" | "HYBRID";
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  desiredDate: string | null;
  desiredWindowStart: string | null;
  desiredWindowEnd: string | null;
  city: string;
  countyName: string | null;
  stateCode: string | null;
  countryCode: string;
  searchRadiusMiles: number;
  status: "OPEN" | "MATCHED" | "ACCEPTED" | "CANCELLED" | "EXPIRED";
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  matchCount: number;
  unlockedMatchCount: number;
  acceptedMatchCount: number;
  declinedMatchCount: number;
  conversationCount: number;
  latestConversationAt: string | null;
  acceptedProvider: {
    id: string;
    organizationId: string | null;
    displayName: string;
    businessEmail: string | null;
    businessPhone: string | null;
    serviceModel: "LOCAL" | "PROFESSIONAL" | "HYBRID" | null;
    primaryLocation: {
      city: string;
      stateCode: string | null;
      countryCode: string;
    } | null;
  } | null;
};

export type AgentOperationsRequestDetail = AgentOperationsRequestSummary & {
  requesterUserId: string | null;
  customerId: string | null;
  requestedChannels: string[];
  intakeResponses: Record<string, unknown> | Array<Record<string, unknown>> | null;
  requestedDocumentLabels: string[];
  line1: string | null;
  line2: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  matches: Array<{
    id: string;
    providerId: string;
    status: "AVAILABLE" | "UNLOCKED" | "DECLINED" | "ACCEPTED" | "EXPIRED";
    score: number;
    distanceMiles: number | null;
    unlockPriceCents: number;
    unlockedAt: string | null;
    acceptedAt: string | null;
    declinedAt: string | null;
    createdAt: string;
    updatedAt: string;
    provider: AgentOperationsRequestSummary["acceptedProvider"];
    matchedService: {
      id: string;
      name: string;
      priceCents: number | null;
      durationMinutes: number | null;
    } | null;
    matchedLocation: {
      id: string;
      line1: string;
      city: string;
      stateCode: string | null;
      countryCode: string;
    } | null;
    payment: {
      id: string;
      amountCents: number;
      currencyCode: string;
      fundingSource: string;
      status: string;
      paidAt: string | null;
      createdAt: string;
    } | null;
    conversation: {
      id: string;
      status: "OPEN" | "CLOSED" | "ARCHIVED";
      unlockedAt: string | null;
      customerAcceptedAt: string | null;
      updatedAt: string;
      lastMessageAt: string | null;
      messageCount: number;
      messages: Array<{
        id: string;
        senderRole: "REQUESTER" | "PROVIDER" | "PLATFORM";
        senderName: string;
        senderEmail: string | null;
        senderPhone: string | null;
        content: string;
        createdAt: string;
      }>;
    } | null;
  }>;
  conversations: Array<{
    id: string;
    quoteMatchId: string;
    providerId: string;
    status: "OPEN" | "CLOSED" | "ARCHIVED";
    unlockedAt: string | null;
    customerAcceptedAt: string | null;
    updatedAt: string;
    lastMessageAt: string | null;
    provider: {
      id: string;
      displayName: string;
      businessEmail: string | null;
      businessPhone: string | null;
    } | null;
    quoteMatch: {
      id: string;
      status: "AVAILABLE" | "UNLOCKED" | "DECLINED" | "ACCEPTED" | "EXPIRED";
      score: number;
      distanceMiles: number | null;
    } | null;
    messageCount: number;
    lastMessage: {
      id: string;
      senderRole: "REQUESTER" | "PROVIDER" | "PLATFORM";
      senderName: string;
      content: string;
      createdAt: string;
    } | null;
  }>;
};

export type AgentOperationsQueueResponse = {
  summary: {
    total: number;
    openCount: number;
    matchedCount: number;
    acceptedCount: number;
    cancelledCount: number;
    expiredCount: number;
  };
  items: AgentOperationsRequestSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ProviderBookmarkState = {
  providerId: string;
  isBookmarked: boolean;
};

export type CustomerQuoteMessage = {
  id: string;
  senderRole: "REQUESTER" | "PROVIDER" | "PLATFORM";
  senderName: string;
  senderEmail: string | null;
  senderPhone: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerQuoteConversation = {
  id: string;
  quoteRequestId: string;
  quoteMatchId: string;
  providerId: string;
  requesterName: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  unlockedAt: string | null;
  customerAcceptedAt: string | null;
  updatedAt: string;
  provider?: {
    id: string;
    displayName: string;
    businessEmail: string | null;
    businessPhone: string | null;
  };
  quoteMatch?: {
    id: string;
    score: number;
    distanceMiles: number | null;
    status: "AVAILABLE" | "UNLOCKED" | "DECLINED" | "ACCEPTED" | "EXPIRED";
  } | null;
  messages: CustomerQuoteMessage[];
};

export type CustomerQuoteRequest = {
  id: string;
  requesterUserId: string | null;
  requesterName: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
  requestedServiceName: string;
  requestedCategoryName: string | null;
  description: string;
  serviceModel: "LOCAL" | "PROFESSIONAL" | "HYBRID";
  requestedChannels?: string[];
  intakeResponses?: Array<Record<string, unknown>> | null;
  requestedDocumentLabels?: string[];
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  desiredDate: string | null;
  desiredWindowStart: string | null;
  desiredWindowEnd: string | null;
  line1?: string | null;
  line2?: string | null;
  city: string;
  stateCode: string | null;
  postalCode?: string | null;
  countryCode?: string;
  searchRadiusMiles?: number;
  status: "OPEN" | "MATCHED" | "ACCEPTED" | "CANCELLED" | "EXPIRED";
  acceptedProviderId?: string | null;
  acceptedQuoteMatchId?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  matches: Array<{
    id: string;
    providerId: string;
    quoteRequestId?: string;
    score: number;
    distanceMiles: number | null;
    status: "AVAILABLE" | "UNLOCKED" | "DECLINED" | "ACCEPTED" | "EXPIRED";
    unlockPriceCents: number;
    acceptedAt?: string | null;
    provider: {
      id: string;
      displayName: string;
      businessEmail: string | null;
      businessPhone: string | null;
      slug?: string;
      averageRating?: number;
      reviewCount?: number;
      businessCategory?: string | null;
    };
    matchedService?: {
      id: string;
      name: string;
      priceCents: number | null;
      durationMinutes: number | null;
    } | null;
    matchedLocation?: {
      id: string;
      city: string;
      stateCode: string | null;
      countryCode: string;
      line1?: string;
    } | null;
    payment?: {
      id: string;
      amountCents: number;
      currencyCode: string;
      status: string;
      paidAt: string | null;
    } | null;
    conversation?: CustomerQuoteConversation | null;
  }>;
  conversations: CustomerQuoteConversation[];
};

export type CreateServiceRequestPayload = {
  customerId?: string;
  requesterUserId?: string;
  requesterName: string;
  requesterEmail?: string;
  requesterPhone?: string;
  requestedServiceName: string;
  requestedCategoryName?: string;
  description: string;
  serviceModel?: "LOCAL" | "PROFESSIONAL" | "HYBRID";
  requestedChannels?: string[];
  intakeResponses?: Array<Record<string, unknown>>;
  requestedDocumentLabels?: string[];
  budgetMinCents?: number;
  budgetMaxCents?: number;
  desiredDate?: string;
  desiredWindowStart?: string;
  desiredWindowEnd?: string;
  line1?: string;
  line2?: string;
  city: string;
  countyName?: string;
  stateCode?: string;
  postalCode?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  searchRadiusMiles?: number;
  notificationStrategy?: "AUTO_NOTIFY_ALL" | "HOLD_FOR_SELECTION";
};

export type CreateServiceRequestResult = {
  quoteRequestId: string;
  matchCount: number;
  notificationStrategy: "AUTO_NOTIFY_ALL" | "HOLD_FOR_SELECTION";
  topMatches: CustomerQuoteRequest["matches"];
};

export type InboxNotification = {
  id: string;
  eventKey: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

export type InboxResponse = {
  unreadCount: number;
  items: InboxNotification[];
};

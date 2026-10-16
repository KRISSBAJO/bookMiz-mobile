export type SessionRole = "CUSTOMER" | "AGENT";

export type PersonaMode = "customer" | "agent";

export type BookMizUser = {
  id: string;
  email: string;
  userType: string;
  firstName: string;
  lastName: string;
  city?: string | null;
  stateCode?: string | null;
  roles: SessionRole[];
};

export type BookMizSession = {
  user: BookMizUser | null;
  activePersona: PersonaMode;
  isSignedIn: boolean;
};

export type InboxNotification = {
  id: string;
  eventKey: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export type ProviderPreview = {
  id: string;
  displayName: string;
  category: string;
  city: string;
  rating: number;
  reviewCount: number;
  priceLabel: string;
  responseLabel: string;
};

export type QuoteRequestPreview = {
  id: string;
  title: string;
  status: "OPEN" | "MATCHING" | "RESPONDED" | "BOOKED";
  providerName?: string;
  nextStep: string;
};

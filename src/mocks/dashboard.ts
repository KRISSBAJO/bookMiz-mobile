import type { ImageSourcePropType } from "react-native";

import type {
  InboxNotification,
  ProviderPreview,
  QuoteRequestPreview,
} from "@/src/types/mobile";

export type ServiceHighlight = {
  id: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  image: ImageSourcePropType;
};

export type QuickAction = {
  id: string;
  title: string;
  caption: string;
  icon: "sparkles" | "location" | "comments" | "briefcase";
};

export type AgentTask = {
  id: string;
  client: string;
  service: string;
  dueLabel: string;
  status: "Hot" | "Follow up" | "Booked";
};

export const serviceHighlights: ServiceHighlight[] = [
  {
    id: "beauty",
    title: "Soft glam finish",
    subtitle: "Beauty rituals and nail care that feel premium from the first tap.",
    actionLabel: "View beauty",
    image: require("../../assets/bookmiz/manicure.png"),
  },
  {
    id: "barber",
    title: "Precision barbering",
    subtitle: "Sharp grooming, flexible booking windows, and trusted local pros.",
    actionLabel: "Find barbers",
    image: require("../../assets/bookmiz/barber.png"),
  },
  {
    id: "wellness",
    title: "Recovery and care",
    subtitle: "Health and wellness services you can compare with confidence.",
    actionLabel: "Browse wellness",
    image: require("../../assets/bookmiz/hospital.png"),
  },
];

export const quickActions: QuickAction[] = [
  {
    id: "quote",
    title: "Request a quote",
    caption: "Tell BookMiz what you need and get matched fast.",
    icon: "sparkles",
  },
  {
    id: "nearby",
    title: "Use my location",
    caption: "Pull providers closest to your current area.",
    icon: "location",
  },
  {
    id: "messages",
    title: "Open inbox",
    caption: "Read quote replies and appointment updates.",
    icon: "comments",
  },
  {
    id: "agent",
    title: "Switch to agent",
    caption: "Manage referrals and follow-ups in one flow.",
    icon: "briefcase",
  },
];

export const featuredProviders: ProviderPreview[] = [
  {
    id: "prov-1",
    displayName: "Glow Ritual Studio",
    category: "Beauty",
    city: "Chicago",
    rating: 4.9,
    reviewCount: 218,
    priceLabel: "From $45",
    responseLabel: "Replies in 8 min",
  },
  {
    id: "prov-2",
    displayName: "North Side Fade House",
    category: "Barbering",
    city: "Chicago",
    rating: 4.8,
    reviewCount: 163,
    priceLabel: "From $30",
    responseLabel: "Replies in 12 min",
  },
  {
    id: "prov-3",
    displayName: "CarePoint Wellness",
    category: "Wellness",
    city: "Evanston",
    rating: 4.7,
    reviewCount: 141,
    priceLabel: "From $65",
    responseLabel: "Same-day support",
  },
];

export const quoteRequests: QuoteRequestPreview[] = [
  {
    id: "req-1",
    title: "Gel manicure before Friday",
    status: "RESPONDED",
    providerName: "Glow Ritual Studio",
    nextStep: "Compare two replies and confirm your appointment window.",
  },
  {
    id: "req-2",
    title: "Haircut and beard trim",
    status: "MATCHING",
    nextStep: "BookMiz is still matching providers near River North.",
  },
];

export const inboxNotifications: InboxNotification[] = [
  {
    id: "notif-1",
    eventKey: "QUOTE_REPLY",
    title: "Quote reply from Glow Ritual Studio",
    body: "Your Tuesday evening slot is available. Tap to confirm.",
    actionUrl: "/inbox",
    readAt: null,
    createdAt: "5 min ago",
  },
  {
    id: "notif-2",
    eventKey: "BOOKING_UPDATE",
    title: "Appointment reminder",
    body: "Precision barbering session tomorrow at 10:30 AM.",
    actionUrl: "/inbox",
    readAt: "today",
    createdAt: "1 hr ago",
  },
  {
    id: "notif-3",
    eventKey: "AGENT_LEAD",
    title: "New lead assigned",
    body: "A wellness request near Gold Coast is ready for follow-up.",
    actionUrl: "/workbench",
    readAt: null,
    createdAt: "2 hr ago",
  },
];

export const agentTasks: AgentTask[] = [
  {
    id: "task-1",
    client: "Naomi Clarke",
    service: "Wedding guest makeup",
    dueLabel: "Call in 20 min",
    status: "Hot",
  },
  {
    id: "task-2",
    client: "Jordan Miles",
    service: "Barber package follow-up",
    dueLabel: "Send quote recap",
    status: "Follow up",
  },
  {
    id: "task-3",
    client: "Ari Benson",
    service: "Massage booking",
    dueLabel: "Confirmed for tomorrow",
    status: "Booked",
  },
];

import { requestJson } from './client';
import { mobileEnv } from '../mobile-env';
import type { CustomerQuoteMessage } from './types';

export type Workspace = { id: string; organizationId: string; slug: string; displayName: string; timezone: string; currencyCode: string; deliveryModes: string[] };
export type MerchantBooking = { id: string; serviceId: string; serviceName: string; customerName: string; customerId: string; customerEmail: string | null; customerPhone: string | null; startsAt: string; endsAt: string; status: string; paymentStatus: string; totalPriceCents: number; currencyCode: string; staffName: string | null; assignedStaffId: string | null; locationName: string | null; locationId: string | null; channel: string; notes: string | null; internalNotes: string | null };
export type MerchantService = { id: string; name: string; description: string | null; priceCents: number; currencyCode: string; durationMinutes: number; isActive: boolean; requiresApproval: boolean; imageUrl: string | null; defaultChannel: string; availableChannels: string[]; bufferBeforeMinutes: number; bufferAfterMinutes: number; bookingInstructions: string | null };
export type ServiceCategory = { id: string; name: string; services: MerchantService[] };
export type Rule = { id: string; weekday: number | null; date: string | null; type: string; startTime: string; endTime: string; isBookable: boolean; staffMemberId: string | null; staffName: string | null; locationId: string | null; locationName: string | null; serviceId: string | null; slotCapacity: number };
export type Staff = { id: string; displayName: string; status: string; isBookable: boolean };
export type Location = { id: string; name: string };
export type MerchantSettings = { workspace: Workspace; staffMembers: Staff[]; locations: Location[]; workingHours: Rule[]; timeOffs: { id: string; title: string; startsAt: string; endsAt: string; staffName: string; staffMemberId: string }[] };
export type MerchantRequest = { id: string; status: string; unlockPriceCents: number; unlockCurrencyCode?: string | null; matchedService: { id: string; name: string; priceCents: number; currencyCode: string } | null; request: { id: string; requesterName: string; requestedServiceName: string; description: string; desiredDate: string | null; city: string; stateCode: string | null; currencyCode: string; budgetMinCents: number | null; budgetMaxCents: number | null }; conversation: { id: string; status: string; updatedAt: string; lastMessage: { content: string; createdAt: string; senderRole?: string } | null } | null };
export type MerchantConversation = { id: string; status: string; quoteRequest: { requesterName: string; requestedServiceName: string }; quoteMatch: { id: string; status: string }; messages: CustomerQuoteMessage[] };
export type Slot = { startAt: string; endAt: string; locationId?: string; staffMemberId?: string; staffOptions?: { staffMemberId: string; displayName: string }[] };
export type Dashboard = { workspace: Workspace; calendar: { bookings: MerchantBooking[] }; stats: { openRequests: number }; staffMembers: Staff[]; locations: Location[]; services: MerchantService[] };
export function businessRequest<T>(path: string, organizationId: string, method = 'GET', body?: unknown) {
  if (!organizationId) throw new Error('Select a business first.');
  const query = new URLSearchParams({ organizationId });
  const separator = path.includes('?') ? '&' : '?';
  return requestJson<T>(`${mobileEnv.bookingApiUrl}/provider-workspace/${path}${separator}${query}`, { auth: true, method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body as object, ...(method === 'POST' || !path.startsWith('bookings/') ? { organizationId } : {}) }) } : {}) });
}
export const getMerchantBootstrap = (org: string) => businessRequest<{ workspace: Workspace; stats: { activeServices: number; activeStaff: number; openRequests: number } }>('bootstrap', org);
export async function getMerchantCover(org: string, slug: string) {
  const [profile, settings] = await Promise.allSettled([
    requestJson<{ provider: { coverImageUrl?: string | null } }>(`${mobileEnv.bookingApiUrl}/marketplace/providers/${encodeURIComponent(slug)}`, { method: 'GET' }),
    businessRequest<{ bookingPage?: { bannerUrl?: string | null } }>('settings', org),
  ]);
  return { url: (profile.status === 'fulfilled' ? profile.value.provider.coverImageUrl : null)
    || (settings.status === 'fulfilled' ? settings.value.bookingPage?.bannerUrl : null) || null };
}
export const getMerchantSettings = (org: string) => businessRequest<MerchantSettings>('settings', org);
export const getMerchantServices = (org: string) => businessRequest<{ workspace: Workspace; categories: ServiceCategory[] }>('services', org);
export const getMerchantRequests = (org: string) => businessRequest<{ workspace: Workspace; requests: MerchantRequest[] }>('requests', org);
export const getMerchantBookings = (org: string, startDate: string, endDate: string) => businessRequest<{ bookings: MerchantBooking[] }>(`bookings?${new URLSearchParams({ startDate, endDate })}`, org);
export const getMerchantSlots = (org: string, params: Record<string, string>) => businessRequest<{ slots: Slot[] }>(`bookings/availability?${new URLSearchParams(params)}`, org);
export function merchantMatch<T>(matchId: string, action: string, method = 'GET', body?: unknown) {
  return requestJson<T>(`${mobileEnv.bookingApiUrl}/marketplace/quote-matches/${encodeURIComponent(matchId)}/${action}`, { method, auth: true, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
}
export const getMerchantConversation = (matchId: string) => merchantMatch<MerchantConversation>(matchId, 'conversation');
export const sendMerchantMessage = (matchId: string, content: string) => merchantMatch<MerchantConversation>(matchId, 'conversation/messages', 'POST', { content });

import { businessRequest } from './business';
export type PayoutAccount = { id: string; currencyCode: string; processor: string; status: string; bankName: string; accountHolderName: string; accountNumberLast4: string; isDefault: boolean; destinationLabel: string | null; bankCode: string | null };
export type Payout = { id: string; processorMode: string | null; amountCents: number; currencyCode: string; status: string; destinationSummary: string; requestedAt: string; adminNote: string | null };
export type MoneyOverview = {
  business: { id: string; displayName: string; currencyCode: string };
  paymentSettings: { acceptBookingPagePayments: boolean; requirePaymentUpfront: boolean };
  bookingTotals: { currencyCode: string; paymentStatus: string; bookingCount: number; bookedAmountCents: number }[];
  paystack: { summary: { availableBalanceCents: number; pendingBalanceCents: number; requestedBalanceCents: number; paidOutBalanceCents: number; minimumProviderPayoutCents: number; operatingCurrencyCode: string; payoutHoldDays: number }; rails: { paystack: { configured: boolean; mode: string; payoutsEnabled: boolean; blockedReason: string | null } }; accounts: PayoutAccount[]; requests: Payout[]; defaultPayoutAccountId: string | null };
  stripe: { available: boolean; reason?: string; account?: { connected: boolean; mode: string; chargesEnabled?: boolean; payoutsEnabled?: boolean }; balance?: { currency: string; availableAmountCents: number; withdrawableAmountCents: number; pendingServiceAmountCents: number; mode: string } | null; payouts?: { id: string; amountCents: number; currency: string; status: string; createdAt: string }[] };
  generatedAt: string;
};
export type MoneyBooking = { id: string; startsAt: string; status: string; paymentStatus: string; totalPriceCents: number; currencyCode: string; paymentMethod: string | null; stripeRefundedAmountCents: number; paystackRefundStatus: string | null; service: { name: string }; customer: { firstName: string; lastName: string | null } };
export type MoneyBookingDetail = MoneyBooking & { stripeLivemode: boolean | null; paymentCaptureStatus: string | null; depositCents: number | null; cancelledReason: string | null; paymentTransactions: { id: string; reference: string; amountCents: number; currencyCode: string; status: string; processorMode: string | null; refundStatus: string | null; refundAmountCents: number | null; refundRequestedAt: string | null; refundedAt: string | null }[] };
export type PayoutCommand = { requestId: string; amountCents: number; currencyCode: string; payoutAccountId?: string; providerNote?: string };
export const getMoney = (org: string) => businessRequest<MoneyOverview>('money', org);
export const getMoneyActivity = (org: string, cursor?: string) => businessRequest<{ items: MoneyBooking[]; nextCursor: string | null }>(`money/activity?limit=25${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, org);
export const getMoneyBooking = (org: string, id: string) => businessRequest<MoneyBookingDetail>(`money/bookings/${encodeURIComponent(id)}`, org);
export const requestMerchantPayout = (org: string, rail: 'stripe' | 'paystack', payload: PayoutCommand) => businessRequest(`money/payouts/${rail}`, org, 'POST', payload);

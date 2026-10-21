import { requestJson, getAuthTokens } from './client';
import { mobileEnv } from '../mobile-env';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
export type FinancialDocument = { id: string; number: string; kind: 'INVOICE' | 'RECEIPT'; amountCents: number; currencyCode: string; processorMode: string; createdAt: string };
export type BillingItem = { bookingId: string; businessName: string; customerName: string; serviceName: string; startsAt: string; bookingStatus: string; paymentStatus: string; currencyCode: string; originalAmountCents: number; paidCents: number; refundedCents: number; amountDueCents: number | null; issues: string[]; documents: FinancialDocument[]; payments: { id: string; method: string; reference: string; amountCents: number; currencyCode: string; processorMode: string; refundStatus: string | null; refundedCents: number }[] };
const base = `${mobileEnv.bookingApiUrl}/billing`;
export const billingQuery = (org?: string) => org ? `?organizationId=${encodeURIComponent(org)}` : '';
export const billingHistory = (org?: string, cursor?: string) => requestJson<{ items: BillingItem[]; nextCursor: string | null }>(`${base}/history${billingQuery(org)}${cursor ? `${org ? '&' : '?'}cursor=${encodeURIComponent(cursor)}` : ''}`, { auth: true });
export const issueBillingDocument = (bookingId: string, kind: 'invoice' | 'receipts', organizationId?: string) => requestJson(`${base}/bookings/${bookingId}/${kind}`, { auth: true, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId }) });
export async function shareBillingDocument(bookingId: string, document: FinancialDocument, org?: string) {
  await requestJson(`${base}/bookings/${bookingId}${billingQuery(org)}`, { auth: true });
  const token = getAuthTokens()?.accessToken;
  if (!token) throw new Error('Sign in again to open this document.');
  if (!await Sharing.isAvailableAsync()) throw new Error('PDF sharing is not available on this device.');
  const target = new File(Paths.cache, `bookmiz-${document.number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`);
  try { await File.downloadFileAsync(`${base}/documents/${document.id}/pdf${billingQuery(org)}`, target, { headers: { Authorization: `Bearer ${token}` }, idempotent: true }); await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' }); }
  finally { if (target.exists) target.delete(); }
}

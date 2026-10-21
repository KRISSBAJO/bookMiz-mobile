import type { MerchantRequest } from './api/business';
import { businessDate, formatBusinessMoney } from './business-policy';

export function conversationIsOpen(row: MerchantRequest) {
  return !!row.conversation && row.conversation.status === 'OPEN' && !['DECLINED', 'EXPIRED'].includes(row.status);
}
function timestamp(value?: string | null) { const result = Date.parse(value ?? ''); return Number.isFinite(result) ? result : 0; }
export function conversationActivity(row: MerchantRequest) {
  return timestamp(row.conversation?.lastMessage?.createdAt) || timestamp(row.conversation?.updatedAt);
}
export function recentConversations(rows: MerchantRequest[]) {
  return rows.filter(row => row.conversation).sort((a, b) => conversationActivity(b) - conversationActivity(a) || a.id.localeCompare(b.id));
}
export function conversationTime(row: MerchantRequest, timezone: string, now = new Date()) {
  const activity = conversationActivity(row);
  if (!activity) return '';
  return new Date(activity).toLocaleString(undefined, businessDate(new Date(activity), timezone) === businessDate(now, timezone)
    ? { timeZone: timezone, hour: 'numeric', minute: '2-digit' }
    : { timeZone: timezone, month: 'short', day: 'numeric', ...(new Date(activity).getUTCFullYear() !== now.getUTCFullYear() ? { year: 'numeric' } : {}) });
}
export function requestBudget(row: MerchantRequest) {
  const { budgetMinCents: min, budgetMaxCents: max, currencyCode } = row.request;
  if (min === null && max === null) return 'Budget not specified';
  if (min !== null && max !== null && min === max) return formatBusinessMoney(min, currencyCode);
  if (min !== null && max !== null) return `${formatBusinessMoney(min, currencyCode)} - ${formatBusinessMoney(max, currencyCode)}`;
  return min !== null ? `From ${formatBusinessMoney(min, currencyCode)}` : `Up to ${formatBusinessMoney(max!, currencyCode)}`;
}

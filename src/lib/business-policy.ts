export const businessRoles = ['ORG_ADMIN', 'SERVICE_PROVIDER', 'STAFF_MANAGER', 'STAFF'] as const;
export type BusinessMembership = { id: string; displayName: string; slug: string; role: string };
export function availableBusinesses(userType: string | undefined, organizations: BusinessMembership[]) {
  return userType === 'CUSTOMER' ? [] : organizations.filter(item => businessRoles.some(role => role === item.role));
}
export function canManageBusiness(role?: string) {
  return ['ORG_ADMIN', 'SERVICE_PROVIDER', 'STAFF_MANAGER'].includes(role ?? '');
}
export function canManageBusinessMoney(role?: string) {
  return ['ORG_ADMIN', 'SERVICE_PROVIDER'].includes(role ?? '');
}
export function payoutAmount(value: string, available: number, minimum = 1) {
  const cents = moneyInput(value);
  if (cents < minimum) throw new Error('The amount is below the minimum payout.');
  if (cents > 2147483647 || cents > available) throw new Error('The amount exceeds your available balance.');
  return cents;
}
// Correlation reference only; authentication remains the server's responsibility.
export function payoutReference() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}
export function moneyInput(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter a price with up to two decimal places.');
  const [whole, fraction = ''] = value.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new Error('This price is too large.');
  return cents;
}
export function businessDate(value: string | Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
export function shiftBusinessDate(day: string, offset: number) {
  const date = new Date(day + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function bookingActions(status: string) {
  switch (status) {
    case 'PENDING': return ['CONFIRMED', 'CANCELLED'];
    case 'CONFIRMED': return ['CHECKED_IN', 'NO_SHOW', 'CANCELLED'];
    case 'CHECKED_IN': return ['COMPLETED'];
    default: return [];
  }
}
export function formatBusinessMoney(cents: number, currency: string) {
  try {
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code' });
    if (!Number.isSafeInteger(cents) || formatter.resolvedOptions().maximumFractionDigits !== 2) return `${currency} amount requires review`;
    return formatter.format(cents / 100);
  } catch { return 'Amount requires review'; }
}
export function validateHours(start: string, end: string) {
  const valid = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  if (!valid(start) || !(valid(end) || end === '24:00') || start >= end) throw new Error('Use valid opening and closing times, with closing after opening.');
}
export function businessDateTimeToIso(day: string, time: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Use a valid date and time.');
  const target = Date.parse(`${day}T${time}:00Z`);
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 10) !== day) throw new Error('Use a valid calendar date.');
  const parts = (stamp: number) => {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(stamp));
    const v = (key: string) => p.find(i => i.type === key)!.value;
    return Date.parse(`${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}:00Z`);
  };
  let result = target;
  for (let i = 0; i < 4; i++) result += target - parts(result);
  if (parts(result) !== target) throw new Error('This time does not exist because the clocks change. Choose another time.');
  return new Date(result).toISOString();
}

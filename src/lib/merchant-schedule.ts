import type { MerchantBooking } from './api/business';
import { businessDate } from './business-policy';

export function businessMinute(value: string | Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  return Number(parts.find(p => p.type === 'hour')!.value) * 60 + Number(parts.find(p => p.type === 'minute')!.value);
}
export function scheduleLayout(bookings: MerchantBooking[], day: string, timezone: string) {
  const items = bookings.filter(b => Number.isFinite(Date.parse(b.startsAt)) && Number.isFinite(Date.parse(b.endsAt)) && Date.parse(b.endsAt) > Date.parse(b.startsAt))
    .filter(b => businessDate(b.startsAt, timezone) <= day && businessDate(b.endsAt, timezone) >= day)
    .map(booking => {
      const start = businessDate(booking.startsAt, timezone) < day ? 0 : businessMinute(booking.startsAt, timezone);
      const end = businessDate(booking.endsAt, timezone) > day ? 1440 : businessMinute(booking.endsAt, timezone);
      if (end === 0 && businessDate(booking.startsAt, timezone) < day) return null;
      // During a repeated DST hour the wall clock may go backwards. Keep a visible,
      // tappable block; exact offset-aware times remain in the appointment details.
      return { booking, start, end: Math.min(1440, Math.max(start + 30, end)), column: 0, columns: 1 };
    }).filter((b): b is NonNullable<typeof b> => !!b && b.start < b.end)
    .sort((a, b) => a.start - b.start || a.end - b.end || a.booking.id.localeCompare(b.booking.id));
  let group: typeof items = [], groupEnd = -1;
  function finish() {
    const ends: number[] = [];
    for (const item of group) {
      let column = ends.findIndex(end => end <= item.start);
      if (column < 0) column = ends.length;
      item.column = column; ends[column] = Math.max(item.end, item.start + 30);
    }
    for (const item of group) item.columns = ends.length;
    group = [];
  }
  for (const item of items) {
    if (item.start >= groupEnd) { finish(); groupEnd = -1; }
    group.push(item); groupEnd = Math.max(groupEnd, item.end, item.start + 30);
  }
  finish();
  const startHour = Math.min(8, ...items.map(b => Math.floor(b.start / 60)));
  const endHour = Math.min(24, Math.max(20, ...items.map(b => Math.ceil(Math.max(b.end, b.start + 30) / 60))));
  return { items, startHour, endHour };
}

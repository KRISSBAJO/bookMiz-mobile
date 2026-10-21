import type { MerchantBooking } from './api/business';
const active = new Set(['PENDING', 'CONFIRMED', 'CHECKED_IN']);
/** Appointment counts only. Never replace a booking's original amount or currency. */
export function merchantDay(bookings: MerchantBooking[], now: Date) {
  const timeline = [...bookings].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
  const remaining = timeline.filter(b => active.has(b.status));
  return { timeline, remaining, next: remaining.find(b => Date.parse(b.endsAt) > now.getTime()),
    completed: timeline.filter(b => b.status === 'COMPLETED').length,
    pending: remaining.filter(b => b.status === 'PENDING'), unassigned: remaining.filter(b => !b.assignedStaffId),
    overdue: remaining.filter(b => Date.parse(b.endsAt) <= now.getTime()) };
}
export function businessInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'BM';
}

/** Calendar dates must keep the day selected on the device, regardless of UTC offset. */
export function localRequestDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function requestScheduleError(
  date: string,
  start: string,
  end: string,
  now = new Date(),
): string | null {
  if (date) {
    const parsed = new Date(`${date}T12:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || localRequestDate(parsed) !== date) {
      return 'Choose a valid date for your request.';
    }
    if (date < localRequestDate(now)) return 'Choose today or a future date.';
  }
  if (start || end) {
    if (!start || !end) return 'Choose both an earliest and a latest time, or clear both for any time.';
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(start) || !time.test(end)) return 'Choose valid earliest and latest times.';
    if (end <= start) return 'Latest time must be after earliest time on the same day. Check AM and PM.';
  }
  return null;
}

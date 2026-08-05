export const TZ = "America/Chicago";

/** Date-only helpers. Dates are handled as YYYY-MM-DD strings to avoid timezone drift. */

export function todayISO(tz: string = TZ): string {
  return isoInTimeZone(new Date(), tz);
}

export function isoInTimeZone(date: Date, tz: string = TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts;
}

export function hourInTimeZone(date: Date, tz: string = TZ): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  }).format(date);
  return Number(hour) % 24;
}

/** Anchors a date-only string at UTC noon so arithmetic never crosses a day boundary. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function daysBetween(fromISO: string, toISOStr: string): number {
  const a = parseISO(fromISO).getTime();
  const b = parseISO(toISOStr).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** 0 = Sunday ... 6 = Saturday */
export function dayOfWeek(iso: string): number {
  return parseISO(iso).getUTCDay();
}

/** Monday-based week start. */
export function startOfWeek(iso: string): string {
  const dow = dayOfWeek(iso);
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(iso, -back);
}

export function monthOf(iso: string): number {
  return Number(iso.slice(5, 7));
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function weekdayShort(iso: string): string {
  return WEEKDAY_SHORT[dayOfWeek(iso)];
}

export function formatShort(iso: string): string {
  const d = parseISO(iso);
  return `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function formatLong(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAY_SHORT[d.getUTCDay()]}, ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatRange(startISOStr: string, endISOStr: string): string {
  return `${formatShort(startISOStr)} – ${formatShort(endISOStr)}`;
}

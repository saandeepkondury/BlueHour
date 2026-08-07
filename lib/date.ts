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

/**
 * Instant when `dateISO` at `hour:minute` occurs in `tz`. Used to drop
 * already-passed local notification slots before handing them to iOS.
 */
export function wallTimeInZone(
  dateISO: string,
  hour: number,
  minute = 0,
  tz: string = TZ,
): Date {
  const [year, month, day] = dateISO.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const partsOf = (ms: number) => {
    const map: Record<string, string> = {};
    for (const part of dtf.formatToParts(new Date(ms))) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
    return map;
  };

  const zoned = partsOf(utcGuess);
  const zonedAsUtc = Date.UTC(
    Number(zoned.year),
    Number(zoned.month) - 1,
    Number(zoned.day),
    Number(zoned.hour) % 24,
    Number(zoned.minute),
    Number(zoned.second),
  );
  return new Date(utcGuess - (zonedAsUtc - utcGuess));
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

/** Month day + year — for historic lists that can span years. */
export function formatWithYear(iso: string): string {
  const d = parseISO(iso);
  return `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatLong(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAY_SHORT[d.getUTCDay()]}, ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatRange(startISOStr: string, endISOStr: string): string {
  return `${formatShort(startISOStr)} – ${formatShort(endISOStr)}`;
}

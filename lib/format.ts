export function formatMiles(value: number): string {
  if (value === 0) return "0";
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatPace(seconds: number | null | undefined, miles: number): string {
  if (!seconds || seconds <= 0 || miles <= 0) return "—";
  return `${formatPacePerMi(seconds / miles)} /mi`;
}

/** Format a pace already expressed as seconds per mile. */
export function formatPacePerMi(secPerMi: number): string {
  const perMile = Math.round(secPerMi);
  const mins = Math.floor(perMile / 60);
  const secs = perMile % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/** Minimum distance / duration before a run can set personal-best pace. */
const PB_MIN_MI = 1;
const PB_MIN_SEC = 60;

export type PersonalBestPace = {
  date: string;
  distanceMi: number;
  durationSec: number;
  paceSecPerMi: number;
};

/**
 * Fastest pace across historical workout logs (lowest sec/mi).
 * Uses every timed run of at least a mile so short jogs do not steal the mark.
 */
export function personalBestPace(
  logs: Array<{ date: string; distanceMi: number; durationSec: number | null }>,
): PersonalBestPace | null {
  let best: PersonalBestPace | null = null;

  for (const log of logs) {
    const distanceMi = log.distanceMi ?? 0;
    const durationSec = log.durationSec ?? 0;
    if (distanceMi < PB_MIN_MI || durationSec < PB_MIN_SEC) continue;

    const paceSecPerMi = durationSec / distanceMi;
    if (!best || paceSecPerMi < best.paceSecPerMi) {
      best = {
        date: log.date,
        distanceMi,
        durationSec,
        paceSecPerMi,
      };
    }
  }

  return best;
}

export function kgToLb(kg: number | null): number | null {
  return kg === null ? null : Math.round(kg * 2.20462);
}

export function cmToIn(cm: number | null): number | null {
  return cm === null ? null : Math.round(cm / 2.54);
}

export function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}

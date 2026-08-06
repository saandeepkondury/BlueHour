import { and, desc, eq, gte, isNotNull, lt, lte } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { healthDays, healthSync, workoutLogs, type HealthDay, type WorkoutLog } from "@/drizzle/schema";
import { addDays, todayISO } from "@/lib/date";

export interface Recovery {
  day: HealthDay | null;
  /** Calendar date the displayed vitals belong to (may lag today). */
  vitalsDate: string | null;
  /** Median resting HR over the prior two weeks, once there is enough history. */
  baselineRestingHr: number | null;
  baselineHrvMs: number | null;
  /** Soft nudge only — the plan never changes itself from these numbers. */
  advisory: string | null;
  /** 0–100, or null until there is something to score. */
  score: number | null;
  label: "ready" | "steady" | "hold back" | null;
  /** Last successful Health sync, if any. */
  lastSyncAt: string | null;
}

const SHORT_SLEEP_MIN = 6 * 60;
const RHR_ELEVATED_BPM = 5;
const BASELINE_MIN_SAMPLES = 4;
/** How far back Today may reach for sleep / rest HR when this morning is empty. */
const VITALS_FALLBACK_DAYS = 3;

export function hasVitals(day: HealthDay | null | undefined): boolean {
  if (!day) return false;
  return day.asleepMin !== null || day.restingHr !== null || day.hrvMs !== null;
}

export async function recoveryFor(date: string): Promise<Recovery> {
  await ready();

  const [todayRow] = await db.select().from(healthDays).where(eq(healthDays.date, date));
  const history = await db
    .select()
    .from(healthDays)
    .where(and(gte(healthDays.date, addDays(date, -14)), lt(healthDays.date, date)));

  const restingSamples = history
    .map((row) => row.restingHr)
    .filter((value): value is number => value !== null);

  const baselineRestingHr =
    restingSamples.length >= BASELINE_MIN_SAMPLES ? median(restingSamples) : null;

  const hrvSamples = history
    .map((row) => row.hrvMs)
    .filter((value): value is number => value !== null);
  const baselineHrvMs = hrvSamples.length >= BASELINE_MIN_SAMPLES ? median(hrvSamples) : null;

  let day: HealthDay | null = todayRow ?? null;
  let vitalsDate: string | null = hasVitals(day) ? date : null;

  // Only the live Today screen borrows a recent morning reading when Watch sync lags.
  // Opening a past/future day stays locked to that calendar date.
  if (!vitalsDate && date === todayISO()) {
    const recent = await db
      .select()
      .from(healthDays)
      .where(and(gte(healthDays.date, addDays(date, -VITALS_FALLBACK_DAYS)), lte(healthDays.date, date)))
      .orderBy(desc(healthDays.date));
    const hit = recent.find((row) => hasVitals(row));
    if (hit) {
      day = hit;
      vitalsDate = hit.date;
    } else {
      day = null;
    }
  } else if (!vitalsDate) {
    day = null;
  }

  const score = scoreFor(day, baselineRestingHr, baselineHrvMs);
  const sync = await lastSync();

  return {
    day,
    vitalsDate,
    baselineRestingHr,
    baselineHrvMs,
    advisory: vitalsDate === date ? advisoryFor(day, baselineRestingHr) : null,
    score,
    label: score === null ? null : score >= 75 ? "ready" : score >= 55 ? "steady" : "hold back",
    lastSyncAt: sync?.at ?? null,
  };
}

/**
 * A deliberately blunt readiness number: sleep carries most of it, resting
 * heart rate and HRV move it around the edges. It informs, it does not decide.
 */
function scoreFor(
  day: HealthDay | null,
  restingBaseline: number | null,
  hrvBaseline: number | null,
): number | null {
  if (!day) return null;
  if (day.asleepMin === null && day.restingHr === null && day.hrvMs === null) return null;

  let score = 70;

  if (day.asleepMin !== null) {
    const hours = day.asleepMin / 60;
    // Seven and a half hours is the pivot; each hour either side is worth ~9.
    score += Math.max(-28, Math.min(20, Math.round((hours - 7.5) * 9)));
  }

  if (day.restingHr !== null && restingBaseline !== null) {
    score -= Math.max(-8, Math.min(24, (day.restingHr - restingBaseline) * 4));
  }

  if (day.hrvMs !== null && hrvBaseline !== null && hrvBaseline > 0) {
    const deltaPct = ((day.hrvMs - hrvBaseline) / hrvBaseline) * 100;
    score += Math.max(-14, Math.min(12, Math.round(deltaPct / 3)));
  }

  return Math.max(5, Math.min(100, Math.round(score)));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function advisoryFor(day: HealthDay | null, baseline: number | null): string | null {
  if (!day) return null;

  const shortSleep = day.asleepMin !== null && day.asleepMin < SHORT_SLEEP_MIN;
  const highResting =
    baseline !== null && day.restingHr !== null && day.restingHr - baseline >= RHR_ELEVATED_BPM;

  if (shortSleep && highResting) {
    return "Short night and your resting heart rate is up. Treat today as easy, or move the hard work to tomorrow.";
  }
  if (shortSleep) {
    return "Under six hours of sleep. Run by effort today and let the pace be whatever it is.";
  }
  if (highResting) {
    return `Resting heart rate is ${day.restingHr! - baseline} bpm above your two-week normal. Worth an easy day if it stays there.`;
  }
  return null;
}

export async function logFor(date: string): Promise<WorkoutLog | null> {
  await ready();
  const [log] = await db.select().from(workoutLogs).where(eq(workoutLogs.date, date));
  return log ?? null;
}

export async function lastSync(): Promise<{ at: string; device: string | null } | null> {
  await ready();
  const [row] = await db.select().from(healthSync).orderBy(desc(healthSync.lastSyncAt)).limit(1);
  return row ? { at: row.lastSyncAt, device: row.device } : null;
}

export type VitalMetric = "sleep" | "rest_hr" | "hrv";

/** Days that have the requested vital, newest first. */
export async function getVitalsHistory(metric: VitalMetric): Promise<HealthDay[]> {
  await ready();
  const column =
    metric === "sleep"
      ? healthDays.asleepMin
      : metric === "rest_hr"
        ? healthDays.restingHr
        : healthDays.hrvMs;

  return db
    .select()
    .from(healthDays)
    .where(isNotNull(column))
    .orderBy(desc(healthDays.date));
}

export function formatSleep(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function meanOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

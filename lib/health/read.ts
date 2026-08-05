import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { healthDays, healthSync, workoutLogs, type HealthDay, type WorkoutLog } from "@/drizzle/schema";
import { addDays } from "@/lib/date";

export interface Recovery {
  day: HealthDay | null;
  /** Median resting HR over the prior two weeks, once there is enough history. */
  baselineRestingHr: number | null;
  baselineHrvMs: number | null;
  /** Soft nudge only — the plan never changes itself from these numbers. */
  advisory: string | null;
  /** 0–100, or null until there is something to score. */
  score: number | null;
  label: "ready" | "steady" | "hold back" | null;
}

const SHORT_SLEEP_MIN = 6 * 60;
const RHR_ELEVATED_BPM = 5;
const BASELINE_MIN_SAMPLES = 4;

export async function recoveryFor(date: string): Promise<Recovery> {
  await ready();

  const [day] = await db.select().from(healthDays).where(eq(healthDays.date, date));
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

  const score = scoreFor(day ?? null, baselineRestingHr, baselineHrvMs);

  return {
    day: day ?? null,
    baselineRestingHr,
    baselineHrvMs,
    advisory: advisoryFor(day ?? null, baselineRestingHr),
    score,
    label: score === null ? null : score >= 75 ? "ready" : score >= 55 ? "steady" : "hold back",
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

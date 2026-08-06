import { and, desc, eq, gte, isNotNull, lt, lte } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import {
  healthDays,
  healthSync,
  profile,
  workoutLogs,
  type HealthDay,
  type WorkoutLog,
} from "@/drizzle/schema";
import { addDays, daysBetween, todayISO } from "@/lib/date";
import { phaseFor } from "@/lib/plan/types";

export interface TrainingLoad {
  /** Miles logged the calendar day before the readiness date. */
  yesterdayMi: number;
  /** Minutes of running yesterday (0 if unknown). */
  yesterdayMin: number;
  /** Miles in the 7 days before the readiness date. */
  weekMi: number;
  /** Miles in the 7 days before that (acute:chronic baseline). */
  priorWeekMi: number;
  daysToRace: number | null;
  /** Points already folded into the readiness score (usually ≤ 0). */
  adjustment: number;
}

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
  /** Recent run load that moved the readiness needle. */
  trainingLoad: TrainingLoad | null;
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

  const trainingLoad = await trainingLoadFor(date);
  const score = scoreFor(day, baselineRestingHr, baselineHrvMs, trainingLoad);
  const sync = await lastSync();

  return {
    day,
    vitalsDate,
    baselineRestingHr,
    baselineHrvMs,
    advisory: vitalsDate === date ? advisoryFor(day, baselineRestingHr, trainingLoad) : null,
    score,
    label: score === null ? null : score >= 75 ? "ready" : score >= 55 ? "steady" : "hold back",
    lastSyncAt: sync?.at ?? null,
    trainingLoad,
  };
}

/**
 * A deliberately blunt readiness number: sleep carries most of it, resting
 * heart rate, HRV, and recent run load move it around the edges. It informs,
 * it does not decide.
 */
function scoreFor(
  day: HealthDay | null,
  restingBaseline: number | null,
  hrvBaseline: number | null,
  load: TrainingLoad | null,
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

  if (load) score += load.adjustment;

  return Math.max(5, Math.min(100, Math.round(score)));
}

/**
 * Recent miles and time tell the other half of recovery: a long Saturday or a
 * sharp weekly ramp costs readiness even when vitals look fine. Race proximity
 * scales that cost — early base absorbs load; taper does not.
 */
async function trainingLoadFor(date: string): Promise<TrainingLoad | null> {
  const from = addDays(date, -14);
  const before = addDays(date, -1);
  const logs = await db
    .select()
    .from(workoutLogs)
    .where(and(gte(workoutLogs.date, from), lte(workoutLogs.date, before)));

  if (logs.length === 0) {
    const [row] = await db.select({ raceDate: profile.raceDate }).from(profile).where(eq(profile.id, 1));
    const daysToRace = row ? Math.max(0, daysBetween(date, row.raceDate)) : null;
    return {
      yesterdayMi: 0,
      yesterdayMin: 0,
      weekMi: 0,
      priorWeekMi: 0,
      daysToRace,
      adjustment: 0,
    };
  }

  const [row] = await db.select({ raceDate: profile.raceDate }).from(profile).where(eq(profile.id, 1));
  const daysToRace = row ? Math.max(0, daysBetween(date, row.raceDate)) : null;
  const weeksToRace = daysToRace === null ? null : Math.max(0, Math.ceil(daysToRace / 7));
  const phase = weeksToRace === null ? null : phaseFor(weeksToRace);

  const yesterday = addDays(date, -1);
  const weekFrom = addDays(date, -7);
  const priorFrom = addDays(date, -14);
  const priorTo = addDays(date, -8);

  const milesBetween = (start: string, end: string) =>
    round1(
      logs
        .filter((log) => log.date >= start && log.date <= end)
        .reduce((sum, log) => sum + (log.distanceMi ?? 0), 0),
    );

  const yLog = logs.find((log) => log.date === yesterday) ?? null;
  const yesterdayMi = round1(yLog?.distanceMi ?? 0);
  const yesterdayMin = yLog?.durationSec ? Math.round(yLog.durationSec / 60) : 0;
  const weekMi = milesBetween(weekFrom, yesterday);
  const priorWeekMi = milesBetween(priorFrom, priorTo);

  let adjustment = 0;

  // Yesterday's session is the sharpest fatigue signal.
  if (yesterdayMi >= 12) adjustment -= 14;
  else if (yesterdayMi >= 10) adjustment -= 11;
  else if (yesterdayMi >= 8) adjustment -= 8;
  else if (yesterdayMi >= 6) adjustment -= 5;
  else if (yesterdayMi >= 4) adjustment -= 3;

  if (yesterdayMin >= 110) adjustment -= 5;
  else if (yesterdayMin >= 90) adjustment -= 3;
  else if (yesterdayMin >= 70) adjustment -= 2;

  // Acute:chronic — this week vs the week before.
  if (priorWeekMi >= 8) {
    const ratio = weekMi / priorWeekMi;
    if (ratio >= 1.5) adjustment -= 10;
    else if (ratio >= 1.3) adjustment -= 6;
    else if (ratio >= 1.15) adjustment -= 3;
  } else if (weekMi >= 18) {
    // Early block with little history but already a solid week.
    adjustment -= 3;
  }

  // Same absolute load costs more as race day closes in.
  if (phase === "taper" || phase === "race") {
    if (yesterdayMi >= 5) adjustment -= 4;
    else if (weekMi >= 20) adjustment -= 3;
  } else if (phase === "peak" && yesterdayMi >= 8) {
    adjustment -= 3;
  } else if (phase === "specific" && yesterdayMi >= 10) {
    adjustment -= 2;
  }
  // Base / early build (e.g. ~192 days out): expected load, no extra penalty.

  // A quiet day after a heavy prior week is the point of the cutback.
  if (yesterdayMi === 0 && priorWeekMi >= 15 && weekMi <= priorWeekMi * 0.75) {
    adjustment += 3;
  }

  adjustment = Math.max(-22, Math.min(4, adjustment));

  return {
    yesterdayMi,
    yesterdayMin,
    weekMi,
    priorWeekMi,
    daysToRace,
    adjustment,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function advisoryFor(
  day: HealthDay | null,
  baseline: number | null,
  load: TrainingLoad | null,
): string | null {
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

  if (load && load.yesterdayMi >= 8) {
    const raceBit =
      load.daysToRace !== null && load.daysToRace > 0
        ? ` With ${load.daysToRace} days to the half, protect the next easy day.`
        : "";
    return `You ran ${load.yesterdayMi} mi yesterday${
      load.yesterdayMin > 0 ? ` in ${load.yesterdayMin} min` : ""
    }.${raceBit}`;
  }

  if (load && load.priorWeekMi >= 8 && load.weekMi / load.priorWeekMi >= 1.3) {
    return `Mileage jumped to ${load.weekMi} mi this week from ${load.priorWeekMi} mi last week. Keep today honest.`;
  }

  if (load && load.adjustment <= -8 && load.daysToRace !== null && load.daysToRace <= 21) {
    return `Training load is still high with ${load.daysToRace} days to race. Err easy until it settles.`;
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

/** Sleep history with stage / sleep-HR rollups for the Sleep page. */
export interface SleepSummary {
  history: HealthDay[];
  today: HealthDay | null;
  todayMin: number | null;
  weekAvgMin: number | null;
  daysLogged: number;
  avgSleepHr: number | null;
  avgRemMin: number | null;
  avgCoreMin: number | null;
  avgDeepMin: number | null;
}

export async function getSleepSummary(): Promise<SleepSummary> {
  const history = await getVitalsHistory("sleep");
  const today = todayISO();
  const todayRow = history.find((row) => row.date === today) ?? null;
  const weekFrom = addDays(today, -6);
  const weekRows = history.filter((row) => row.date >= weekFrom);

  return {
    history,
    today: todayRow,
    todayMin: todayRow?.asleepMin ?? null,
    weekAvgMin: meanOf(weekRows.map((row) => row.asleepMin).filter((v): v is number => v !== null)),
    daysLogged: history.length,
    avgSleepHr: meanOf(
      history.map((row) => row.sleepHr).filter((v): v is number => v !== null && v > 0),
    ),
    avgRemMin: meanOf(
      history.map((row) => row.remMin).filter((v): v is number => v !== null && v > 0),
    ),
    avgCoreMin: meanOf(
      history.map((row) => row.coreMin).filter((v): v is number => v !== null && v > 0),
    ),
    avgDeepMin: meanOf(
      history.map((row) => row.deepMin).filter((v): v is number => v !== null && v > 0),
    ),
  };
}

/** Resting HR history with walking / sleep / daytime range rollups. */
export interface RestHrSummary {
  history: HealthDay[];
  today: HealthDay | null;
  todayHr: number | null;
  weekAvg: number | null;
  daysLogged: number;
  baseline: number | null;
  avgSleepHr: number | null;
  avgWalkingHr: number | null;
  avgHrMin: number | null;
  avgHrMax: number | null;
}

export async function getRestHrSummary(): Promise<RestHrSummary> {
  const history = await getVitalsHistory("rest_hr");
  const today = todayISO();
  const todayRow = history.find((row) => row.date === today) ?? null;
  const weekFrom = addDays(today, -6);
  const weekRows = history.filter((row) => row.date >= weekFrom);

  // Two-week baseline excludes today so "vs normal" matches readiness.
  const baselineRows = history.filter(
    (row) => row.date >= addDays(today, -14) && row.date < today && row.restingHr !== null,
  );
  const baselineSamples = baselineRows
    .map((row) => row.restingHr)
    .filter((v): v is number => v !== null);
  const baseline =
    baselineSamples.length >= 4
      ? [...baselineSamples].sort((a, b) => a - b)[
          Math.floor(baselineSamples.length / 2)
        ]
      : null;

  return {
    history,
    today: todayRow,
    todayHr: todayRow?.restingHr ?? null,
    weekAvg: meanOf(weekRows.map((row) => row.restingHr).filter((v): v is number => v !== null)),
    daysLogged: history.length,
    baseline,
    avgSleepHr: meanOf(
      history.map((row) => row.sleepHr).filter((v): v is number => v !== null && v > 0),
    ),
    avgWalkingHr: meanOf(
      history.map((row) => row.walkingHr).filter((v): v is number => v !== null && v > 0),
    ),
    avgHrMin: meanOf(
      history.map((row) => row.hrMin).filter((v): v is number => v !== null && v > 0),
    ),
    avgHrMax: meanOf(
      history.map((row) => row.hrMax).filter((v): v is number => v !== null && v > 0),
    ),
  };
}

/** HRV history with daily range / sample-count rollups. */
export interface HrvSummary {
  history: HealthDay[];
  today: HealthDay | null;
  todayMs: number | null;
  weekAvg: number | null;
  daysLogged: number;
  baseline: number | null;
  avgHrvMin: number | null;
  avgHrvMax: number | null;
  avgHrvCount: number | null;
  avgRestingHr: number | null;
}

export async function getHrvSummary(): Promise<HrvSummary> {
  const history = await getVitalsHistory("hrv");
  const today = todayISO();
  const todayRow = history.find((row) => row.date === today) ?? null;
  const weekFrom = addDays(today, -6);
  const weekRows = history.filter((row) => row.date >= weekFrom);

  const baselineSamples = history
    .filter((row) => row.date >= addDays(today, -14) && row.date < today && row.hrvMs !== null)
    .map((row) => row.hrvMs)
    .filter((v): v is number => v !== null);
  const baseline =
    baselineSamples.length >= 4
      ? [...baselineSamples].sort((a, b) => a - b)[Math.floor(baselineSamples.length / 2)]
      : null;

  return {
    history,
    today: todayRow,
    todayMs: todayRow?.hrvMs === null || todayRow?.hrvMs === undefined ? null : Math.round(todayRow.hrvMs),
    weekAvg: meanOf(
      weekRows
        .map((row) => (row.hrvMs === null ? null : Math.round(row.hrvMs)))
        .filter((v): v is number => v !== null),
    ),
    daysLogged: history.length,
    baseline: baseline === null ? null : Math.round(baseline),
    avgHrvMin: meanOf(
      history.map((row) => row.hrvMin).filter((v): v is number => v !== null && v > 0),
    ),
    avgHrvMax: meanOf(
      history.map((row) => row.hrvMax).filter((v): v is number => v !== null && v > 0),
    ),
    avgHrvCount: meanOf(
      history.map((row) => row.hrvCount).filter((v): v is number => v !== null && v > 0),
    ),
    avgRestingHr: meanOf(
      history.map((row) => row.restingHr).filter((v): v is number => v !== null && v > 0),
    ),
  };
}

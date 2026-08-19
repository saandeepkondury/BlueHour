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
import { uid } from "@/lib/auth/current";
import { addDays, daysBetween, todayISO } from "@/lib/date";
import { phaseFor } from "@/lib/plan/types";

/** Half-marathon distance the score is aiming toward. */
const HALF_MI = 13.1;
/** A strong peak long before race day — not quite the full half. */
const TARGET_LONG_MI = 12;
/** Solid weekly volume for half training. */
const TARGET_WEEK_MI = 25;

export interface RacePrep {
  daysToRace: number | null;
  longestMi: number;
  longestMin: number;
  weekMi: number;
  priorWeekMi: number;
  runsLast14: number;
  /** Recent average pace in sec/mi across timed runs. */
  avgPaceSecPerMi: number | null;
  /** Recent average running heart rate. */
  avgRunHr: number | null;
  yesterdayMi: number;
  yesterdayMin: number;
  endurancePts: number;
  volumePts: number;
  aerobicPts: number;
  consistencyPts: number;
  recoveryPts: number;
}

/** @deprecated Prefer RacePrep — kept so older call sites still type-check. */
export type TrainingLoad = Pick<
  RacePrep,
  "yesterdayMi" | "yesterdayMin" | "weekMi" | "priorWeekMi" | "daysToRace"
> & { adjustment: number };

export interface Recovery {
  day: HealthDay | null;
  /** Calendar date the displayed vitals belong to (may lag today). */
  vitalsDate: string | null;
  /** Median resting HR over the prior two weeks, once there is enough history. */
  baselineRestingHr: number | null;
  baselineHrvMs: number | null;
  /** Soft nudge only — the plan never changes itself from these numbers. */
  advisory: string | null;
  /** 0–100 race-prep feel, or null until there is something to score. */
  score: number | null;
  label: "building" | "on track" | "race ready" | null;
  /** Last successful Health sync, if any. */
  lastSyncAt: string | null;
  /** Training capacity toward the half. */
  racePrep: RacePrep | null;
  /** Mirror of racePrep fields used by older card copy. */
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

/** Score can stand on run history even when this morning's sleep has not landed. */
export function hasReadinessSignal(recovery: Recovery): boolean {
  if (hasVitals(recovery.day)) return true;
  const prep = recovery.racePrep;
  return Boolean(prep && (prep.longestMi > 0 || prep.runsLast14 > 0));
}

export async function recoveryFor(date: string): Promise<Recovery> {
  await ready();
  const user = await uid();

  const startDate = await trainingStartDate();
  if (startDate) await pruneHealthDaysBefore(startDate);

  const [todayRow] = await db
    .select()
    .from(healthDays)
    .where(and(eq(healthDays.userId, user), eq(healthDays.date, date)));
  const baselineFrom = addDays(date, -14);
  const historyFrom =
    startDate && baselineFrom < startDate ? startDate : baselineFrom;
  const history = await db
    .select()
    .from(healthDays)
    .where(
      and(
        eq(healthDays.userId, user),
        gte(healthDays.date, historyFrom),
        lt(healthDays.date, date),
      ),
    );

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
    const fallbackFrom = addDays(date, -VITALS_FALLBACK_DAYS);
    const recentFrom =
      startDate && fallbackFrom < startDate ? startDate : fallbackFrom;
    const recent = await db
      .select()
      .from(healthDays)
      .where(
        and(
          eq(healthDays.userId, user),
          gte(healthDays.date, recentFrom),
          lte(healthDays.date, date),
        ),
      )
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

  const racePrep = await racePrepFor(date, day, baselineRestingHr, baselineHrvMs);
  const score = scoreFor(racePrep);
  const sync = await lastSync();

  const trainingLoad: TrainingLoad | null = racePrep
    ? {
        yesterdayMi: racePrep.yesterdayMi,
        yesterdayMin: racePrep.yesterdayMin,
        weekMi: racePrep.weekMi,
        priorWeekMi: racePrep.priorWeekMi,
        daysToRace: racePrep.daysToRace,
        adjustment: racePrep.recoveryPts,
      }
    : null;

  return {
    day,
    vitalsDate,
    baselineRestingHr,
    baselineHrvMs,
    advisory: advisoryFor(day, baselineRestingHr, racePrep, vitalsDate === date),
    score,
    label: labelFor(score),
    lastSyncAt: sync?.at ?? null,
    racePrep,
    trainingLoad,
  };
}

/**
 * Race-feel readiness: can you cover distance sustainably for the half?
 * Longest run and weekly volume carry most of the weight; run HR / pace and
 * today's recovery nudge the edges. Good sleep alone cannot make this 100.
 */
function scoreFor(prep: RacePrep | null): number | null {
  if (!prep) return null;
  if (prep.longestMi <= 0 && prep.runsLast14 <= 0 && prep.recoveryPts === 0) return null;

  let score =
    prep.endurancePts +
    prep.volumePts +
    prep.aerobicPts +
    prep.consistencyPts +
    prep.recoveryPts;

  // Hard ceiling: without long-run proof, you cannot feel race-ready.
  const longCeiling =
    prep.longestMi <= 0
      ? 28
      : prep.longestMi < 4
        ? 42
        : prep.longestMi < 6
          ? 55
          : prep.longestMi < 8
            ? 68
            : prep.longestMi < 10
              ? 80
              : prep.longestMi < TARGET_LONG_MI
                ? 90
                : 100;

  score = Math.min(score, longCeiling);
  return Math.max(5, Math.min(100, Math.round(score)));
}

function labelFor(
  score: number | null,
): "building" | "on track" | "race ready" | null {
  if (score === null) return null;
  if (score >= 75) return "race ready";
  if (score >= 56) return "on track";
  return "building";
}

function racePrepFromData(
  date: string,
  raceDate: string | null,
  trainingStart: string,
  allRuns: WorkoutLog[],
  day: HealthDay | null,
  restingBaseline: number | null,
  hrvBaseline: number | null,
): RacePrep | null {
  const daysToRace = raceDate ? Math.max(0, daysBetween(date, raceDate)) : null;
  const lookback = addDays(date, -120);
  const historyFrom = lookback < trainingStart ? trainingStart : lookback;
  const before = addDays(date, -1);
  const runs = allRuns.filter(
    (log) => log.date >= historyFrom && log.date <= before && (log.distanceMi ?? 0) > 0.2,
  );

  const yesterday = addDays(date, -1);
  const weekFrom = addDays(date, -7);
  const priorFrom = addDays(date, -14);
  const priorTo = addDays(date, -8);

  const milesBetween = (start: string, end: string) =>
    round1(
      runs
        .filter((log) => log.date >= start && log.date <= end)
        .reduce((sum, log) => sum + (log.distanceMi ?? 0), 0),
    );

  const yLog = runs.find((log) => log.date === yesterday) ?? null;
  const yesterdayMi = round1(yLog?.distanceMi ?? 0);
  const yesterdayMin = yLog?.durationSec ? Math.round(yLog.durationSec / 60) : 0;
  const weekMi = milesBetween(weekFrom, yesterday);
  const priorWeekMi = milesBetween(priorFrom, priorTo);
  const recent = runs.filter((log) => log.date >= priorFrom);
  const runsLast14 = recent.length;

  let longestMi = 0;
  let longestMin = 0;
  for (const log of runs) {
    if ((log.distanceMi ?? 0) > longestMi) {
      longestMi = round1(log.distanceMi ?? 0);
      longestMin = log.durationSec ? Math.round(log.durationSec / 60) : 0;
    }
  }

  const paced = recent.filter(
    (log) => (log.distanceMi ?? 0) >= 1 && (log.durationSec ?? 0) >= 60,
  );
  const avgPaceSecPerMi =
    paced.length === 0
      ? null
      : Math.round(
          paced.reduce((sum, log) => sum + log.durationSec! / log.distanceMi!, 0) / paced.length,
        );

  const withHr = recent.filter((log) => log.avgHr !== null && log.avgHr > 0);
  const avgRunHr =
    withHr.length === 0
      ? null
      : Math.round(withHr.reduce((sum, log) => sum + log.avgHr!, 0) / withHr.length);

  const endurancePts = Math.round(Math.min(40, (longestMi / TARGET_LONG_MI) * 40));
  const volumePts = Math.round(Math.min(20, (weekMi / TARGET_WEEK_MI) * 20));

  let aerobicPts = 0;
  if (avgRunHr !== null) {
    if (avgRunHr <= 125) aerobicPts += 12;
    else if (avgRunHr <= 135) aerobicPts += 9;
    else if (avgRunHr <= 145) aerobicPts += 5;
    else if (avgRunHr <= 155) aerobicPts += 2;
  }
  if (avgPaceSecPerMi !== null && longestMi >= 3) {
    const minPerMi = avgPaceSecPerMi / 60;
    if (minPerMi <= 12) aerobicPts += 8;
    else if (minPerMi <= 14) aerobicPts += 6;
    else if (minPerMi <= 16) aerobicPts += 4;
    else if (minPerMi <= 18) aerobicPts += 2;
  } else if (longestMin >= 60) {
    aerobicPts += 4;
  }
  if (avgRunHr !== null && avgRunHr >= 150 && longestMi < 6) {
    aerobicPts = Math.max(0, aerobicPts - 4);
  }
  aerobicPts = Math.min(20, aerobicPts);

  const consistencyPts = Math.min(10, runsLast14 * 2);

  let recoveryPts = 0;
  if (day?.asleepMin !== null && day?.asleepMin !== undefined) {
    const hours = day.asleepMin / 60;
    recoveryPts += Math.max(-10, Math.min(6, Math.round((hours - 7.5) * 4)));
  }
  if (day?.restingHr !== null && day?.restingHr !== undefined && restingBaseline !== null) {
    recoveryPts -= Math.max(-4, Math.min(10, Math.round((day.restingHr - restingBaseline) * 2)));
  }
  if (day?.hrvMs !== null && day?.hrvMs !== undefined && hrvBaseline !== null && hrvBaseline > 0) {
    const deltaPct = ((day.hrvMs - hrvBaseline) / hrvBaseline) * 100;
    recoveryPts += Math.max(-6, Math.min(5, Math.round(deltaPct / 5)));
  }
  if (yesterdayMi >= 10) recoveryPts -= 6;
  else if (yesterdayMi >= 8) recoveryPts -= 4;
  else if (yesterdayMi >= 6) recoveryPts -= 2;
  if (yesterdayMin >= 100) recoveryPts -= 3;
  else if (yesterdayMin >= 75) recoveryPts -= 1;

  if (priorWeekMi >= 8) {
    const ratio = weekMi / priorWeekMi;
    if (ratio >= 1.4) recoveryPts -= 4;
    else if (ratio >= 1.25) recoveryPts -= 2;
  }

  const weeksToRace = daysToRace === null ? null : Math.max(0, Math.ceil(daysToRace / 7));
  const phase = weeksToRace === null ? null : phaseFor(weeksToRace);
  if ((phase === "taper" || phase === "race") && yesterdayMi >= 5) recoveryPts -= 3;

  recoveryPts = Math.max(-15, Math.min(12, recoveryPts));

  if (runs.length === 0 && !hasVitals(day) && recoveryPts === 0) {
    return {
      daysToRace,
      longestMi: 0,
      longestMin: 0,
      weekMi: 0,
      priorWeekMi: 0,
      runsLast14: 0,
      avgPaceSecPerMi: null,
      avgRunHr: null,
      yesterdayMi: 0,
      yesterdayMin: 0,
      endurancePts: 0,
      volumePts: 0,
      aerobicPts: 0,
      consistencyPts: 0,
      recoveryPts: 0,
    };
  }

  return {
    daysToRace,
    longestMi,
    longestMin,
    weekMi,
    priorWeekMi,
    runsLast14,
    avgPaceSecPerMi,
    avgRunHr,
    yesterdayMi,
    yesterdayMin,
    endurancePts,
    volumePts,
    aerobicPts,
    consistencyPts,
    recoveryPts,
  };
}

async function racePrepFor(
  date: string,
  day: HealthDay | null,
  restingBaseline: number | null,
  hrvBaseline: number | null,
): Promise<RacePrep | null> {
  const user = await uid();
  const [row] = await db
    .select({ raceDate: profile.raceDate, startDate: profile.startDate })
    .from(profile)
    .where(eq(profile.userId, user));
  const trainingStart = row?.startDate ?? addDays(date, -120);
  const lookback = addDays(date, -120);
  const historyFrom = lookback < trainingStart ? trainingStart : lookback;
  const before = addDays(date, -1);
  const logs = await db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, user),
        gte(workoutLogs.date, historyFrom),
        lte(workoutLogs.date, before),
      ),
    );

  return racePrepFromData(
    date,
    row?.raceDate ?? null,
    trainingStart,
    logs,
    day,
    restingBaseline,
    hrvBaseline,
  );
}

export interface ReadinessDay {
  date: string;
  score: number | null;
  label: "building" | "on track" | "race ready" | null;
  longestMi: number;
  weekMi: number;
  daysToRace: number | null;
}

export interface ReadinessHistory {
  startDate: string;
  today: ReadinessDay | null;
  days: ReadinessDay[];
  high: number | null;
  low: number | null;
  avg: number | null;
  delta: number | null;
}

/** Daily race-readiness scores from training start through today. */
export async function getReadinessHistory(): Promise<ReadinessHistory> {
  await ready();
  const user = await uid();

  const [row] = await db
    .select({ raceDate: profile.raceDate, startDate: profile.startDate })
    .from(profile)
    .where(eq(profile.userId, user));
  const today = todayISO();
  const startDate = row?.startDate && row.startDate <= today ? row.startDate : today;
  const raceDate = row?.raceDate ?? null;

  await pruneHealthDaysBefore(startDate);
  await db
    .delete(workoutLogs)
    .where(and(eq(workoutLogs.userId, user), lt(workoutLogs.date, startDate)));

  const [logs, vitalRows] = await Promise.all([
    db
      .select()
      .from(workoutLogs)
      .where(
        and(
          eq(workoutLogs.userId, user),
          gte(workoutLogs.date, startDate),
          lte(workoutLogs.date, today),
        ),
      ),
    db
      .select()
      .from(healthDays)
      .where(
        and(
          eq(healthDays.userId, user),
          gte(healthDays.date, startDate),
          lte(healthDays.date, today),
        ),
      ),
  ]);

  const vitalsByDate = new Map(vitalRows.map((day) => [day.date, day]));
  const days: ReadinessDay[] = [];

  for (let date = startDate; date <= today; date = addDays(date, 1)) {
    const day = vitalsByDate.get(date) ?? null;
    const baselineFrom = addDays(date, -14);
    const histFrom = baselineFrom < startDate ? startDate : baselineFrom;
    const priorVitals = vitalRows.filter((row) => row.date >= histFrom && row.date < date);

    const restingSamples = priorVitals
      .map((row) => row.restingHr)
      .filter((value): value is number => value !== null);
    const restingBaseline =
      restingSamples.length >= BASELINE_MIN_SAMPLES ? median(restingSamples) : null;

    const hrvSamples = priorVitals
      .map((row) => row.hrvMs)
      .filter((value): value is number => value !== null);
    const hrvBaseline =
      hrvSamples.length >= BASELINE_MIN_SAMPLES ? median(hrvSamples) : null;

    const prep = racePrepFromData(
      date,
      raceDate,
      startDate,
      logs,
      day,
      restingBaseline,
      hrvBaseline,
    );
    const score = scoreFor(prep);
    days.push({
      date,
      score,
      label: labelFor(score),
      longestMi: prep?.longestMi ?? 0,
      weekMi: prep?.weekMi ?? 0,
      daysToRace: prep?.daysToRace ?? null,
    });
  }

  const scored = days.filter((day) => day.score !== null) as Array<ReadinessDay & { score: number }>;
  const high = scored.length ? Math.max(...scored.map((day) => day.score)) : null;
  const low = scored.length ? Math.min(...scored.map((day) => day.score)) : null;
  const avg =
    scored.length === 0
      ? null
      : Math.round(scored.reduce((sum, day) => sum + day.score, 0) / scored.length);

  const todayEntry = days.find((day) => day.date === today) ?? null;
  const priorScored = [...scored].reverse().find((day) => day.date < today) ?? null;
  const delta =
    todayEntry?.score != null && priorScored ? todayEntry.score - priorScored.score : null;

  return { startDate, today: todayEntry, days: days.reverse(), high, low, avg, delta };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function formatPace(secPerMi: number): string {
  const m = Math.floor(secPerMi / 60);
  const s = Math.round(secPerMi % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

function advisoryFor(
  day: HealthDay | null,
  baseline: number | null,
  prep: RacePrep | null,
  freshVitals: boolean,
): string | null {
  if (freshVitals && day) {
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
  }

  if (!prep) return null;

  if (prep.longestMi < 6 && prep.daysToRace !== null && prep.daysToRace > 30) {
    const paceBit = prep.avgPaceSecPerMi ? ` at ~${formatPace(prep.avgPaceSecPerMi)}` : "";
    const hrBit = prep.avgRunHr ? ` · avg run HR ${prep.avgRunHr}` : "";
    return `Longest so far ${prep.longestMi || 0} mi${paceBit}${hrBit}. Half is ${HALF_MI} — keep growing the long run.`;
  }

  if (prep.longestMi < 10 && prep.daysToRace !== null && prep.daysToRace <= 60) {
    return `Longest ${prep.longestMi} mi with ${prep.daysToRace} days left. Stretch the Saturday long before race week.`;
  }

  if (prep.yesterdayMi >= 8) {
    return `You ran ${prep.yesterdayMi} mi yesterday${
      prep.yesterdayMin > 0 ? ` in ${prep.yesterdayMin} min` : ""
    }. Protect the next easy day.`;
  }

  if (prep.priorWeekMi >= 8 && prep.weekMi / prep.priorWeekMi >= 1.3) {
    return `Mileage jumped to ${prep.weekMi} mi this week from ${prep.priorWeekMi} mi last week. Keep today honest.`;
  }

  if (prep.daysToRace !== null && prep.longestMi >= TARGET_LONG_MI) {
    return `Longest ${prep.longestMi} mi · ${prep.daysToRace} days to the half.`;
  }

  return null;
}

export async function logFor(date: string): Promise<WorkoutLog | null> {
  await ready();
  const user = await uid();
  const [log] = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.userId, user), eq(workoutLogs.date, date)));
  return log ?? null;
}

export async function lastSync(): Promise<{ at: string; device: string | null } | null> {
  await ready();
  const user = await uid();
  const [row] = await db.select().from(healthSync).where(eq(healthSync.userId, user));
  return row ? { at: row.lastSyncAt, device: row.device } : null;
}

export type VitalMetric = "sleep" | "rest_hr" | "hrv";

/** Drop sleep / HR / HRV day rows from before the training block started. */
export async function pruneHealthDaysBefore(startDate: string): Promise<number> {
  await ready();
  const user = await uid();
  const removed = await db
    .delete(healthDays)
    .where(and(eq(healthDays.userId, user), lt(healthDays.date, startDate)))
    .returning({
      date: healthDays.date,
    });
  return removed.length;
}

async function trainingStartDate(): Promise<string | null> {
  const user = await uid();
  const [row] = await db
    .select({ startDate: profile.startDate })
    .from(profile)
    .where(eq(profile.userId, user));
  return row?.startDate ?? null;
}

/** Days that have the requested vital, newest first — only since training start. */
export async function getVitalsHistory(metric: VitalMetric): Promise<HealthDay[]> {
  await ready();
  const user = await uid();
  const startDate = await trainingStartDate();
  if (startDate) await pruneHealthDaysBefore(startDate);

  const column =
    metric === "sleep"
      ? healthDays.asleepMin
      : metric === "rest_hr"
        ? healthDays.restingHr
        : healthDays.hrvMs;

  const filters = startDate
    ? and(eq(healthDays.userId, user), isNotNull(column), gte(healthDays.date, startDate))
    : and(eq(healthDays.userId, user), isNotNull(column));

  return db.select().from(healthDays).where(filters).orderBy(desc(healthDays.date));
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

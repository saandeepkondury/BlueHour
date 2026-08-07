import { eq, inArray } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { healthDays, healthSync, workoutLogs, workouts } from "@/drizzle/schema";
import { isoInTimeZone, todayISO } from "@/lib/date";
import { isRun, type WorkoutType } from "@/lib/plan/types";

/**
 * The iPhone sends raw HealthKit samples with timestamps; every conversion to a
 * training date happens here so America/Chicago lives in one place.
 */

export interface SleepInput {
  startAt: string;
  endAt: string;
  asleepMin: number;
  inBedMin?: number | null;
  remMin?: number | null;
  coreMin?: number | null;
  deepMin?: number | null;
  avgHr?: number | null;
}

export interface VitalInput {
  at: string;
  restingHr?: number | null;
  hrvMs?: number | null;
  walkingHr?: number | null;
  hrMin?: number | null;
  hrAvg?: number | null;
  hrMax?: number | null;
}

/**
 * A whole day's numbers keyed by a date the sender already resolved. Apple
 * Shortcuts posts this shape because it cannot hand over raw sample windows.
 */
export interface DayInput {
  date: string;
  asleepMin?: number | null;
  inBedMin?: number | null;
  restingHr?: number | null;
  hrvMs?: number | null;
  steps?: number | null;
  activeKcal?: number | null;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  waistCm?: number | null;
}

export interface WorkoutInput {
  externalId: string;
  startAt: string;
  endAt: string;
  activityType: string;
  distanceMi?: number | null;
  durationSec: number;
  avgHr?: number | null;
  maxHr?: number | null;
  activeKcal?: number | null;
}

export interface HealthPayload {
  device?: string | null;
  sleep?: SleepInput[];
  vitals?: VitalInput[];
  days?: DayInput[];
  workouts?: WorkoutInput[];
}

export interface IngestResult {
  daysWritten: number;
  workoutsWritten: number;
  markedDone: string[];
}

/** HealthKit activity types worth counting as a training run. */
const RUN_ACTIVITIES = new Set(["running", "walking", "hiking", "mixedcardio", "crosstraining"]);

export class PayloadError extends Error {}

function asArray(value: unknown, field: string): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new PayloadError(`${field} must be an array`);
  return value;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PayloadError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new PayloadError(`${field} must be an ISO-8601 timestamp`);
  }
  return value;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PayloadError(`${field} must be a number`);
  }
  return value;
}

function optionalNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  return asNumber(value, field);
}

function optionalRounded(value: unknown, field: string): number | null {
  const n = optionalNumber(value, field);
  return n === null ? null : Math.round(n);
}

function asDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PayloadError(`${field} must be a YYYY-MM-DD date`);
  }
  return value;
}

const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;

/** Accepts either metric or imperial so a Shortcut can send whatever Health holds. */
function bodyFields(source: Record<string, unknown>, label: string) {
  const lb = optionalNumber(source.weightLb, `${label}.weightLb`);
  const inches = optionalNumber(source.waistIn, `${label}.waistIn`);
  return {
    weightKg: optionalNumber(source.weightKg, `${label}.weightKg`) ?? (lb === null ? null : lb * LB_TO_KG),
    bodyFatPct: optionalNumber(source.bodyFatPct, `${label}.bodyFatPct`),
    waistCm: optionalNumber(source.waistCm, `${label}.waistCm`) ?? (inches === null ? null : inches * IN_TO_CM),
    steps: optionalRounded(source.steps, `${label}.steps`),
    activeKcal: optionalRounded(source.activeKcal, `${label}.activeKcal`),
  };
}

function parseDayEntry(source: Record<string, unknown>, label: string, date: string): DayInput {
  return {
    date,
    asleepMin: optionalRounded(source.asleepMin, `${label}.asleepMin`),
    inBedMin: optionalRounded(source.inBedMin, `${label}.inBedMin`),
    restingHr: optionalRounded(source.restingHr, `${label}.restingHr`),
    hrvMs: optionalNumber(source.hrvMs, `${label}.hrvMs`),
    ...bodyFields(source, label),
  };
}

/** True when a flat post carries at least one number worth storing. */
function hasDayValues(day: DayInput): boolean {
  return (
    day.asleepMin !== null ||
    day.restingHr !== null ||
    day.hrvMs !== null ||
    day.steps !== null ||
    day.activeKcal !== null ||
    day.weightKg !== null ||
    day.bodyFatPct !== null ||
    day.waistCm !== null
  );
}

export function parsePayload(raw: unknown): HealthPayload {
  const body = asRecord(raw, "body");

  const sleep = asArray(body.sleep, "sleep").map((entry, i) => {
    const s = asRecord(entry, `sleep[${i}]`);
    return {
      startAt: asTimestamp(s.startAt, `sleep[${i}].startAt`),
      endAt: asTimestamp(s.endAt, `sleep[${i}].endAt`),
      asleepMin: Math.round(asNumber(s.asleepMin, `sleep[${i}].asleepMin`)),
      inBedMin: optionalRounded(s.inBedMin, `sleep[${i}].inBedMin`),
      remMin: optionalRounded(s.remMin, `sleep[${i}].remMin`),
      coreMin: optionalRounded(s.coreMin, `sleep[${i}].coreMin`),
      deepMin: optionalRounded(s.deepMin, `sleep[${i}].deepMin`),
      avgHr: optionalRounded(s.avgHr, `sleep[${i}].avgHr`),
    } satisfies SleepInput;
  });

  const vitals = asArray(body.vitals, "vitals").map((entry, i) => {
    const v = asRecord(entry, `vitals[${i}]`);
    return {
      at: asTimestamp(v.at, `vitals[${i}].at`),
      restingHr: optionalRounded(v.restingHr, `vitals[${i}].restingHr`),
      hrvMs: optionalNumber(v.hrvMs, `vitals[${i}].hrvMs`),
      walkingHr: optionalRounded(v.walkingHr, `vitals[${i}].walkingHr`),
      hrMin: optionalRounded(v.hrMin, `vitals[${i}].hrMin`),
      hrAvg: optionalRounded(v.hrAvg, `vitals[${i}].hrAvg`),
      hrMax: optionalRounded(v.hrMax, `vitals[${i}].hrMax`),
    } satisfies VitalInput;
  });

  const rawSessions = body.workout === undefined || body.workout === null
    ? asArray(body.workouts, "workouts")
    : [body.workout, ...asArray(body.workouts, "workouts")];

  const sessions = rawSessions.map((entry, i) => {
    const w = asRecord(entry, `workouts[${i}]`);
    if (typeof w.activityType !== "string") {
      throw new PayloadError(`workouts[${i}].activityType is required`);
    }
    const startAt = asTimestamp(w.startAt, `workouts[${i}].startAt`);
    return {
      // A Shortcut has no HealthKit UUID to give, so the start time stands in.
      externalId:
        typeof w.externalId === "string" && w.externalId.length > 0
          ? w.externalId
          : `${w.activityType.toLowerCase()}:${startAt}`,
      startAt,
      endAt: asTimestamp(w.endAt, `workouts[${i}].endAt`),
      activityType: w.activityType.toLowerCase(),
      distanceMi: optionalNumber(w.distanceMi, `workouts[${i}].distanceMi`),
      durationSec: Math.round(asNumber(w.durationSec, `workouts[${i}].durationSec`)),
      avgHr: optionalRounded(w.avgHr, `workouts[${i}].avgHr`),
      maxHr: optionalRounded(w.maxHr, `workouts[${i}].maxHr`),
      activeKcal: optionalRounded(w.activeKcal, `workouts[${i}].activeKcal`),
    } satisfies WorkoutInput;
  });

  const days = asArray(body.days, "days").map((entry, i) => {
    const d = asRecord(entry, `days[${i}]`);
    return parseDayEntry(d, `days[${i}]`, asDate(d.date, `days[${i}].date`));
  });

  // Flat form: the whole body is one day. Used by the Shortcuts automation.
  if (body.date !== undefined || body.asleepMin !== undefined || body.weightLb !== undefined) {
    const flat = parseDayEntry(body, "body", body.date === undefined ? todayISO() : asDate(body.date, "body.date"));
    if (hasDayValues(flat)) days.push(flat);
  }

  return {
    device: typeof body.device === "string" ? body.device : null,
    sleep,
    vitals,
    days,
    workouts: sessions,
  };
}

interface DayPatch {
  sleepStart?: string;
  sleepEnd?: string;
  asleepMin?: number;
  inBedMin?: number | null;
  remMin?: number | null;
  coreMin?: number | null;
  deepMin?: number | null;
  sleepHr?: number | null;
  restingHr?: number;
  walkingHr?: number;
  hrMin?: number;
  hrAvg?: number;
  hrMax?: number;
  hrvMs?: number;
  hrvMin?: number;
  hrvMax?: number;
  hrvCount?: number;
  steps?: number;
  activeKcal?: number;
  weightKg?: number;
  bodyFatPct?: number;
  waistCm?: number;
}

/**
 * Sleep is filed under the morning you woke up, so Today can ask for its own
 * date and get last night. Every block that ends that day is summed — overnight
 * plus naps — so an afternoon nap is not dropped when a longer night exists.
 */
function collectDays(payload: HealthPayload): Map<string, DayPatch> {
  const byDate = new Map<string, DayPatch>();
  const patch = (date: string): DayPatch => {
    const existing = byDate.get(date);
    if (existing) return existing;
    const fresh: DayPatch = {};
    byDate.set(date, fresh);
    return fresh;
  };

  // Accumulate sleep separately so we can weight heart rate by minutes slept.
  const sleepAcc = new Map<
    string,
    {
      asleepMin: number;
      inBedMin: number;
      remMin: number;
      coreMin: number;
      deepMin: number;
      hrWeighted: number;
      hrMinutes: number;
      primaryAsleep: number;
      primaryStart: string;
      primaryEnd: string;
    }
  >();

  for (const night of payload.sleep ?? []) {
    const date = isoInTimeZone(new Date(night.endAt));
    const rem = night.remMin ?? 0;
    const core = night.coreMin ?? 0;
    const deep = night.deepMin ?? 0;
    const inBed = night.inBedMin ?? 0;
    const existing = sleepAcc.get(date);

    if (!existing) {
      sleepAcc.set(date, {
        asleepMin: night.asleepMin,
        inBedMin: inBed,
        remMin: rem,
        coreMin: core,
        deepMin: deep,
        hrWeighted: night.avgHr != null ? night.avgHr * night.asleepMin : 0,
        hrMinutes: night.avgHr != null ? night.asleepMin : 0,
        primaryAsleep: night.asleepMin,
        primaryStart: night.startAt,
        primaryEnd: night.endAt,
      });
      continue;
    }

    existing.asleepMin += night.asleepMin;
    existing.inBedMin += inBed;
    existing.remMin += rem;
    existing.coreMin += core;
    existing.deepMin += deep;
    if (night.avgHr != null) {
      existing.hrWeighted += night.avgHr * night.asleepMin;
      existing.hrMinutes += night.asleepMin;
    }
    // Keep bed/wake of the longest block for display; minutes still include naps.
    if (night.asleepMin > existing.primaryAsleep) {
      existing.primaryAsleep = night.asleepMin;
      existing.primaryStart = night.startAt;
      existing.primaryEnd = night.endAt;
    }
  }

  for (const [date, acc] of sleepAcc) {
    const day = patch(date);
    day.sleepStart = acc.primaryStart;
    day.sleepEnd = acc.primaryEnd;
    day.asleepMin = acc.asleepMin;
    day.inBedMin = acc.inBedMin > 0 ? acc.inBedMin : null;
    day.remMin = acc.remMin > 0 ? acc.remMin : null;
    day.coreMin = acc.coreMin > 0 ? acc.coreMin : null;
    day.deepMin = acc.deepMin > 0 ? acc.deepMin : null;
    day.sleepHr = acc.hrMinutes > 0 ? Math.round(acc.hrWeighted / acc.hrMinutes) : null;
  }

  // Multiple SDNN readings per day are common; keep the range and use the mean.
  const hrvAcc = new Map<string, { min: number; max: number; sum: number; count: number }>();

  for (const vital of payload.vitals ?? []) {
    const date = isoInTimeZone(new Date(vital.at));
    const day = patch(date);
    if (vital.restingHr !== null && vital.restingHr !== undefined) day.restingHr = vital.restingHr;
    if (vital.walkingHr !== null && vital.walkingHr !== undefined) day.walkingHr = vital.walkingHr;
    if (vital.hrMin !== null && vital.hrMin !== undefined) {
      day.hrMin = day.hrMin === undefined ? vital.hrMin : Math.min(day.hrMin, vital.hrMin);
    }
    if (vital.hrMax !== null && vital.hrMax !== undefined) {
      day.hrMax = day.hrMax === undefined ? vital.hrMax : Math.max(day.hrMax, vital.hrMax);
    }
    if (vital.hrAvg !== null && vital.hrAvg !== undefined) day.hrAvg = vital.hrAvg;
    if (vital.hrvMs !== null && vital.hrvMs !== undefined) {
      const existing = hrvAcc.get(date);
      if (!existing) {
        hrvAcc.set(date, { min: vital.hrvMs, max: vital.hrvMs, sum: vital.hrvMs, count: 1 });
      } else {
        existing.min = Math.min(existing.min, vital.hrvMs);
        existing.max = Math.max(existing.max, vital.hrvMs);
        existing.sum += vital.hrvMs;
        existing.count += 1;
      }
    }
  }

  for (const [date, acc] of hrvAcc) {
    const day = patch(date);
    day.hrvMs = Math.round((acc.sum / acc.count) * 10) / 10;
    day.hrvMin = Math.round(acc.min * 10) / 10;
    day.hrvMax = Math.round(acc.max * 10) / 10;
    day.hrvCount = acc.count;
  }

  // Pre-resolved days land last so an explicit value wins over a derived one.
  for (const entry of payload.days ?? []) {
    const day = patch(entry.date);
    if (entry.asleepMin !== null && entry.asleepMin !== undefined) {
      day.asleepMin = entry.asleepMin;
      day.inBedMin = entry.inBedMin ?? null;
    }
    if (entry.restingHr !== null && entry.restingHr !== undefined) day.restingHr = entry.restingHr;
    if (entry.hrvMs !== null && entry.hrvMs !== undefined) day.hrvMs = entry.hrvMs;
    if (entry.steps !== null && entry.steps !== undefined) day.steps = entry.steps;
    if (entry.activeKcal !== null && entry.activeKcal !== undefined) day.activeKcal = entry.activeKcal;
    if (entry.weightKg !== null && entry.weightKg !== undefined) day.weightKg = entry.weightKg;
    if (entry.bodyFatPct !== null && entry.bodyFatPct !== undefined) day.bodyFatPct = entry.bodyFatPct;
    if (entry.waistCm !== null && entry.waistCm !== undefined) day.waistCm = entry.waistCm;
  }

  return byDate;
}

/** One log per date: the longest run-like session wins. */
function bestWorkoutPerDay(sessions: WorkoutInput[]): Map<string, WorkoutInput> {
  const byDate = new Map<string, WorkoutInput>();
  for (const session of sessions) {
    if (!RUN_ACTIVITIES.has(session.activityType)) continue;
    const date = isoInTimeZone(new Date(session.startAt));
    const current = byDate.get(date);
    if (!current || session.durationSec > current.durationSec) byDate.set(date, session);
  }
  return byDate;
}

export async function ingestHealth(payload: HealthPayload): Promise<IngestResult> {
  await ready();
  const now = new Date().toISOString();

  const days = collectDays(payload);
  for (const [date, day] of days) {
    if (Object.keys(day).length === 0) continue;
    await db
      .insert(healthDays)
      .values({
        date,
        sleepStart: day.sleepStart ?? null,
        sleepEnd: day.sleepEnd ?? null,
        asleepMin: day.asleepMin ?? null,
        inBedMin: day.inBedMin ?? null,
        remMin: day.remMin ?? null,
        coreMin: day.coreMin ?? null,
        deepMin: day.deepMin ?? null,
        sleepHr: day.sleepHr ?? null,
        restingHr: day.restingHr ?? null,
        walkingHr: day.walkingHr ?? null,
        hrMin: day.hrMin ?? null,
        hrAvg: day.hrAvg ?? null,
        hrMax: day.hrMax ?? null,
        hrvMs: day.hrvMs ?? null,
        hrvMin: day.hrvMin ?? null,
        hrvMax: day.hrvMax ?? null,
        hrvCount: day.hrvCount ?? null,
        steps: day.steps ?? null,
        activeKcal: day.activeKcal ?? null,
        weightKg: day.weightKg ?? null,
        bodyFatPct: day.bodyFatPct ?? null,
        waistCm: day.waistCm ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: healthDays.date,
        // Keep whatever HealthKit did not send this round rather than nulling it.
        set: {
          ...(day.sleepStart ? { sleepStart: day.sleepStart, sleepEnd: day.sleepEnd } : {}),
          ...(day.asleepMin !== undefined
            ? {
                asleepMin: day.asleepMin,
                inBedMin: day.inBedMin ?? null,
                remMin: day.remMin ?? null,
                coreMin: day.coreMin ?? null,
                deepMin: day.deepMin ?? null,
                sleepHr: day.sleepHr ?? null,
              }
            : {}),
          ...(day.restingHr !== undefined ? { restingHr: day.restingHr } : {}),
          ...(day.walkingHr !== undefined ? { walkingHr: day.walkingHr } : {}),
          ...(day.hrMin !== undefined ? { hrMin: day.hrMin } : {}),
          ...(day.hrAvg !== undefined ? { hrAvg: day.hrAvg } : {}),
          ...(day.hrMax !== undefined ? { hrMax: day.hrMax } : {}),
          ...(day.hrvMs !== undefined
            ? {
                hrvMs: day.hrvMs,
                hrvMin: day.hrvMin ?? null,
                hrvMax: day.hrvMax ?? null,
                hrvCount: day.hrvCount ?? null,
              }
            : {}),
          ...(day.steps !== undefined ? { steps: day.steps } : {}),
          ...(day.activeKcal !== undefined ? { activeKcal: day.activeKcal } : {}),
          ...(day.weightKg !== undefined ? { weightKg: day.weightKg } : {}),
          ...(day.bodyFatPct !== undefined ? { bodyFatPct: day.bodyFatPct } : {}),
          ...(day.waistCm !== undefined ? { waistCm: day.waistCm } : {}),
          updatedAt: now,
        },
      });
  }

  const sessions = bestWorkoutPerDay(payload.workouts ?? []);
  const dates = [...sessions.keys()];

  let workoutsWritten = 0;
  for (const [date, session] of sessions) {
    // Watch distance / time / HR win over a typed estimate. Feel / effort /
    // notes are runner-entered and are not in `values`, so re-sync keeps them.
    const values = {
      date,
      distanceMi: session.distanceMi ?? 0,
      durationSec: session.durationSec,
      source: "healthkit",
      externalId: session.externalId,
      avgHr: session.avgHr,
      maxHr: session.maxHr,
      activeKcal: session.activeKcal,
      startAt: session.startAt,
      endAt: session.endAt,
    };
    await db
      .insert(workoutLogs)
      .values({ ...values, createdAt: now })
      .onConflictDoUpdate({ target: workoutLogs.date, set: values });
    workoutsWritten += 1;
  }

  const markedDone = await markRunsDone(dates);

  await db
    .insert(healthSync)
    .values({
      id: 1,
      lastSyncAt: now,
      device: payload.device ?? null,
      daysSeen: days.size,
      workoutsSeen: sessions.size,
    })
    .onConflictDoUpdate({
      target: healthSync.id,
      set: {
        lastSyncAt: now,
        device: payload.device ?? null,
        daysSeen: days.size,
        workoutsSeen: sessions.size,
      },
    });

  return { daysWritten: days.size, workoutsWritten, markedDone };
}

/**
 * An imported run closes out the planned session for that date. Only planned
 * days are touched, so a deliberate skip stays skipped.
 */
async function markRunsDone(dates: string[]): Promise<string[]> {
  if (dates.length === 0) return [];
  const planned = await db.select().from(workouts).where(inArray(workouts.date, dates));
  const done: string[] = [];

  for (const day of planned) {
    if (day.status !== "planned") continue;
    if (!isRun(day.type as WorkoutType)) continue;
    await db
      .update(workouts)
      .set({ status: "done", skipReason: null })
      .where(eq(workouts.id, day.id));
    done.push(day.date);
  }

  return done;
}

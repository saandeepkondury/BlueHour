import { desc, eq, isNotNull, lte, and, gte } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { healthDays, type Profile } from "@/drizzle/schema";
import { uid } from "@/lib/auth/current";
import { addDays, daysBetween, formatShort } from "@/lib/date";
import { phaseFor, type Phase, type WorkoutType } from "@/lib/plan/types";

/**
 * The abs goal is a body-fat problem, not a crunches problem — and it competes
 * with half-marathon training for the same calories. Everything here exists to
 * keep that competition honest: a deficit while there is time for it, none when
 * the long runs get real.
 */

/** Roughly where the abdominal wall becomes visible on most people. */
const VISIBLE_FAT_PCT: Record<string, number> = { male: 11, female: 20, unspecified: 13 };

/** kcal in a kilogram of body fat, the usual working figure. */
const KCAL_PER_KG_FAT = 7700;

/** Deficit ceiling by training phase. Peak weeks barely cut; taper does not. */
const PHASE_DEFICIT: Record<Phase, number> = {
  base: 450,
  build: 350,
  specific: 200,
  peak: 150,
  taper: 0,
  race: 0,
};

export interface BodyMeasurement {
  date: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  waistCm: number | null;
}

export type AbsVerdict = "no-data" | "reached" | "on-track" | "tight" | "after-race" | "off";

export interface AbsStatus {
  enabled: boolean;
  /** Measured if a scale reported it, estimated from the waist otherwise. */
  bodyFatPct: number | null;
  bodyFatSource: "measured" | "waist" | null;
  targetPct: number;
  weightKg: number | null;
  kgToLose: number | null;
  weeklyLossKg: number;
  /** Today's calorie allowance below maintenance, after the phase rules. */
  deficitKcal: number;
  deficitNote: string;
  proteinPerKg: number;
  projectedDate: string | null;
  weeksNeeded: number | null;
  verdict: AbsVerdict;
  headline: string;
  measuredAt: string | null;
  trend: { weightKg: number | null; waistCm: number | null; bodyFatPct: number | null; days: number };
}

/**
 * Relative fat mass. Needs only height and waist, which is exactly what a tape
 * measure gives, and tracks DEXA about as well as any field method.
 */
export function estimateBodyFat(sex: string | null, heightCm: number, waistCm: number): number {
  const constant = sex === "female" ? 76 : sex === "male" ? 64 : 70;
  return Math.round((constant - 20 * (heightCm / waistCm)) * 10) / 10;
}

export function targetBodyFatFor(current: Profile): number {
  return current.targetBodyFatPct ?? VISIBLE_FAT_PCT[current.sex ?? "unspecified"] ?? 13;
}

/** Most recent non-null value per field, so a stale waist reading still counts. */
export async function latestMeasurement(onOrBefore: string): Promise<BodyMeasurement | null> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(healthDays)
    .where(and(eq(healthDays.userId, user), lte(healthDays.date, onOrBefore)))
    .orderBy(desc(healthDays.date))
    .limit(120);

  if (rows.length === 0) return null;

  const pick = <K extends "weightKg" | "bodyFatPct" | "waistCm">(key: K): number | null => {
    for (const row of rows) {
      const value = row[key];
      if (value !== null && value !== undefined) return value;
    }
    return null;
  };

  const weightKg = pick("weightKg");
  const bodyFatPct = pick("bodyFatPct");
  const waistCm = pick("waistCm");
  if (weightKg === null && bodyFatPct === null && waistCm === null) return null;

  const dated = rows.find(
    (row) => row.weightKg !== null || row.bodyFatPct !== null || row.waistCm !== null,
  );

  return { date: dated?.date ?? rows[0].date, weightKg, bodyFatPct, waistCm };
}

async function measurementNear(date: string): Promise<BodyMeasurement | null> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(healthDays)
    .where(and(eq(healthDays.userId, user), gte(healthDays.date, addDays(date, -10)), lte(healthDays.date, addDays(date, 10)), isNotNull(healthDays.weightKg)))
    .orderBy(healthDays.date);
  const row = rows[0];
  return row
    ? { date: row.date, weightKg: row.weightKg, bodyFatPct: row.bodyFatPct, waistCm: row.waistCm }
    : null;
}

/**
 * Long and race days are fuelled, never cut — a runner who under-eats before a
 * two-hour effort loses the session and the muscle, which is the opposite of
 * the goal.
 */
export function deficitFor(
  phase: Phase,
  type: WorkoutType,
  absGoal: boolean,
): { kcal: number; note: string } {
  if (!absGoal) return { kcal: 0, note: "Eating at maintenance." };
  if (type === "long" || type === "race" || type === "quality") {
    return {
      kcal: 0,
      note:
        type === "quality"
          ? "Quality day — fuelled fully so the workout has something to burn. The cut waits for tomorrow."
          : "Long-run day — fuelled fully, no deficit. The cut waits for tomorrow.",
    };
  }
  const kcal = PHASE_DEFICIT[phase] ?? 0;
  if (kcal === 0) {
    return {
      kcal: 0,
      note:
        phase === "race"
          ? "Race week. Eat to arrive, not to lean out."
          : "Taper. Holding at maintenance so the last long runs land well.",
    };
  }
  return {
    kcal,
    note:
      phase === "peak" || phase === "specific"
        ? `Small ${kcal} kcal trim only — race fitness takes priority over the mirror.`
        : `${kcal} kcal below maintenance, with protein held high.`,
  };
}

/** A deficit without extra protein is how you lose the muscle instead of the fat. */
export function proteinPerKgFor(deficitKcal: number, type: WorkoutType): number {
  if (deficitKcal >= 300) return 2;
  if (deficitKcal > 0) return 1.9;
  return type === "long" || type === "race" || type === "quality" ? 1.8 : 1.6;
}

export async function absStatus(
  current: Profile,
  today: string,
  context: { phase: Phase; type: WorkoutType },
): Promise<AbsStatus> {
  const absGoal = current.absGoal === 1;
  const target = targetBodyFatFor(current);
  const { kcal: deficitKcal, note: deficitNote } = deficitFor(context.phase, context.type, absGoal);
  const proteinPerKg = proteinPerKgFor(deficitKcal, context.type);

  const latest = await latestMeasurement(today);
  const weightKg = latest?.weightKg ?? current.weightKg ?? null;

  let bodyFatPct: number | null = latest?.bodyFatPct ?? null;
  let bodyFatSource: AbsStatus["bodyFatSource"] = bodyFatPct === null ? null : "measured";
  if (bodyFatPct === null && latest?.waistCm && current.heightCm) {
    bodyFatPct = estimateBodyFat(current.sex, current.heightCm, latest.waistCm);
    bodyFatSource = "waist";
  }

  const past = await measurementNear(addDays(today, -28));
  const trend = {
    weightKg: past?.weightKg != null && weightKg != null ? Math.round((weightKg - past.weightKg) * 10) / 10 : null,
    waistCm:
      past?.waistCm != null && latest?.waistCm != null
        ? Math.round((latest.waistCm - past.waistCm) * 10) / 10
        : null,
    bodyFatPct:
      past?.bodyFatPct != null && bodyFatPct != null
        ? Math.round((bodyFatPct - past.bodyFatPct) * 10) / 10
        : null,
    days: 28,
  };

  const base: AbsStatus = {
    enabled: absGoal,
    bodyFatPct,
    bodyFatSource,
    targetPct: target,
    weightKg,
    kgToLose: null,
    weeklyLossKg: 0,
    deficitKcal,
    deficitNote,
    proteinPerKg,
    projectedDate: null,
    weeksNeeded: null,
    verdict: absGoal ? "no-data" : "off",
    headline: absGoal
      ? "Add your height, and a waist measurement, and this turns into a date."
      : "Abs goal is off. Fuelling at maintenance.",
    measuredAt: latest?.date ?? null,
    trend,
  };

  if (!absGoal || bodyFatPct === null || weightKg === null) return base;

  const fatKg = (weightKg * bodyFatPct) / 100;
  const leanKg = weightKg - fatKg;
  const goalWeight = leanKg / (1 - target / 100);
  const kgToLose = Math.round((weightKg - goalWeight) * 10) / 10;

  if (kgToLose <= 0.2) {
    return {
      ...base,
      kgToLose: 0,
      verdict: "reached",
      headline: `At about ${bodyFatPct}% you are already at the line. Hold here and let training do the rest.`,
    };
  }

  // Walk forward week by week, spending whatever deficit that phase allows.
  const weeksToRace = Math.max(0, Math.ceil(daysBetween(today, current.raceDate) / 7));
  let remaining = kgToLose;
  let weeks = 0;
  let firstWeekLoss = 0;
  while (remaining > 0 && weeks < 78) {
    const out = weeksToRace - weeks;
    const phase = phaseFor(out);
    // Six cutting days a week: the long run gets its calories back.
    const weekly = ((PHASE_DEFICIT[phase] ?? 0) * 6) / KCAL_PER_KG_FAT;
    weeks += 1;
    if (weeks === 1) firstWeekLoss = weekly;
    if (weekly <= 0) continue;
    remaining -= weekly;
  }

  const reachable = remaining <= 0;
  const projectedDate = reachable ? addDays(today, weeks * 7) : null;
  const slack = projectedDate ? daysBetween(projectedDate, current.raceDate) : null;

  const verdict: AbsVerdict =
    !reachable || slack === null ? "after-race" : slack >= 14 ? "on-track" : slack >= 0 ? "tight" : "after-race";

  const headline =
    verdict === "on-track"
      ? `About ${kgToLose} kg of fat to go. At this rate you get there around ${formatShort(projectedDate!)} — comfortably before Austin.`
      : verdict === "tight"
        ? `About ${kgToLose} kg to go, landing near ${formatShort(projectedDate!)}. Close to race day, so the last weeks hold steady rather than cut.`
        : `About ${kgToLose} kg to go. Training comes first from here, so abs arrive after the race rather than before it — that is the right trade.`;

  return {
    ...base,
    kgToLose,
    weeklyLossKg: Math.round(firstWeekLoss * 100) / 100,
    projectedDate,
    weeksNeeded: reachable ? weeks : null,
    verdict,
    headline,
  };
}

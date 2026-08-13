import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import {
  coachSuggestions,
  dayLogs,
  foodLogs,
  fuelChecks,
  groceryChecks,
  healthDays,
  mealPlans,
  strengthSessions,
  supplementLogs,
  workoutLogs,
  workouts,
  type Profile,
} from "@/drizzle/schema";
import { addDays, daysBetween, startOfWeek } from "@/lib/date";
import { computeTargets } from "@/lib/nutrition/targets";
import type { Phase, WorkoutType } from "@/lib/plan/types";
import { absStatus, type AbsStatus } from "@/lib/strength/abs";
import { bannedRecipeIds, fuelOverrides } from "@/lib/settings";
import { ensureWaterCupScale } from "@/lib/store";

/**
 * One flat object describing the last two weeks and the next one. It is both
 * what the rule engine reads and, serialized, what gets sent to OpenAI — so
 * what the model sees is exactly what the app saw.
 */

export interface SnapshotDay {
  date: string;
  phase: Phase;
  type: WorkoutType;
  plannedMi: number;
  status: string;
  skipReason: string | null;
  actualMi: number | null;
  actualMin: number | null;
  avgHr: number | null;
  feel: string | null;
  rpe: number | null;
  source: string | null;
  asleepMin: number | null;
  restingHr: number | null;
  hrvMs: number | null;
  steps: number | null;
  kcalIn: number | null;
  kcalTarget: number;
  proteinIn: number | null;
  proteinTarget: number;
  waterOz: number | null;
  strength: { focus: string; status: string } | null;
  mealsPlanned: number;
  mealsEaten: number;
}

export interface Snapshot {
  today: string;
  race: { name: string; date: string; daysAway: number };
  runner: {
    experience: string;
    goal: string;
    longRunDay: number;
    strengthDays: number;
    absGoal: boolean;
    dietPref: string;
    allergies: string;
    weightKg: number | null;
    heightCm: number | null;
    age: number | null;
    sex: string | null;
  };
  current: { phase: Phase; week: number; weekStart: string; type: WorkoutType; title: string } | null;
  overrides: { calorieDelta: number; proteinFloor: number | null };
  abs: Pick<
    AbsStatus,
    "enabled" | "bodyFatPct" | "bodyFatSource" | "targetPct" | "kgToLose" | "verdict" | "projectedDate" | "trend" | "deficitKcal"
  >;
  totals: {
    plannedMi14: number;
    doneMi14: number;
    plannedMi7: number;
    doneMi7: number;
    runsDone14: number;
    runsPlanned14: number;
    skipped14: number;
    strengthDone14: number;
    strengthPlanned14: number;
    avgSleepMin: number | null;
    restingHrBaseline: number | null;
    restingHrRecent: number | null;
    hrvBaseline: number | null;
    hrvRecent: number | null;
    kcalAdherencePct: number | null;
    proteinAdherencePct: number | null;
    restPlanned14: number;
    restHonored14: number;
    coreDone14: number;
    corePlanned14: number;
    mealsPlanned14: number;
    mealsEaten14: number;
    groceryChecked: number;
    groceryItems: number;
    supplementsTaken14: number;
    fuelChecksDone14: number;
    fuelChecksPlanned14: number;
  };
  intention: {
    race: string;
    physique: string;
    diet: string;
  };
  adherence: {
    byWorkoutType: Record<string, { planned: number; done: number; skipped: number }>;
    restHonored: number;
    restSkipped: number;
    mealsBySlot: Record<string, { planned: number; eaten: number }>;
    favoriteRecipes: { id: string; name: string; eaten: number }[];
    avoidedRecipes: { id: string; name: string; planned: number; eaten: number }[];
    extraFoods: { name: string; times: number }[];
    grocery: { items: number; checked: number; checkedPct: number | null };
    bannedRecipes: string[];
  };
  decisions: { date: string; kind: string; title: string; status: string }[];
  days: SnapshotDay[];
  /** Today plus the next seven days, so advice can name a real date. */
  ahead: { date: string; type: string; mi: number; strength: string | null }[];
  nextWeek: { weekStart: string; longRunMi: number; totalMi: number; days: { date: string; type: string; mi: number }[] };
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const round = (value: number | null, digits = 1): number | null =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

export async function buildSnapshot(current: Profile, today: string): Promise<Snapshot> {
  await ready();
  await ensureWaterCupScale();

  const from = addDays(today, -13);
  const nextStart = addDays(startOfWeek(today), 7);
  const nextEnd = addDays(nextStart, 6);
  const overrides = await fuelOverrides();

  const aheadEnd = addDays(today, 7);
  const weekStart = startOfWeek(today);
  const [
    plan,
    logs,
    health,
    meals,
    extras,
    water,
    strength,
    upcoming,
    aheadPlan,
    aheadStrength,
    grocery,
    fuel,
    supplements,
    history,
    banned,
  ] = await Promise.all([
    db.select().from(workouts).where(and(gte(workouts.date, from), lte(workouts.date, today))).orderBy(workouts.date),
    db.select().from(workoutLogs).where(and(gte(workoutLogs.date, from), lte(workoutLogs.date, today))),
    db.select().from(healthDays).where(and(gte(healthDays.date, from), lte(healthDays.date, today))),
    db.select().from(mealPlans).where(and(gte(mealPlans.date, from), lte(mealPlans.date, today))),
    db.select().from(foodLogs).where(and(gte(foodLogs.date, from), lte(foodLogs.date, today))),
    db.select().from(dayLogs).where(and(gte(dayLogs.date, from), lte(dayLogs.date, today))),
    db
      .select()
      .from(strengthSessions)
      .where(and(gte(strengthSessions.date, from), lte(strengthSessions.date, today))),
    db.select().from(workouts).where(and(gte(workouts.date, nextStart), lte(workouts.date, nextEnd))).orderBy(workouts.date),
    db.select().from(workouts).where(and(gte(workouts.date, today), lte(workouts.date, aheadEnd))).orderBy(workouts.date),
    db
      .select()
      .from(strengthSessions)
      .where(and(gte(strengthSessions.date, today), lte(strengthSessions.date, aheadEnd))),
    db.select().from(groceryChecks).where(eq(groceryChecks.checked, 1)),
    db.select().from(fuelChecks).where(and(gte(fuelChecks.date, from), lte(fuelChecks.date, today))),
    db.select().from(supplementLogs).where(and(gte(supplementLogs.date, from), lte(supplementLogs.date, today))),
    db
      .select({
        date: coachSuggestions.date,
        kind: coachSuggestions.kind,
        title: coachSuggestions.title,
        status: coachSuggestions.status,
      })
      .from(coachSuggestions)
      .where(inArray(coachSuggestions.status, ["applied", "dismissed"]))
      .orderBy(desc(coachSuggestions.decidedAt))
      .limit(15),
    bannedRecipeIds(),
  ]);

  const logByDate = new Map(logs.map((row) => [row.date, row]));
  const healthByDate = new Map(health.map((row) => [row.date, row]));
  const waterByDate = new Map(water.map((row) => [row.date, row]));
  const strengthByDate = new Map(strength.map((row) => [row.date, row]));
  const mealsByDate = new Map<string, { planned: number; eaten: number }>();
  for (const meal of meals) {
    const row = mealsByDate.get(meal.date) ?? { planned: 0, eaten: 0 };
    row.planned += 1;
    if (meal.eaten === 1) row.eaten += 1;
    mealsByDate.set(meal.date, row);
  }

  const intake = new Map<string, { kcal: number; protein: number }>();
  const add = (date: string, kcal: number, protein: number) => {
    const row = intake.get(date) ?? { kcal: 0, protein: 0 };
    row.kcal += kcal;
    row.protein += protein;
    intake.set(date, row);
  };
  for (const meal of meals) if (meal.eaten === 1) add(meal.date, meal.calories, meal.protein);
  for (const extra of extras) add(extra.date, extra.calories, extra.protein);

  const [todayRow] = plan.filter((row) => row.date === today);
  const abs = await absStatus(current, today, {
    phase: (todayRow?.phase ?? "base") as Phase,
    type: (todayRow?.type ?? "rest") as WorkoutType,
  });

  const days: SnapshotDay[] = plan.map((row) => {
    const log = logByDate.get(row.date);
    const vitals = healthByDate.get(row.date);
    const eaten = intake.get(row.date);
    const type = row.type as WorkoutType;
    const targets = computeTargets(
      { weightKg: current.weightKg, heightCm: current.heightCm, age: current.age, sex: current.sex },
      { type, distanceMi: row.distanceMi, durationMin: row.durationMin },
      row.date,
      {
        deficitKcal: abs.deficitKcal - overrides.calorieDelta,
        proteinPerKg: overrides.proteinFloor ?? abs.proteinPerKg,
      },
    );
    const session = strengthByDate.get(row.date);

    return {
      date: row.date,
      phase: row.phase as Phase,
      type,
      plannedMi: row.distanceMi,
      status: row.status,
      skipReason: row.skipReason,
      actualMi: log?.distanceMi ?? null,
      actualMin: log?.durationSec ? Math.round(log.durationSec / 60) : null,
      avgHr: log?.avgHr ?? null,
      feel: log?.feel ?? null,
      rpe: log?.rpe ?? null,
      source: log?.source ?? null,
      asleepMin: vitals?.asleepMin ?? null,
      restingHr: vitals?.restingHr ?? null,
      hrvMs: vitals?.hrvMs === null || vitals?.hrvMs === undefined ? null : Math.round(vitals.hrvMs),
      steps: vitals?.steps ?? null,
      kcalIn: eaten ? Math.round(eaten.kcal) : null,
      kcalTarget: targets.calories,
      proteinIn: eaten ? Math.round(eaten.protein) : null,
      proteinTarget: targets.protein,
      waterOz: waterByDate.get(row.date)?.waterOz ?? null,
      strength: session ? { focus: session.focus, status: session.status } : null,
      mealsPlanned: mealsByDate.get(row.date)?.planned ?? 0,
      mealsEaten: mealsByDate.get(row.date)?.eaten ?? 0,
    };
  });

  const last7 = days.filter((day) => day.date >= addDays(today, -6));
  const runDays = days.filter((day) => day.type !== "rest");
  const older = days.slice(0, Math.max(0, days.length - 4));
  const recent = days.slice(-4);

  const kcalPairs = days.filter((day) => day.kcalIn !== null && day.kcalIn > 0);
  const proteinPairs = kcalPairs;

  const totals: Snapshot["totals"] = {
    plannedMi14: round(days.reduce((sum, day) => sum + day.plannedMi, 0))!,
    doneMi14: round(days.reduce((sum, day) => sum + (day.actualMi ?? 0), 0))!,
    plannedMi7: round(last7.reduce((sum, day) => sum + day.plannedMi, 0))!,
    doneMi7: round(last7.reduce((sum, day) => sum + (day.actualMi ?? 0), 0))!,
    runsDone14: runDays.filter((day) => day.status === "done").length,
    runsPlanned14: runDays.length,
    skipped14: runDays.filter((day) => day.status === "skipped").length,
    strengthDone14: days.filter((day) => day.strength?.status === "done").length,
    strengthPlanned14: days.filter((day) => day.strength !== null).length,
    avgSleepMin: round(mean(days.map((day) => day.asleepMin).filter((v): v is number => v !== null)), 0),
    restingHrBaseline: round(median(older.map((day) => day.restingHr).filter((v): v is number => v !== null)), 0),
    restingHrRecent: round(mean(recent.map((day) => day.restingHr).filter((v): v is number => v !== null)), 0),
    hrvBaseline: round(median(older.map((day) => day.hrvMs).filter((v): v is number => v !== null)), 0),
    hrvRecent: round(mean(recent.map((day) => day.hrvMs).filter((v): v is number => v !== null)), 0),
    kcalAdherencePct: round(
      mean(kcalPairs.map((day) => (day.kcalIn! / Math.max(1, day.kcalTarget)) * 100)),
      0,
    ),
    proteinAdherencePct: round(
      mean(proteinPairs.map((day) => (day.proteinIn! / Math.max(1, day.proteinTarget)) * 100)),
      0,
    ),
    restPlanned14: days.filter((day) => day.type === "rest").length,
    restHonored14: days.filter((day) => day.type === "rest" && day.status === "done").length,
    coreDone14: days.filter((day) => day.strength?.focus === "core" && day.strength.status === "done").length,
    corePlanned14: days.filter((day) => day.strength?.focus === "core").length,
    mealsPlanned14: meals.length,
    mealsEaten14: meals.filter((meal) => meal.eaten === 1).length,
    groceryChecked: grocery.filter((row) => row.checked === 1).length,
    groceryItems: grocery.length,
    supplementsTaken14: supplements.filter((row) => row.taken === 1).length,
    fuelChecksDone14: fuel.filter((row) => row.checked === 1).length,
    fuelChecksPlanned14: fuel.length,
  };

  const mealsBySlot: Record<string, { planned: number; eaten: number }> = {};
  const recipeStats = new Map<string, { id: string; name: string; planned: number; eaten: number }>();
  for (const meal of meals) {
    const slot = mealsBySlot[meal.slot] ?? { planned: 0, eaten: 0 };
    slot.planned += 1;
    if (meal.eaten === 1) slot.eaten += 1;
    mealsBySlot[meal.slot] = slot;

    if (!meal.recipeId) continue;
    const stat = recipeStats.get(meal.recipeId) ?? {
      id: meal.recipeId,
      name: meal.name,
      planned: 0,
      eaten: 0,
    };
    stat.planned += 1;
    if (meal.eaten === 1) stat.eaten += 1;
    recipeStats.set(meal.recipeId, stat);
  }

  const extrasCount = new Map<string, number>();
  for (const extra of extras) {
    const key = extra.name.trim().toLowerCase();
    if (!key) continue;
    extrasCount.set(key, (extrasCount.get(key) ?? 0) + 1);
  }

  const byWorkoutType: Record<string, { planned: number; done: number; skipped: number }> = {};
  for (const day of days) {
    const bucket = byWorkoutType[day.type] ?? { planned: 0, done: 0, skipped: 0 };
    bucket.planned += 1;
    if (day.status === "done") bucket.done += 1;
    if (day.status === "skipped") bucket.skipped += 1;
    byWorkoutType[day.type] = bucket;
  }

  const restDays = days.filter((day) => day.type === "rest");
  const restHonored = restDays.filter((day) => day.status === "done").length;
  const restSkipped = restDays.filter(
    (day) => day.status === "skipped" || (day.actualMi !== null && day.actualMi > 0),
  ).length;

  return {
    today,
    race: {
      name: current.raceName,
      date: current.raceDate,
      daysAway: Math.max(0, daysBetween(today, current.raceDate)),
    },
    runner: {
      experience: current.experience,
      goal: current.goal,
      longRunDay: current.longRunDay,
      strengthDays: current.strengthDays,
      absGoal: current.absGoal === 1,
      dietPref: current.dietPref,
      allergies: current.allergies,
      weightKg: round(current.weightKg),
      heightCm: current.heightCm,
      age: current.age,
      sex: current.sex,
    },
    current: todayRow
      ? {
          phase: todayRow.phase as Phase,
          week: todayRow.week,
          weekStart,
          type: todayRow.type as WorkoutType,
          title: todayRow.title,
        }
      : null,
    overrides,
    abs: {
      enabled: abs.enabled,
      bodyFatPct: abs.bodyFatPct,
      bodyFatSource: abs.bodyFatSource,
      targetPct: abs.targetPct,
      kgToLose: abs.kgToLose,
      verdict: abs.verdict,
      projectedDate: abs.projectedDate,
      trend: abs.trend,
      deficitKcal: abs.deficitKcal,
    },
    totals,
    intention: {
      race: "Austin Half Marathon on February 14, 2027 — finish healthy",
      physique: "Visible abs by race day without starving the training",
      diet: "A diet he will actually eat, shop for, and keep through February",
    },
    adherence: {
      byWorkoutType,
      restHonored,
      restSkipped,
      mealsBySlot,
      favoriteRecipes: [...recipeStats.values()]
        .filter((recipe) => recipe.eaten > 0)
        .sort((a, b) => b.eaten - a.eaten)
        .slice(0, 6)
        .map(({ id, name, eaten }) => ({ id, name, eaten })),
      avoidedRecipes: [...recipeStats.values()]
        .filter((recipe) => recipe.planned >= 2 && recipe.eaten === 0)
        .sort((a, b) => b.planned - a.planned)
        .slice(0, 6),
      extraFoods: [...extrasCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, times]) => ({ name, times })),
      grocery: {
        items: grocery.length,
        checked: grocery.filter((row) => row.checked === 1).length,
        checkedPct:
          grocery.length === 0
            ? null
            : round((grocery.filter((row) => row.checked === 1).length / grocery.length) * 100, 0),
      },
      bannedRecipes: banned,
    },
    decisions: history,
    days,
    ahead: aheadPlan.map((row) => ({
      date: row.date,
      type: row.type,
      mi: row.distanceMi,
      strength: aheadStrength.find((session) => session.date === row.date)?.focus ?? null,
    })),
    nextWeek: {
      weekStart: nextStart,
      longRunMi: upcoming.find((row) => row.type === "long")?.distanceMi ?? 0,
      totalMi: round(upcoming.reduce((sum, row) => sum + row.distanceMi, 0))!,
      days: upcoming.map((row) => ({ date: row.date, type: row.type, mi: row.distanceMi })),
    },
  };
}

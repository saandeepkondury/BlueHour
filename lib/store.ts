import { and, asc, desc, eq, gt, gte, inArray, lt, lte } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import {
  dayLogs,
  foodLogs,
  fuelChecks,
  groceryChecks,
  mealPlans,
  pantryItems,
  profile,
  pushSubscriptions,
  supplementLogs,
  supplementPrefs,
  workoutLogs,
  workouts,
  type MealPlanRow,
  type Profile,
  type Workout,
  type WorkoutLog,
} from "@/drizzle/schema";
import { uid } from "@/lib/auth/current";
import { addDays, startOfWeek, todayISO } from "@/lib/date";
import { generatePlan } from "@/lib/plan/generate";
import type { WorkoutType } from "@/lib/plan/types";
import { sumMacros, type PlannedMeal } from "@/lib/nutrition/meal-plan";
import { normalizeGroceryKey } from "@/lib/nutrition/grocery";
import { candidatesFor, parseAllergies, recipeById, type Diet, type Slot } from "@/lib/nutrition/recipes";
import {
  computeTargets,
  fuelPlan,
  isHeatMonth,
  type DayTargets,
  type FuelStage,
  type TargetAdjust,
} from "@/lib/nutrition/targets";
import { supplementsForDay, type Supplement } from "@/lib/nutrition/supplements";
import { deficitFor, proteinPerKgFor } from "@/lib/strength/abs";
import { ensureStrengthPlan, regenerateStrengthPlan, strengthFor } from "@/lib/strength/plan";
import { checkedExercises, strengthLogFor } from "@/lib/strength/log";
import { recoveryFor, type Recovery } from "@/lib/health/read";
import { bannedRecipeIds, fuelOverrides, getSetting, KEYS, setSetting } from "@/lib/settings";
import { CUP_OZ } from "@/lib/notify/water";
import type { Phase } from "@/lib/plan/types";
import type { StrengthLog, StrengthSession } from "@/drizzle/schema";

/** Placeholders for the row created before onboarding runs. */
export const DEFAULT_PROFILE = {
  raceName: "",
  experience: "beginner",
  goal: "finish",
  longRunDay: 6,
  reminderHour: 6,
} as const;

/** A sensible prefill for the onboarding date field: a full half-marathon runway. */
export function suggestedRaceDate(from = todayISO()): string {
  return addDays(from, 18 * 7);
}

export type Experience = "beginner" | "intermediate" | "advanced";

const EXPERIENCES = new Set<Experience>(["beginner", "intermediate", "advanced"]);

export function parseExperience(value: string | null | undefined): Experience {
  if (value && EXPERIENCES.has(value as Experience)) return value as Experience;
  return "beginner";
}

export function isOnboarded(current: Profile): boolean {
  return Boolean(current.onboardedAt);
}

/**
 * Existing installs already have a training block but never set onboardedAt.
 * Treat a non-empty plan as already through the gate.
 */
async function grandfatherOnboarded(current: Profile): Promise<Profile> {
  if (current.onboardedAt) return current;

  const user = current.userId;
  const rows = await db
    .select({ date: workouts.date })
    .from(workouts)
    .where(eq(workouts.userId, user))
    .limit(1);
  if (rows.length === 0) return current;

  const onboardedAt = new Date().toISOString();
  await db
    .update(profile)
    .set({ onboardedAt, updatedAt: onboardedAt })
    .where(eq(profile.userId, user));
  return { ...current, onboardedAt, updatedAt: onboardedAt };
}

/**
 * Creates the signed-in runner's profile row on first use. Does not generate
 * the 28-week block — that waits for intentional onboarding.
 */
export async function getProfile(): Promise<Profile> {
  await ready();
  const user = await uid();

  const [existing] = await db.select().from(profile).where(eq(profile.userId, user));
  if (existing) {
    const current = await grandfatherOnboarded(existing);
    if (isOnboarded(current)) {
      await ensureStrengthPlan(current);
    }
    return current;
  }

  // A layout and its page render at the same time, so two calls can both find
  // no profile. Doing nothing on conflict lets whichever insert loses the race
  // fall through to reading the row the winner wrote.
  const startDate = todayISO();
  await db
    .insert(profile)
    .values({
      ...DEFAULT_PROFILE,
      userId: user,
      raceDate: suggestedRaceDate(startDate),
      startDate,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: profile.userId });

  const [created] = await db.select().from(profile).where(eq(profile.userId, user));
  return created;
}

export interface OnboardingInput {
  raceName: string;
  raceDate: string;
  experience: Experience;
  goal: string;
  longRunDay: number;
  timeGoalSec?: number | null;
}

/** Saves race setup and builds the 28-week block. Call only from onboarding. */
export async function completeOnboarding(input: OnboardingInput): Promise<Profile> {
  await ready();
  const user = await uid();
  await getProfile();

  const startDate = todayISO();
  const onboardedAt = new Date().toISOString();
  await db
    .update(profile)
    .set({
      raceName: input.raceName,
      raceDate: input.raceDate,
      experience: input.experience,
      goal: input.goal,
      longRunDay: input.longRunDay,
      timeGoalSec: input.timeGoalSec ?? null,
      startDate,
      onboardedAt,
      updatedAt: onboardedAt,
    })
    .where(eq(profile.userId, user));

  const [after] = await db.select().from(profile).where(eq(profile.userId, user));
  await regeneratePlan(after);
  await regenerateStrengthPlan(after);
  return after;
}

export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  await ready();
  const user = await uid();
  const before = await getProfile();

  // userId is never patchable — a profile cannot change hands.
  const { userId: _ignored, id: _id, ...safe } = patch;

  await db
    .update(profile)
    .set({ ...safe, updatedAt: new Date().toISOString() })
    .where(eq(profile.userId, user));
  const after = await getProfile();

  const scheduleChanged =
    before.raceDate !== after.raceDate ||
    before.startDate !== after.startDate ||
    before.longRunDay !== after.longRunDay;

  if (scheduleChanged) await regeneratePlan(after);
  if (
    scheduleChanged ||
    before.strengthDays !== after.strengthDays ||
    before.absGoal !== after.absGoal
  ) {
    await regenerateStrengthPlan(after);
  }
  return after;
}

/**
 * How the abs goal bends today's fuelling: a phase-appropriate deficit, any
 * coach override on top, and a protein floor that protects muscle while cutting.
 */
export async function fuelAdjustFor(
  current: Profile,
  day: { phase: string; type: WorkoutType },
): Promise<{ adjust: TargetAdjust; note: string }> {
  const overrides = await fuelOverrides();
  const { kcal, note } = deficitFor(day.phase as Phase, day.type, current.absGoal === 1);
  return {
    adjust: {
      deficitKcal: kcal - overrides.calorieDelta,
      proteinPerKg: overrides.proteinFloor ?? proteinPerKgFor(kcal, day.type),
    },
    note:
      overrides.calorieDelta === 0
        ? note
        : `${note} Coach adjustment of ${overrides.calorieDelta > 0 ? "+" : ""}${overrides.calorieDelta} kcal is applied.`,
  };
}

export async function seedPlan(current: Profile): Promise<void> {
  await ready();
  const seeds = generatePlan({
    startDate: current.startDate,
    raceDate: current.raceDate,
    longRunDay: current.longRunDay,
    experience: parseExperience(current.experience),
    raceName: current.raceName,
  });
  if (seeds.length === 0) return;

  for (const seed of seeds) {
    await db
      .insert(workouts)
      .values({ ...seed, userId: current.userId })
      .onConflictDoNothing({ target: [workouts.userId, workouts.date] });
  }

  await ensureStrengthPlan(current);
}

/** Rebuilds everything from today forward, leaving logged history untouched. */
export async function regeneratePlan(current: Profile): Promise<void> {
  await ready();
  const today = todayISO();

  await db
    .delete(workouts)
    .where(
      and(
        eq(workouts.userId, current.userId),
        gte(workouts.date, today),
        eq(workouts.status, "planned"),
      ),
    );
  await db
    .delete(workouts)
    .where(and(eq(workouts.userId, current.userId), gt(workouts.date, current.raceDate)));

  await seedPlan(current);
}

export async function getWorkout(date: string): Promise<Workout | undefined> {
  await ready();
  const user = await uid();
  const [row] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, user), eq(workouts.date, date)));
  return row;
}

export async function getWorkouts(from: string, to: string): Promise<Workout[]> {
  await ready();
  const user = await uid();
  return db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, user), gte(workouts.date, from), lte(workouts.date, to)))
    .orderBy(asc(workouts.date));
}

export async function getAllWorkouts(): Promise<Workout[]> {
  await ready();
  const user = await uid();
  return db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, user))
    .orderBy(asc(workouts.date));
}

export async function getWorkoutLog(date: string): Promise<WorkoutLog | undefined> {
  await ready();
  const user = await uid();
  const [row] = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.userId, user), eq(workoutLogs.date, date)));
  return row;
}

export async function getWorkoutLogs(from: string, to: string): Promise<WorkoutLog[]> {
  await ready();
  const user = await uid();
  return db
    .select()
    .from(workoutLogs)
    .where(
      and(eq(workoutLogs.userId, user), gte(workoutLogs.date, from), lte(workoutLogs.date, to)),
    )
    .orderBy(asc(workoutLogs.date));
}

export async function getAllWorkoutLogs(): Promise<WorkoutLog[]> {
  await ready();
  const user = await uid();
  const [row] = await db
    .select({ startDate: profile.startDate })
    .from(profile)
    .where(eq(profile.userId, user));

  if (row?.startDate) {
    await pruneWorkoutLogsBefore(row.startDate);
    return db
      .select()
      .from(workoutLogs)
      .where(and(eq(workoutLogs.userId, user), gte(workoutLogs.date, row.startDate)))
      .orderBy(asc(workoutLogs.date));
  }
  return db
    .select()
    .from(workoutLogs)
    .where(eq(workoutLogs.userId, user))
    .orderBy(asc(workoutLogs.date));
}

/**
 * Drop Watch / manual run logs from before the training block started.
 * HealthKit can still send older workouts; we do not keep them in the app.
 */
export async function pruneWorkoutLogsBefore(startDate: string): Promise<number> {
  await ready();
  const user = await uid();
  const removed = await db
    .delete(workoutLogs)
    .where(and(eq(workoutLogs.userId, user), lt(workoutLogs.date, startDate)))
    .returning({ date: workoutLogs.date });
  return removed.length;
}

/** Logged runs on or after the profile start date, oldest first. */
export async function getTrainingWorkoutLogs(): Promise<WorkoutLog[]> {
  return getAllWorkoutLogs();
}

export async function saveWorkoutLog(entry: {
  date: string;
  distanceMi: number;
  durationSec: number | null;
  rpe: number | null;
  feel: string | null;
  notes: string | null;
}): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .insert(workoutLogs)
    .values({ ...entry, userId: user, createdAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: [workoutLogs.userId, workoutLogs.date],
      set: {
        distanceMi: entry.distanceMi,
        durationSec: entry.durationSec,
        rpe: entry.rpe,
        feel: entry.feel,
        notes: entry.notes,
        source: "manual",
      },
    });
}

/**
 * Felt / effort / notes on top of an Apple Watch (or other) log without
 * touching miles, time, HR, or source.
 */
export async function annotateWorkoutLog(entry: {
  date: string;
  rpe: number | null;
  feel: string | null;
  notes: string | null;
}): Promise<boolean> {
  await ready();
  const user = await uid();
  const existing = await getWorkoutLog(entry.date);
  if (!existing) return false;
  if (!(existing.distanceMi > 0 || (existing.durationSec ?? 0) > 0)) return false;

  await db
    .update(workoutLogs)
    .set({
      rpe: entry.rpe,
      feel: entry.feel,
      notes: entry.notes,
    })
    .where(and(eq(workoutLogs.userId, user), eq(workoutLogs.date, entry.date)));
  return true;
}

// ---------- nutrition ----------

/** Catalog marker — pantry-first: days stay empty until the runner assigns dishes. */
const MEALS_CATALOG_VERSION = "meal-prep-v1";

/** Prevents re-entry while catalog sync is in progress, per account. */
const mealsCatalogSyncing = new Set<string>();

/**
 * One-shot per account: wipe planned meals that reference removed recipes, clear
 * every week after the current one, and leave this week empty for pantry-first
 * picks.
 */
export async function syncMealsToCurrentCatalog(): Promise<void> {
  await ready();
  const user = await uid();
  if (mealsCatalogSyncing.has(user)) return;

  const currentVersion = await getSetting(KEYS.mealsCatalogVersion);
  if (currentVersion === MEALS_CATALOG_VERSION) return;

  mealsCatalogSyncing.add(user);
  try {
    const weekStart = startOfWeek(todayISO());
    const weekEnd = addDays(weekStart, 6);

    // Future weeks stay empty — runner fills them by hand.
    await db
      .delete(mealPlans)
      .where(and(eq(mealPlans.userId, user), gt(mealPlans.date, weekEnd)));

    // Drop anything pointing at a recipe that is no longer in the catalog.
    const stale = await db
      .select({ id: mealPlans.id, recipeId: mealPlans.recipeId })
      .from(mealPlans)
      .where(eq(mealPlans.userId, user));
    const staleIds = stale
      .filter((row) => !row.recipeId || !recipeById(row.recipeId))
      .map((row) => row.id);
    if (staleIds.length > 0) {
      await db
        .delete(mealPlans)
        .where(and(eq(mealPlans.userId, user), inArray(mealPlans.id, staleIds)));
    }

    // Clear this week — meals are chosen from Can cook now / the picker, not auto-filled.
    await db
      .delete(mealPlans)
      .where(
        and(
          eq(mealPlans.userId, user),
          gte(mealPlans.date, weekStart),
          lte(mealPlans.date, weekEnd),
        ),
      );

    await setSetting(KEYS.mealsCatalogVersion, MEALS_CATALOG_VERSION);
  } finally {
    mealsCatalogSyncing.delete(user);
  }
}

export async function ensureMealPlan(
  date: string,
  current: Profile,
  workout: Pick<Workout, "type" | "distanceMi" | "durationMin">,
  targets: DayTargets,
  excludeIds?: string[],
): Promise<MealPlanRow[]> {
  await ready();
  await syncMealsToCurrentCatalog();
  const user = await uid();

  // Pantry-first: never auto-fill slots. The runner assigns from Can cook now
  // or the meal picker. (Args kept for call-site compatibility.)
  void current;
  void workout;
  void targets;
  void excludeIds;

  return db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.userId, user), eq(mealPlans.date, date)))
    .orderBy(asc(mealPlans.id));
}

/** Repicks every meal the runner has not eaten yet, so a stale week can be refreshed. */
export async function reshuffleWeekMeals(weekStart: string): Promise<void> {
  await ready();
  const user = await uid();
  const current = await getProfile();
  const allergies = parseAllergies(current.allergies);
  const diet = current.dietPref as Diet;
  const excludeIds = await bannedRecipeIds();

  const rows = await db
    .select()
    .from(mealPlans)
    .where(
      and(
        eq(mealPlans.userId, user),
        gte(mealPlans.date, weekStart),
        lte(mealPlans.date, addDays(weekStart, 6)),
        eq(mealPlans.eaten, 0),
      ),
    );

  for (const row of rows) {
    const options = candidatesFor(row.slot as Slot, diet, allergies, excludeIds).filter(
      (option) => option.id !== row.recipeId,
    );
    if (options.length === 0) continue;

    const next = options[Math.floor(Math.random() * options.length)];
    await db
      .update(mealPlans)
      .set({
        recipeId: next.id,
        name: next.name,
        calories: next.calories,
        protein: next.protein,
        carbs: next.carbs,
        fat: next.fat,
      })
      .where(and(eq(mealPlans.userId, user), eq(mealPlans.id, row.id)));
  }
}

export async function setMealEaten(date: string, slot: string, eaten: boolean): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .update(mealPlans)
    .set({ eaten: eaten ? 1 : 0 })
    .where(
      and(eq(mealPlans.userId, user), eq(mealPlans.date, date), eq(mealPlans.slot, slot)),
    );
}

export async function replaceMeal(date: string, slot: string, meal: PlannedMeal): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .insert(mealPlans)
    .values({
      userId: user,
      date,
      slot,
      recipeId: meal.recipeId,
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      eaten: 0,
    })
    .onConflictDoUpdate({
      target: [mealPlans.userId, mealPlans.date, mealPlans.slot],
      set: {
        recipeId: meal.recipeId,
        name: meal.name,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        eaten: 0,
      },
    });
}

export async function removeMealSlot(date: string, slot: string): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .delete(mealPlans)
    .where(
      and(eq(mealPlans.userId, user), eq(mealPlans.date, date), eq(mealPlans.slot, slot)),
    );
}

export async function clearMealPlan(from: string, to: string): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .delete(mealPlans)
    .where(
      and(
        eq(mealPlans.userId, user),
        gte(mealPlans.date, from),
        lte(mealPlans.date, to),
        eq(mealPlans.eaten, 0),
      ),
    );
}

export async function getFoodLogs(date: string) {
  await ready();
  const user = await uid();
  return db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, user), eq(foodLogs.date, date)))
    .orderBy(desc(foodLogs.id));
}

/** Days with eaten meals or extra foods logged, newest first. No day cap. */
export interface MealHistoryDay {
  date: string;
  meals: number;
  extras: number;
  calories: number;
  protein: number;
}

export async function getMealHistory(): Promise<MealHistoryDay[]> {
  await ready();
  const user = await uid();
  const [eaten, extras] = await Promise.all([
    db
      .select()
      .from(mealPlans)
      .where(and(eq(mealPlans.userId, user), eq(mealPlans.eaten, 1)))
      .orderBy(desc(mealPlans.date)),
    db.select().from(foodLogs).where(eq(foodLogs.userId, user)).orderBy(desc(foodLogs.date)),
  ]);

  const byDate = new Map<string, MealHistoryDay>();
  for (const meal of eaten) {
    const row = byDate.get(meal.date) ?? {
      date: meal.date,
      meals: 0,
      extras: 0,
      calories: 0,
      protein: 0,
    };
    row.meals += 1;
    row.calories += meal.calories;
    row.protein += meal.protein;
    byDate.set(meal.date, row);
  }
  for (const food of extras) {
    const row = byDate.get(food.date) ?? {
      date: food.date,
      meals: 0,
      extras: 0,
      calories: 0,
      protein: 0,
    };
    row.extras += 1;
    row.calories += food.calories;
    row.protein += food.protein;
    byDate.set(food.date, row);
  }

  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function addFoodLog(entry: {
  date: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .insert(foodLogs)
    .values({ ...entry, userId: user, createdAt: new Date().toISOString() });
}

export async function deleteFoodLog(id: number): Promise<void> {
  await ready();
  const user = await uid();
  await db.delete(foodLogs).where(and(eq(foodLogs.userId, user), eq(foodLogs.id, id)));
}

/**
 * One-shot per account: every logged cup was stored as the previous cup size
 * (8 oz). Remap totals so cup count is preserved at the current CUP_OZ.
 */
const waterCupMigrating = new Map<string, Promise<void>>();

/** Runs once per account until settings.water_cup_oz matches CUP_OZ. */
export async function ensureWaterCupScale(): Promise<void> {
  await ready();
  const user = await uid();

  const inFlight = waterCupMigrating.get(user);
  if (inFlight) return inFlight;

  const run = (async () => {
    const raw = await getSetting(KEYS.waterCupOz);
    // Unset = legacy 8 oz cups from before CUP_OZ was configurable.
    const fromOz = raw === null ? 8 : Number(raw);
    if (!Number.isFinite(fromOz) || fromOz <= 0 || fromOz === CUP_OZ) {
      if (raw === null) await setSetting(KEYS.waterCupOz, String(CUP_OZ));
      return;
    }

    const rows = await db
      .select()
      .from(dayLogs)
      .where(and(eq(dayLogs.userId, user), gt(dayLogs.waterOz, 0)));
    for (const row of rows) {
      const next = Math.round((row.waterOz * CUP_OZ) / fromOz);
      if (next === row.waterOz) continue;
      await db
        .update(dayLogs)
        .set({ waterOz: next })
        .where(and(eq(dayLogs.userId, user), eq(dayLogs.date, row.date)));
    }
    await setSetting(KEYS.waterCupOz, String(CUP_OZ));
  })();

  waterCupMigrating.set(user, run);
  try {
    await run;
  } finally {
    waterCupMigrating.delete(user);
  }
}

export async function getDayLog(date: string) {
  await ensureWaterCupScale();
  const user = await uid();
  const [row] = await db
    .select()
    .from(dayLogs)
    .where(and(eq(dayLogs.userId, user), eq(dayLogs.date, date)));
  return row ?? { userId: user, date, waterOz: 0, sodiumMg: 0, notes: null };
}

export async function addWater(date: string, oz: number): Promise<void> {
  const current = await getDayLog(date);
  const user = await uid();
  const next = Math.max(0, current.waterOz + oz);
  await db
    .insert(dayLogs)
    .values({ userId: user, date, waterOz: next, sodiumMg: current.sodiumMg })
    .onConflictDoUpdate({
      target: [dayLogs.userId, dayLogs.date],
      set: { waterOz: next },
    });
}

export async function getDayLogs(from: string, to: string) {
  await ensureWaterCupScale();
  const user = await uid();
  return db
    .select()
    .from(dayLogs)
    .where(and(eq(dayLogs.userId, user), gte(dayLogs.date, from), lte(dayLogs.date, to)));
}

/** Days with any water logged, newest first. */
export async function getWaterHistory() {
  await ensureWaterCupScale();
  const user = await uid();
  return db
    .select()
    .from(dayLogs)
    .where(and(eq(dayLogs.userId, user), gt(dayLogs.waterOz, 0)))
    .orderBy(desc(dayLogs.date));
}

// ---------- grocery (per-account buy list) ----------

/** Sentinel weekStart so shopping checks persist across weeks. */
export const GLOBAL_GROCERY_WEEK = "global";

/**
 * Items on the persistent shopping list.
 * Merges the global sentinel row with any legacy week-scoped checks.
 */
export async function getGroceryChecks(_weekStart?: string): Promise<Set<string>> {
  await ready();
  const user = await uid();
  void _weekStart;
  const rows = await db
    .select()
    .from(groceryChecks)
    .where(and(eq(groceryChecks.userId, user), eq(groceryChecks.checked, 1)));
  return new Set(rows.map((row) => normalizeGroceryKey(row.itemKey)));
}

/** Marks an item on the persistent shopping list. Does not touch the pantry. */
export async function toggleGroceryCheck(
  _weekStart: string | undefined,
  itemKey: string,
  checked: boolean,
): Promise<void> {
  await ready();
  const user = await uid();
  const key = normalizeGroceryKey(itemKey);
  void _weekStart;

  // Collapse legacy week rows + alias keys for this identity into the global list.
  const allRows = await db.select().from(groceryChecks).where(eq(groceryChecks.userId, user));
  for (const row of allRows) {
    if (normalizeGroceryKey(row.itemKey) === key) {
      await db
        .delete(groceryChecks)
        .where(
          and(
            eq(groceryChecks.userId, user),
            eq(groceryChecks.weekStart, row.weekStart),
            eq(groceryChecks.itemKey, row.itemKey),
          ),
        );
    }
  }

  await db
    .insert(groceryChecks)
    .values({
      userId: user,
      weekStart: GLOBAL_GROCERY_WEEK,
      itemKey: key,
      checked: checked ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: [groceryChecks.userId, groceryChecks.weekStart, groceryChecks.itemKey],
      set: { checked: checked ? 1 : 0 },
    });
}

export async function resetGroceryChecks(_weekStart?: string): Promise<void> {
  await ready();
  const user = await uid();
  void _weekStart;
  await db.delete(groceryChecks).where(eq(groceryChecks.userId, user));
}

// ---------- pantry (at home) ----------

export async function getPantryHaveKeys(): Promise<Set<string>> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(pantryItems)
    .where(and(eq(pantryItems.userId, user), eq(pantryItems.haveAtHome, 1)));
  return new Set(rows.map((row) => normalizeGroceryKey(row.itemKey)));
}

export async function setPantryHave(itemKey: string, have: boolean): Promise<void> {
  await ready();
  const user = await uid();
  const key = normalizeGroceryKey(itemKey);
  const updatedAt = new Date().toISOString();

  // Clear every stored spelling / legacy unit key for this identity.
  const rows = await db.select().from(pantryItems).where(eq(pantryItems.userId, user));
  for (const row of rows) {
    if (row.itemKey === key || normalizeGroceryKey(row.itemKey) === key) {
      await db
        .delete(pantryItems)
        .where(and(eq(pantryItems.userId, user), eq(pantryItems.itemKey, row.itemKey)));
    }
  }

  if (!have) return;

  await db
    .insert(pantryItems)
    .values({ userId: user, itemKey: key, haveAtHome: 1, updatedAt })
    .onConflictDoUpdate({
      target: [pantryItems.userId, pantryItems.itemKey],
      set: { haveAtHome: 1, updatedAt },
    });
}

// ---------- supplements ----------

export async function getDisabledSupplements(): Promise<Set<string>> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(supplementPrefs)
    .where(and(eq(supplementPrefs.userId, user), eq(supplementPrefs.enabled, 0)));
  return new Set(rows.map((row) => row.id));
}

export async function setSupplementEnabled(id: string, enabled: boolean): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .insert(supplementPrefs)
    .values({ userId: user, id, enabled: enabled ? 1 : 0 })
    .onConflictDoUpdate({
      target: [supplementPrefs.userId, supplementPrefs.id],
      set: { enabled: enabled ? 1 : 0 },
    });
}

export async function getSupplementLog(date: string): Promise<Set<string>> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(supplementLogs)
    .where(
      and(
        eq(supplementLogs.userId, user),
        eq(supplementLogs.date, date),
        eq(supplementLogs.taken, 1),
      ),
    );
  return new Set(rows.map((row) => row.supplementId));
}

export async function toggleSupplementTaken(
  date: string,
  supplementId: string,
  taken: boolean,
): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .insert(supplementLogs)
    .values({ userId: user, date, supplementId, taken: taken ? 1 : 0 })
    .onConflictDoUpdate({
      target: [supplementLogs.userId, supplementLogs.date, supplementLogs.supplementId],
      set: { taken: taken ? 1 : 0 },
    });
}

// ---------- long-run fuel checklist ----------

export async function getFuelChecks(date: string): Promise<Set<string>> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(fuelChecks)
    .where(
      and(eq(fuelChecks.userId, user), eq(fuelChecks.date, date), eq(fuelChecks.checked, 1)),
    );
  return new Set(rows.map((row) => row.stage));
}

export async function toggleFuelCheck(
  date: string,
  stage: string,
  checked: boolean,
): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .insert(fuelChecks)
    .values({ userId: user, date, stage, checked: checked ? 1 : 0 })
    .onConflictDoUpdate({
      target: [fuelChecks.userId, fuelChecks.date, fuelChecks.stage],
      set: { checked: checked ? 1 : 0 },
    });
}

// ---------- push ----------

export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .insert(pushSubscriptions)
    .values({ ...sub, userId: user, createdAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      // A shared browser can move an endpoint between accounts on re-subscribe.
      set: { p256dh: sub.p256dh, auth: sub.auth, userId: user },
    });
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .delete(pushSubscriptions)
    .where(
      and(eq(pushSubscriptions.userId, user), eq(pushSubscriptions.endpoint, endpoint)),
    );
}

export async function listPushSubscriptions() {
  await ready();
  const user = await uid();
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, user));
}

export async function deletePushSubscriptions(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  await ready();
  const user = await uid();
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, user),
        inArray(pushSubscriptions.endpoint, endpoints),
      ),
    );
}

// ---------- day bundle ----------

export interface DayBundle {
  date: string;
  profile: Profile;
  workout: Workout;
  workoutLog: WorkoutLog | undefined;
  targets: DayTargets;
  meals: MealPlanRow[];
  extras: Awaited<ReturnType<typeof getFoodLogs>>;
  consumed: { calories: number; protein: number; carbs: number; fat: number };
  dayLog: { date: string; waterOz: number; sodiumMg: number; notes: string | null };
  fuel: FuelStage[];
  fuelDone: Set<string>;
  fuelNote: string;
  supplements: Supplement[];
  supplementsTaken: Set<string>;
  strength: StrengthSession | null;
  strengthDone: Set<string>;
  strengthLog: StrengthLog | null;
  recovery: Recovery;
}

/** Everything the Today screen needs, in one pass. */
export async function getDayBundle(date: string): Promise<DayBundle | null> {
  const current = await getProfile();
  const workout = await getWorkout(date);
  if (!workout) return null;

  const type = workout.type as WorkoutType;
  const { adjust, note } = await fuelAdjustFor(current, { phase: workout.phase, type });
  const targets = computeTargets(
    {
      weightKg: current.weightKg,
      heightCm: current.heightCm,
      age: current.age,
      sex: current.sex,
    },
    { type, distanceMi: workout.distanceMi, durationMin: workout.durationMin },
    date,
    adjust,
  );

  const meals = await ensureMealPlan(date, current, workout, targets);
  const extras = await getFoodLogs(date);
  const eaten = meals.filter((meal) => meal.eaten === 1);
  const consumed = sumMacros([...eaten, ...extras]);

  const proteinGap = consumed.protein < targets.protein * 0.8;
  const disabled = await getDisabledSupplements();

  return {
    date,
    profile: current,
    workout,
    workoutLog: await getWorkoutLog(date),
    targets,
    meals,
    extras,
    consumed,
    dayLog: await getDayLog(date),
    fuel: fuelPlan(targets, { type, distanceMi: workout.distanceMi }, current.weightKg),
    fuelDone: await getFuelChecks(date),
    fuelNote: note,
    strength: await strengthFor(date),
    strengthDone: await checkedExercises(date),
    strengthLog: await strengthLogFor(date),
    recovery: await recoveryFor(date),
    supplements: supplementsForDay(
      {
        date,
        type: workout.type as WorkoutType,
        runMinutes: targets.runMinutes,
        isRaceWeek: workout.phase === "race",
        heat: isHeatMonth(date),
        proteinGap,
      },
      disabled,
    ),
    supplementsTaken: await getSupplementLog(date),
  };
}

export async function weekRecipeIds(weekStart: string): Promise<(string | null)[]> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(mealPlans)
    .where(
      and(
        eq(mealPlans.userId, user),
        gte(mealPlans.date, weekStart),
        lte(mealPlans.date, addDays(weekStart, 6)),
      ),
    );
  return rows.map((row) => row.recipeId);
}

/** Read-only week meals — no planning side effects. */
export async function getWeekMeals(weekStart: string): Promise<MealPlanRow[]> {
  await ready();
  const user = await uid();
  return db
    .select()
    .from(mealPlans)
    .where(
      and(
        eq(mealPlans.userId, user),
        gte(mealPlans.date, weekStart),
        lte(mealPlans.date, addDays(weekStart, 6)),
      ),
    )
    .orderBy(asc(mealPlans.date), asc(mealPlans.id));
}

/**
 * Ensures a whole week of meals exists. Skips days that already have rows so
 * Fuel tab switches stay cheap after the first visit in a week.
 */
export async function ensureWeekMeals(weekStart: string): Promise<MealPlanRow[]> {
  const { meals } = await loadFuelWeek(weekStart);
  return meals;
}

/** One round-trip bundle for the Fuel week page — profile, workouts, meals, pantry. */
export async function loadFuelWeek(weekStart: string): Promise<{
  profile: Profile;
  workouts: Workout[];
  meals: MealPlanRow[];
  pantry: Set<string>;
}> {
  await ready();
  await syncMealsToCurrentCatalog();

  const weekEnd = addDays(weekStart, 6);
  const [current, days, meals, pantry] = await Promise.all([
    getProfile(),
    getWorkouts(weekStart, weekEnd),
    getWeekMeals(weekStart),
    getPantryHaveKeys(),
  ]);

  // Meals stay empty until assigned from Can cook now or the picker.
  return { profile: current, workouts: days, meals, pantry };
}

export function slotOrder(slot: string): number {
  const order: Slot[] = ["breakfast", "lunch", "dinner", "snack", "fuel_pre", "fuel_during", "fuel_post"];
  return order.indexOf(slot as Slot);
}

export function currentWeek(today = todayISO()): string {
  return startOfWeek(today);
}

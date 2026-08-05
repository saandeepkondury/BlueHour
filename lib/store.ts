import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import {
  dayLogs,
  foodLogs,
  fuelChecks,
  groceryChecks,
  mealPlans,
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
import { addDays, startOfWeek, todayISO } from "@/lib/date";
import { generatePlan } from "@/lib/plan/generate";
import type { WorkoutType } from "@/lib/plan/types";
import { buildDayPlan, sumMacros, type PlannedMeal } from "@/lib/nutrition/meal-plan";
import { candidatesFor, parseAllergies, type Diet, type Slot } from "@/lib/nutrition/recipes";
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
import { fuelOverrides } from "@/lib/settings";
import type { Phase } from "@/lib/plan/types";
import type { StrengthLog, StrengthSession } from "@/drizzle/schema";

export const DEFAULT_PROFILE = {
  id: 1,
  raceName: "Ascension Seton Austin Half Marathon",
  raceDate: "2027-02-14",
  experience: "beginner",
  goal: "finish",
  longRunDay: 6,
  reminderHour: 6,
} as const;

/** Creates the profile row and seeds the block on first use. */
export async function getProfile(): Promise<Profile> {
  await ready();
  const [existing] = await db.select().from(profile).where(eq(profile.id, 1));
  if (existing) {
    // Backfills the strength block for a plan that was built before it existed.
    await ensureStrengthPlan(existing);
    return existing;
  }

  const startDate = todayISO();
  await db.insert(profile).values({
    ...DEFAULT_PROFILE,
    startDate,
    updatedAt: new Date().toISOString(),
  });
  const [created] = await db.select().from(profile).where(eq(profile.id, 1));
  await seedPlan(created);
  return created;
}

export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  await ready();
  const before = await getProfile();
  await db
    .update(profile)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(profile.id, 1));
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
  });
  if (seeds.length === 0) return;

  for (const seed of seeds) {
    await db.insert(workouts).values(seed).onConflictDoNothing({ target: workouts.date });
  }

  await ensureStrengthPlan(current);
}

/** Rebuilds everything from today forward, leaving logged history untouched. */
export async function regeneratePlan(current: Profile): Promise<void> {
  await ready();
  const today = todayISO();

  await db
    .delete(workouts)
    .where(and(gte(workouts.date, today), eq(workouts.status, "planned")));
  await db.delete(workouts).where(sql`${workouts.date} > ${current.raceDate}`);

  await seedPlan(current);
}

export async function getWorkout(date: string): Promise<Workout | undefined> {
  await ready();
  const [row] = await db.select().from(workouts).where(eq(workouts.date, date));
  return row;
}

export async function getWorkouts(from: string, to: string): Promise<Workout[]> {
  await ready();
  return db
    .select()
    .from(workouts)
    .where(and(gte(workouts.date, from), lte(workouts.date, to)))
    .orderBy(asc(workouts.date));
}

export async function getAllWorkouts(): Promise<Workout[]> {
  await ready();
  return db.select().from(workouts).orderBy(asc(workouts.date));
}

export async function getWorkoutLog(date: string): Promise<WorkoutLog | undefined> {
  await ready();
  const [row] = await db.select().from(workoutLogs).where(eq(workoutLogs.date, date));
  return row;
}

export async function getWorkoutLogs(from: string, to: string): Promise<WorkoutLog[]> {
  await ready();
  return db
    .select()
    .from(workoutLogs)
    .where(and(gte(workoutLogs.date, from), lte(workoutLogs.date, to)))
    .orderBy(asc(workoutLogs.date));
}

export async function getAllWorkoutLogs(): Promise<WorkoutLog[]> {
  await ready();
  return db.select().from(workoutLogs).orderBy(asc(workoutLogs.date));
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
  await db
    .insert(workoutLogs)
    .values({ ...entry, createdAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: workoutLogs.date,
      set: {
        distanceMi: entry.distanceMi,
        durationSec: entry.durationSec,
        rpe: entry.rpe,
        feel: entry.feel,
        notes: entry.notes,
      },
    });
}

// ---------- nutrition ----------

export async function ensureMealPlan(
  date: string,
  current: Profile,
  workout: Pick<Workout, "type" | "distanceMi" | "durationMin">,
  targets: DayTargets,
): Promise<MealPlanRow[]> {
  await ready();
  const planned = buildDayPlan({
    date,
    targets,
    workoutType: workout.type as WorkoutType,
    diet: current.dietPref as Diet,
    allergies: parseAllergies(current.allergies),
  });

  // Insert-ignore keeps any meal the runner already swapped or ate.
  for (const meal of planned) {
    await db
      .insert(mealPlans)
      .values({ date, ...meal })
      .onConflictDoNothing();
  }

  return db.select().from(mealPlans).where(eq(mealPlans.date, date)).orderBy(asc(mealPlans.id));
}

/** Repicks every meal the runner has not eaten yet, so a stale week can be refreshed. */
export async function reshuffleWeekMeals(weekStart: string): Promise<void> {
  await ready();
  const current = await getProfile();
  const allergies = parseAllergies(current.allergies);
  const diet = current.dietPref as Diet;

  const rows = await db
    .select()
    .from(mealPlans)
    .where(
      and(
        gte(mealPlans.date, weekStart),
        lte(mealPlans.date, addDays(weekStart, 6)),
        eq(mealPlans.eaten, 0),
      ),
    );

  for (const row of rows) {
    const options = candidatesFor(row.slot as Slot, diet, allergies).filter(
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
      .where(eq(mealPlans.id, row.id));
  }
}

export async function setMealEaten(date: string, slot: string, eaten: boolean): Promise<void> {
  await ready();
  await db
    .update(mealPlans)
    .set({ eaten: eaten ? 1 : 0 })
    .where(and(eq(mealPlans.date, date), eq(mealPlans.slot, slot)));
}

export async function replaceMeal(date: string, slot: string, meal: PlannedMeal): Promise<void> {
  await ready();
  await db
    .update(mealPlans)
    .set({
      recipeId: meal.recipeId,
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      eaten: 0,
    })
    .where(and(eq(mealPlans.date, date), eq(mealPlans.slot, slot)));
}

export async function clearMealPlan(from: string, to: string): Promise<void> {
  await ready();
  await db
    .delete(mealPlans)
    .where(and(gte(mealPlans.date, from), lte(mealPlans.date, to), eq(mealPlans.eaten, 0)));
}

export async function getFoodLogs(date: string) {
  await ready();
  return db.select().from(foodLogs).where(eq(foodLogs.date, date)).orderBy(desc(foodLogs.id));
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
  await db.insert(foodLogs).values({ ...entry, createdAt: new Date().toISOString() });
}

export async function deleteFoodLog(id: number): Promise<void> {
  await ready();
  await db.delete(foodLogs).where(eq(foodLogs.id, id));
}

export async function getDayLog(date: string) {
  await ready();
  const [row] = await db.select().from(dayLogs).where(eq(dayLogs.date, date));
  return row ?? { date, waterOz: 0, sodiumMg: 0, notes: null };
}

export async function addWater(date: string, oz: number): Promise<void> {
  await ready();
  const current = await getDayLog(date);
  const next = Math.max(0, current.waterOz + oz);
  await db
    .insert(dayLogs)
    .values({ date, waterOz: next, sodiumMg: current.sodiumMg })
    .onConflictDoUpdate({ target: dayLogs.date, set: { waterOz: next } });
}

export async function getDayLogs(from: string, to: string) {
  await ready();
  return db
    .select()
    .from(dayLogs)
    .where(and(gte(dayLogs.date, from), lte(dayLogs.date, to)));
}

// ---------- grocery ----------

export async function getGroceryChecks(weekStart: string): Promise<Set<string>> {
  await ready();
  const rows = await db
    .select()
    .from(groceryChecks)
    .where(and(eq(groceryChecks.weekStart, weekStart), eq(groceryChecks.checked, 1)));
  return new Set(rows.map((row) => row.itemKey));
}

export async function toggleGroceryCheck(
  weekStart: string,
  itemKey: string,
  checked: boolean,
): Promise<void> {
  await ready();
  await db
    .insert(groceryChecks)
    .values({ weekStart, itemKey, checked: checked ? 1 : 0 })
    .onConflictDoUpdate({
      target: [groceryChecks.weekStart, groceryChecks.itemKey],
      set: { checked: checked ? 1 : 0 },
    });
}

export async function resetGroceryChecks(weekStart: string): Promise<void> {
  await ready();
  await db.delete(groceryChecks).where(eq(groceryChecks.weekStart, weekStart));
}

// ---------- supplements ----------

export async function getDisabledSupplements(): Promise<Set<string>> {
  await ready();
  const rows = await db.select().from(supplementPrefs).where(eq(supplementPrefs.enabled, 0));
  return new Set(rows.map((row) => row.id));
}

export async function setSupplementEnabled(id: string, enabled: boolean): Promise<void> {
  await ready();
  await db
    .insert(supplementPrefs)
    .values({ id, enabled: enabled ? 1 : 0 })
    .onConflictDoUpdate({ target: supplementPrefs.id, set: { enabled: enabled ? 1 : 0 } });
}

export async function getSupplementLog(date: string): Promise<Set<string>> {
  await ready();
  const rows = await db
    .select()
    .from(supplementLogs)
    .where(and(eq(supplementLogs.date, date), eq(supplementLogs.taken, 1)));
  return new Set(rows.map((row) => row.supplementId));
}

export async function toggleSupplementTaken(
  date: string,
  supplementId: string,
  taken: boolean,
): Promise<void> {
  await ready();
  await db
    .insert(supplementLogs)
    .values({ date, supplementId, taken: taken ? 1 : 0 })
    .onConflictDoUpdate({
      target: [supplementLogs.date, supplementLogs.supplementId],
      set: { taken: taken ? 1 : 0 },
    });
}

// ---------- long-run fuel checklist ----------

export async function getFuelChecks(date: string): Promise<Set<string>> {
  await ready();
  const rows = await db
    .select()
    .from(fuelChecks)
    .where(and(eq(fuelChecks.date, date), eq(fuelChecks.checked, 1)));
  return new Set(rows.map((row) => row.stage));
}

export async function toggleFuelCheck(
  date: string,
  stage: string,
  checked: boolean,
): Promise<void> {
  await ready();
  await db
    .insert(fuelChecks)
    .values({ date, stage, checked: checked ? 1 : 0 })
    .onConflictDoUpdate({
      target: [fuelChecks.date, fuelChecks.stage],
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
  await db
    .insert(pushSubscriptions)
    .values({ ...sub, createdAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh: sub.p256dh, auth: sub.auth },
    });
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await ready();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function listPushSubscriptions() {
  await ready();
  return db.select().from(pushSubscriptions);
}

export async function deletePushSubscriptions(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  await ready();
  await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, endpoints));
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
  const rows = await db
    .select()
    .from(mealPlans)
    .where(and(gte(mealPlans.date, weekStart), lte(mealPlans.date, addDays(weekStart, 6))));
  return rows.map((row) => row.recipeId);
}

/** Ensures a whole week of meals exists, which the Fuel tab and grocery list rely on. */
export async function ensureWeekMeals(weekStart: string): Promise<MealPlanRow[]> {
  const current = await getProfile();
  const days = await getWorkouts(weekStart, addDays(weekStart, 6));

  for (const day of days) {
    const type = day.type as WorkoutType;
    const { adjust } = await fuelAdjustFor(current, { phase: day.phase, type });
    const targets = computeTargets(
      {
        weightKg: current.weightKg,
        heightCm: current.heightCm,
        age: current.age,
        sex: current.sex,
      },
      { type, distanceMi: day.distanceMi, durationMin: day.durationMin },
      day.date,
      adjust,
    );
    await ensureMealPlan(day.date, current, day, targets);
  }

  await ready();
  return db
    .select()
    .from(mealPlans)
    .where(and(gte(mealPlans.date, weekStart), lte(mealPlans.date, addDays(weekStart, 6))))
    .orderBy(asc(mealPlans.date), asc(mealPlans.id));
}

export function slotOrder(slot: string): number {
  const order: Slot[] = ["breakfast", "lunch", "dinner", "snack", "fuel_pre", "fuel_during", "fuel_post"];
  return order.indexOf(slot as Slot);
}

export function currentWeek(today = todayISO()): string {
  return startOfWeek(today);
}

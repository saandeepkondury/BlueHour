import { addDays, daysBetween, formatRange, startOfWeek, todayISO } from "@/lib/date";
import { computeTargets } from "@/lib/nutrition/targets";
import { sumMacros } from "@/lib/nutrition/meal-plan";
import type { WorkoutType } from "@/lib/plan/types";
import {
  getAllWorkoutLogs,
  getAllWorkouts,
  getDayLogs,
  getProfile,
  getWorkouts,
} from "@/lib/store";
import { and, gte, lte, eq } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { foodLogs, mealPlans } from "@/drizzle/schema";
import { uid } from "@/lib/auth/current";

export interface WeekProgress {
  weekStart: string;
  label: string;
  range: string;
  phase: string;
  plannedMi: number;
  loggedMi: number;
  isCurrent: boolean;
  isFuture: boolean;
}

export interface ProgressSummary {
  weeks: WeekProgress[];
  totalMiles: number;
  longestRun: number;
  runsDone: number;
  runsSkipped: number;
  daysHonored: number;
  daysElapsed: number;
  consistencyPct: number;
  streak: number;
  weeksToRace: number;
  nutrition: {
    daysLogged: number;
    avgCalories: number;
    avgProtein: number;
    targetCalories: number;
    targetProtein: number;
    hydrationDays: number;
    windowDays: number;
  };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export async function getProgress(): Promise<ProgressSummary> {
  const current = await getProfile();
  const today = todayISO();
  const allWorkouts = await getAllWorkouts();
  const logs = await getAllWorkoutLogs();

  const logByDate = new Map(logs.map((log) => [log.date, log]));
  const thisWeekStart = startOfWeek(today);

  const weekMap = new Map<string, WeekProgress>();
  for (const workout of allWorkouts) {
    const weekStart = startOfWeek(workout.date);
    const entry = weekMap.get(weekStart) ?? {
      weekStart,
      label: "",
      range: formatRange(weekStart, addDays(weekStart, 6)),
      phase: workout.phase,
      plannedMi: 0,
      loggedMi: 0,
      isCurrent: weekStart === thisWeekStart,
      isFuture: weekStart > thisWeekStart,
    };
    entry.plannedMi += workout.distanceMi;
    entry.loggedMi += logByDate.get(workout.date)?.distanceMi ?? 0;
    entry.phase = workout.phase;
    weekMap.set(weekStart, entry);
  }

  const weeks = [...weekMap.values()]
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .map((week, index) => ({
      ...week,
      label: `Week ${index + 1}`,
      plannedMi: round1(week.plannedMi),
      loggedMi: round1(week.loggedMi),
    }));

  const elapsed = allWorkouts.filter((workout) => workout.date <= today);
  const daysHonored = elapsed.filter((workout) => workout.status === "done").length;
  const runsDone = elapsed.filter(
    (workout) => workout.status === "done" && workout.type !== "rest",
  ).length;
  const runsSkipped = elapsed.filter((workout) => workout.status === "skipped").length;

  // Streak counts consecutive honored days ending today or yesterday.
  let streak = 0;
  for (let cursor = today; ; cursor = addDays(cursor, -1)) {
    const workout = allWorkouts.find((row) => row.date === cursor);
    if (!workout) break;
    if (workout.status === "done") {
      streak += 1;
      continue;
    }
    if (cursor === today && workout.status === "planned") continue;
    break;
  }

  const nutrition = await nutritionWindow(current, today);

  return {
    weeks,
    totalMiles: round1(logs.reduce((sum, log) => sum + log.distanceMi, 0)),
    longestRun: round1(logs.reduce((max, log) => Math.max(max, log.distanceMi), 0)),
    runsDone,
    runsSkipped,
    daysHonored,
    daysElapsed: elapsed.length,
    consistencyPct: elapsed.length === 0 ? 0 : Math.round((daysHonored / elapsed.length) * 100),
    streak,
    weeksToRace: Math.max(0, Math.ceil(daysBetween(today, current.raceDate) / 7)),
    nutrition,
  };
}

async function nutritionWindow(
  current: Awaited<ReturnType<typeof getProfile>>,
  today: string,
): Promise<ProgressSummary["nutrition"]> {
  await ready();
  const user = await uid();
  const windowDays = 7;
  const from = addDays(today, -(windowDays - 1));

  const eatenMeals = await db
    .select()
    .from(mealPlans)
    .where(
      and(
        eq(mealPlans.userId, user),
        gte(mealPlans.date, from),
        lte(mealPlans.date, today),
        eq(mealPlans.eaten, 1),
      ),
    );
  const extras = await db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, user), gte(foodLogs.date, from), lte(foodLogs.date, today)));
  const water = await getDayLogs(from, today);
  const workoutsInWindow = await getWorkouts(from, today);

  const byDate = new Map<string, { calories: number; protein: number }>();
  for (const row of [...eatenMeals, ...extras]) {
    const entry = byDate.get(row.date) ?? { calories: 0, protein: 0 };
    entry.calories += row.calories;
    entry.protein += row.protein;
    byDate.set(row.date, entry);
  }

  const daysLogged = byDate.size;
  const totals = sumMacros(
    [...eatenMeals, ...extras].map((row) => ({
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
    })),
  );

  let targetCalories = 0;
  let targetProtein = 0;
  let hydrationDays = 0;

  for (const workout of workoutsInWindow) {
    const targets = computeTargets(
      {
        weightKg: current.weightKg,
        heightCm: current.heightCm,
        age: current.age,
        sex: current.sex,
      },
      {
        type: workout.type as WorkoutType,
        distanceMi: workout.distanceMi,
        durationMin: workout.durationMin,
      },
      workout.date,
    );
    targetCalories += targets.calories;
    targetProtein += targets.protein;

    const logged = water.find((row) => row.date === workout.date);
    if (logged && logged.waterOz >= targets.waterOz * 0.8) hydrationDays += 1;
  }

  const span = Math.max(1, workoutsInWindow.length);

  return {
    daysLogged,
    avgCalories: daysLogged === 0 ? 0 : Math.round(totals.calories / daysLogged),
    avgProtein: daysLogged === 0 ? 0 : Math.round(totals.protein / daysLogged),
    targetCalories: Math.round(targetCalories / span),
    targetProtein: Math.round(targetProtein / span),
    hydrationDays,
    windowDays,
  };
}

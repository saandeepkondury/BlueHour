import type { WorkoutType } from "@/lib/plan/types";
import type { DayTargets } from "./targets";
import {
  candidatesFor,
  MEAL_SLOTS,
  type Allergen,
  type Diet,
  type Recipe,
  type Slot,
} from "./recipes";

export interface PlannedMeal {
  slot: Slot;
  recipeId: string | null;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Stable per-date/per-slot pick so the same day always plans the same way. */
function seed(date: string, salt: string): number {
  let hash = 2166136261;
  const input = `${date}:${salt}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function pick(list: Recipe[], date: string, salt: string): Recipe {
  return list[seed(date, salt) % list.length];
}

function toMeal(recipe: Recipe): PlannedMeal {
  return {
    slot: recipe.slot,
    recipeId: recipe.id,
    name: recipe.name,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
  };
}

interface BuildInput {
  date: string;
  targets: DayTargets;
  workoutType: WorkoutType;
  diet: Diet;
  allergies: Allergen[];
  excludeIds?: string[];
}

/**
 * Assembles the day: breakfast, lunch, and a snack are rotated deterministically,
 * then dinner is chosen to land closest to the remaining calorie and protein gap.
 * Long runs and race day also get pre / during / post fuel rows.
 */
export function buildDayPlan({
  date,
  targets,
  workoutType,
  diet,
  allergies,
  excludeIds = [],
}: BuildInput): PlannedMeal[] {
  const meals: PlannedMeal[] = [];
  const pool = (slot: Slot) => candidatesFor(slot, diet, allergies, excludeIds);

  const breakfast = pick(pool("breakfast"), date, "breakfast");
  const lunch = pick(pool("lunch"), date, "lunch");
  const snack = pick(pool("snack"), date, "snack");

  meals.push(toMeal(breakfast), toMeal(lunch));

  const fuel: PlannedMeal[] = [];
  if (workoutType === "long" || workoutType === "race") {
    fuel.push(toMeal(pick(pool("fuel_pre"), date, "pre")));
    if (targets.needsDuringFuel) {
      const during = pick(pool("fuel_during"), date, "during");
      const servings = Math.max(1, Math.round(Math.max(0, targets.runMinutes / 60 - 1) * 45 / 25));
      fuel.push({
        ...toMeal(during),
        name: servings > 1 ? `${during.name} × ${servings}` : during.name,
        calories: during.calories * servings,
        carbs: during.carbs * servings,
      });
    }
    fuel.push(toMeal(pick(pool("fuel_post"), date, "post")));
  }

  const committed = [...meals, ...fuel, toMeal(snack)];
  const usedCalories = committed.reduce((sum, meal) => sum + meal.calories, 0);
  const usedProtein = committed.reduce((sum, meal) => sum + meal.protein, 0);

  const dinnerOptions = pool("dinner");
  const remainingCalories = targets.calories - usedCalories;
  const remainingProtein = targets.protein - usedProtein;

  // Protein gaps matter more than calorie gaps for recovery, so weight it heavier.
  const dinner = dinnerOptions.reduce((best, option) => {
    const score = (candidate: Recipe) =>
      Math.abs(candidate.calories - remainingCalories) +
      Math.abs(candidate.protein - remainingProtein) * 8;
    return score(option) < score(best) ? option : best;
  }, dinnerOptions[0]);

  meals.push(toMeal(dinner), toMeal(snack), ...fuel);

  const order: Slot[] = [...MEAL_SLOTS, "fuel_pre", "fuel_during", "fuel_post"];
  return meals.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
}

export function sumMacros(rows: { calories: number; protein: number; carbs: number; fat: number }[]) {
  return rows.reduce(
    (acc, row) => ({
      calories: acc.calories + row.calories,
      protein: acc.protein + row.protein,
      carbs: acc.carbs + row.carbs,
      fat: acc.fat + row.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

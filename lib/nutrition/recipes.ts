import { INSTAGRAM_SAVED_MEALS } from "./instagram-saved-meals";

export type Slot =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "fuel_pre"
  | "fuel_during"
  | "fuel_post";

export type Diet = "vegan" | "vegetarian" | "omnivore";

export type Allergen = "dairy" | "gluten" | "nuts" | "egg" | "soy" | "fish" | "shellfish";

export type Aisle = "produce" | "protein" | "dairy" | "pantry" | "frozen" | "bakery" | "fuel";

export interface Ingredient {
  item: string;
  qty: number;
  unit: string;
  aisle: Aisle;
}

export interface Recipe {
  id: string;
  name: string;
  slot: Slot;
  diet: Diet;
  allergens: Allergen[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  minutes: number;
  note: string;
  steps: string[];
  ingredients: Ingredient[];
  /** Instagram Reel / post (or other) video for the cook-along. */
  videoUrl?: string;
}

export const SLOT_LABEL: Record<Slot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  fuel_pre: "Pre-run fuel",
  fuel_during: "On the run",
  fuel_post: "Recovery",
};

export const MEAL_SLOTS: Slot[] = ["breakfast", "lunch", "dinner", "snack"];

/** Catalog is Instagram-sourced recipes only (see instagram-saved-meals.ts). */
export const RECIPES: Recipe[] = INSTAGRAM_SAVED_MEALS;

const DIET_RANK: Record<Diet, number> = { vegan: 0, vegetarian: 1, omnivore: 2 };

export function recipeById(id: string | null | undefined): Recipe | undefined {
  if (!id) return undefined;
  return RECIPES.find((recipe) => recipe.id === id);
}

export function parseAllergies(input: string): Allergen[] {
  const text = input.toLowerCase();
  const all: Allergen[] = ["dairy", "gluten", "nuts", "egg", "soy", "fish", "shellfish"];
  const hits = all.filter((allergen) => text.includes(allergen));
  // Common phrasings that do not literally contain the tag.
  if (text.includes("lactose") && !hits.includes("dairy")) hits.push("dairy");
  if (text.includes("peanut") && !hits.includes("nuts")) hits.push("nuts");
  if (text.includes("wheat") && !hits.includes("gluten")) hits.push("gluten");
  if (text.includes("shrimp") && !hits.includes("shellfish")) hits.push("shellfish");
  return hits;
}

export function candidatesFor(
  slot: Slot,
  diet: Diet,
  allergies: Allergen[],
  excludeIds: string[] = [],
): Recipe[] {
  const banned = new Set(excludeIds);
  const limit = DIET_RANK[diet];
  const filtered = RECIPES.filter(
    (recipe) =>
      recipe.slot === slot &&
      DIET_RANK[recipe.diet] <= limit &&
      !recipe.allergens.some((allergen) => allergies.includes(allergen)) &&
      !banned.has(recipe.id),
  );
  if (filtered.length > 0) return filtered;
  const withoutBan = RECIPES.filter(
    (recipe) =>
      recipe.slot === slot &&
      DIET_RANK[recipe.diet] <= limit &&
      !recipe.allergens.some((allergen) => allergies.includes(allergen)),
  );
  if (withoutBan.length > 0) return withoutBan;
  // Never leave a slot empty just because the filters were strict.
  return RECIPES.filter((recipe) => recipe.slot === slot);
}

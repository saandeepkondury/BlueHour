import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import {
  ingredientLabels,
  mealEntries,
  userRecipeIngredients,
  userRecipes,
  type MealEntryRow,
} from "@/drizzle/schema";
import { uid } from "@/lib/auth/current";
import { resolveIngredientIdentity } from "@/lib/nutrition/ingredient-identity";
import { RECIPES, recipeById } from "@/lib/nutrition/recipes";
import {
  isMealMark,
  isMealSlot,
  isMealSource,
  MEAL_SLOT_LIST,
  parseAmount,
  parseRecipeRef,
  recipeHref,
  type MealEntry,
  type MealMark,
  type MealSlot,
  type MealSource,
  type RecipeOption,
} from "./catalog";

const SLOT_ORDER = new Map(MEAL_SLOT_LIST.map((slot, index) => [slot.id, index]));

const MAX_NAME = 120;
const MAX_STEPS = 60;
const MAX_STEP_LENGTH = 2000;
const MAX_INGREDIENTS = 80;

function now(): string {
  return new Date().toISOString();
}

function clip(text: string, max: number): string {
  return text.trim().slice(0, max);
}

// ---------- meals ----------

async function hydrate(rows: MealEntryRow[]): Promise<MealEntry[]> {
  const userIds = rows
    .map((row) => parseRecipeRef(row.recipeRef))
    .flatMap((ref) => (ref?.kind === "user" ? [ref.id] : []));
  const names = new Map<number, string>();
  if (userIds.length > 0) {
    const user = await uid();
    const found = await db
      .select({ id: userRecipes.id, name: userRecipes.name })
      .from(userRecipes)
      .where(and(eq(userRecipes.userId, user), inArray(userRecipes.id, [...new Set(userIds)])));
    for (const row of found) names.set(row.id, row.name);
  }

  return rows.map((row) => {
    const ref = parseRecipeRef(row.recipeRef);
    const catalog = ref?.kind === "catalog" ? recipeById(ref.id) : undefined;
    const userName = ref?.kind === "user" ? names.get(ref.id) : undefined;
    const linked = Boolean(catalog || userName);
    return {
      id: row.id,
      date: row.date,
      slot: isMealSlot(row.slot) ? row.slot : "snack",
      name: row.name,
      photoUrl: row.photoUrl,
      source: isMealSource(row.source) ? row.source : "home",
      mark: isMealMark(row.mark) ? row.mark : null,
      starred: row.starred === 1,
      recipeRef: linked ? row.recipeRef : null,
      recipeName: catalog?.name ?? userName ?? null,
      recipeHref: linked && ref ? recipeHref(ref) : null,
      calories: catalog?.calories ?? 0,
      protein: catalog?.protein ?? 0,
      carbs: catalog?.carbs ?? 0,
      fat: catalog?.fat ?? 0,
    };
  });
}

function bySlot(a: MealEntry, b: MealEntry): number {
  return (SLOT_ORDER.get(a.slot) ?? 9) - (SLOT_ORDER.get(b.slot) ?? 9) || a.id - b.id;
}

export async function getMealsForDate(date: string): Promise<MealEntry[]> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(mealEntries)
    .where(and(eq(mealEntries.userId, user), eq(mealEntries.date, date)))
    .orderBy(asc(mealEntries.id));
  return (await hydrate(rows)).sort(bySlot);
}

export async function getMealsBetween(from: string, to: string): Promise<MealEntry[]> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(mealEntries)
    .where(and(eq(mealEntries.userId, user), gte(mealEntries.date, from), lte(mealEntries.date, to)))
    .orderBy(asc(mealEntries.date), asc(mealEntries.id));
  return hydrate(rows);
}

export async function getMeal(id: number): Promise<MealEntry | null> {
  await ready();
  const user = await uid();
  const [row] = await db
    .select()
    .from(mealEntries)
    .where(and(eq(mealEntries.userId, user), eq(mealEntries.id, id)));
  if (!row) return null;
  const [meal] = await hydrate([row]);
  return meal ?? null;
}

export async function getStarredMeals(): Promise<MealEntry[]> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(mealEntries)
    .where(and(eq(mealEntries.userId, user), eq(mealEntries.starred, 1)))
    .orderBy(desc(mealEntries.date), desc(mealEntries.id));
  return hydrate(rows);
}

export async function getMealsForRecipe(ref: string): Promise<MealEntry[]> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(mealEntries)
    .where(and(eq(mealEntries.userId, user), eq(mealEntries.recipeRef, ref)))
    .orderBy(desc(mealEntries.date), desc(mealEntries.id));
  return hydrate(rows);
}

export interface MealHistoryDay {
  date: string;
  meals: number;
  starred: number;
  home: number;
  prepped: number;
  out: number;
  healthy: number;
  cheat: number;
  photos: string[];
}

/** Every day with a logged meal, newest first. */
export async function getMealHistory(): Promise<MealHistoryDay[]> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(mealEntries)
    .where(eq(mealEntries.userId, user))
    .orderBy(desc(mealEntries.date), asc(mealEntries.id));

  const byDate = new Map<string, MealHistoryDay>();
  for (const row of rows) {
    const day = byDate.get(row.date) ?? {
      date: row.date,
      meals: 0,
      starred: 0,
      home: 0,
      prepped: 0,
      out: 0,
      healthy: 0,
      cheat: 0,
      photos: [],
    };
    day.meals += 1;
    if (row.starred === 1) day.starred += 1;
    if (isMealSource(row.source)) day[row.source] += 1;
    if (isMealMark(row.mark)) day[row.mark] += 1;
    if (row.photoUrl && day.photos.length < 4) day.photos.push(row.photoUrl);
    byDate.set(row.date, day);
  }
  return [...byDate.values()];
}

export interface MealInput {
  date: string;
  slot: MealSlot;
  name: string;
  source: MealSource;
  mark: MealMark | null;
  recipeRef: string | null;
  photoUrl?: string | null;
}

/** Drops a recipe link that does not point at a real recipe on this account. */
async function checkedRecipeRef(ref: string | null): Promise<string | null> {
  const parsed = parseRecipeRef(ref);
  if (!parsed) return null;
  if (parsed.kind === "catalog") return recipeById(parsed.id) ? ref : null;
  const user = await uid();
  const [row] = await db
    .select({ id: userRecipes.id })
    .from(userRecipes)
    .where(and(eq(userRecipes.userId, user), eq(userRecipes.id, parsed.id)));
  return row ? ref : null;
}

export async function createMeal(input: MealInput): Promise<number> {
  await ready();
  const user = await uid();
  const stamp = now();
  const [row] = await db
    .insert(mealEntries)
    .values({
      userId: user,
      date: input.date,
      slot: input.slot,
      name: clip(input.name, MAX_NAME),
      photoUrl: input.photoUrl ?? null,
      source: input.source,
      mark: input.mark,
      recipeRef: await checkedRecipeRef(input.recipeRef),
      starred: 0,
      createdAt: stamp,
      updatedAt: stamp,
    })
    .returning({ id: mealEntries.id });
  return row.id;
}

export async function updateMeal(id: number, input: Omit<MealInput, "date" | "photoUrl">): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .update(mealEntries)
    .set({
      slot: input.slot,
      name: clip(input.name, MAX_NAME),
      source: input.source,
      mark: input.mark,
      recipeRef: await checkedRecipeRef(input.recipeRef),
      updatedAt: now(),
    })
    .where(and(eq(mealEntries.userId, user), eq(mealEntries.id, id)));
}

/** Swaps the photo and returns the old URL so the caller can delete it. */
export async function setMealPhoto(id: number, photoUrl: string | null): Promise<string | null> {
  await ready();
  const user = await uid();
  const [row] = await db
    .select({ photoUrl: mealEntries.photoUrl })
    .from(mealEntries)
    .where(and(eq(mealEntries.userId, user), eq(mealEntries.id, id)));
  if (!row) return photoUrl;
  await db
    .update(mealEntries)
    .set({ photoUrl, updatedAt: now() })
    .where(and(eq(mealEntries.userId, user), eq(mealEntries.id, id)));
  return row.photoUrl;
}

export async function linkMealRecipe(id: number, ref: string): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .update(mealEntries)
    .set({ recipeRef: await checkedRecipeRef(ref), updatedAt: now() })
    .where(and(eq(mealEntries.userId, user), eq(mealEntries.id, id)));
}

export async function setMealStar(id: number, starred: boolean): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .update(mealEntries)
    .set({ starred: starred ? 1 : 0, updatedAt: now() })
    .where(and(eq(mealEntries.userId, user), eq(mealEntries.id, id)));
}

/** Deletes the meal and returns its photo URL, if any. */
export async function deleteMeal(id: number): Promise<string | null> {
  await ready();
  const user = await uid();
  const [row] = await db
    .delete(mealEntries)
    .where(and(eq(mealEntries.userId, user), eq(mealEntries.id, id)))
    .returning({ photoUrl: mealEntries.photoUrl });
  return row?.photoUrl ?? null;
}

// ---------- ingredient labels ----------

/** Saved display name for every ingredient identity this account has used. */
export async function getIngredientLabels(): Promise<Record<string, string>> {
  await ready();
  const user = await uid();
  const rows = await db
    .select({ itemKey: ingredientLabels.itemKey, label: ingredientLabels.label })
    .from(ingredientLabels)
    .where(eq(ingredientLabels.userId, user));
  return Object.fromEntries(rows.map((row) => [row.itemKey, row.label]));
}

export interface SavedIngredient {
  key: string;
  label: string;
  recipes: number;
}

export async function listIngredients(): Promise<SavedIngredient[]> {
  await ready();
  const user = await uid();
  const [labels, uses] = await Promise.all([
    getIngredientLabels(),
    db
      .select({ itemKey: userRecipeIngredients.itemKey })
      .from(userRecipeIngredients)
      .where(eq(userRecipeIngredients.userId, user)),
  ]);
  const counts = new Map<string, number>();
  for (const use of uses) counts.set(use.itemKey, (counts.get(use.itemKey) ?? 0) + 1);
  return Object.entries(labels)
    .map(([key, label]) => ({ key, label, recipes: counts.get(key) ?? 0 }))
    .filter((item) => item.recipes > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Renames one ingredient everywhere it appears. */
export async function renameIngredient(key: string, label: string): Promise<void> {
  const next = clip(label, MAX_NAME);
  if (!next) return;
  await ready();
  const user = await uid();
  await db
    .update(ingredientLabels)
    .set({ label: next, updatedAt: now() })
    .where(and(eq(ingredientLabels.userId, user), eq(ingredientLabels.itemKey, key)));
}

// ---------- user recipes ----------

export interface UserRecipeSummary {
  id: number;
  name: string;
  ingredients: number;
  steps: number;
}

export interface UserRecipeIngredient {
  key: string;
  label: string;
  name: string;
  qty: number | null;
  unit: string | null;
}

export interface UserRecipe {
  id: number;
  name: string;
  steps: string[];
  ingredients: UserRecipeIngredient[];
}

function parseSteps(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((step): step is string => typeof step === "string") : [];
  } catch {
    return [];
  }
}

export async function listUserRecipes(): Promise<UserRecipeSummary[]> {
  await ready();
  const user = await uid();
  const [recipes, ingredients] = await Promise.all([
    db
      .select()
      .from(userRecipes)
      .where(eq(userRecipes.userId, user))
      .orderBy(asc(userRecipes.name)),
    db
      .select({ recipeId: userRecipeIngredients.recipeId })
      .from(userRecipeIngredients)
      .where(eq(userRecipeIngredients.userId, user)),
  ]);
  const counts = new Map<number, number>();
  for (const row of ingredients) counts.set(row.recipeId, (counts.get(row.recipeId) ?? 0) + 1);
  return recipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    ingredients: counts.get(recipe.id) ?? 0,
    steps: parseSteps(recipe.steps).length,
  }));
}

export async function getUserRecipe(id: number): Promise<UserRecipe | null> {
  await ready();
  const user = await uid();
  const [recipe] = await db
    .select()
    .from(userRecipes)
    .where(and(eq(userRecipes.userId, user), eq(userRecipes.id, id)));
  if (!recipe) return null;

  const [rows, labels] = await Promise.all([
    db
      .select()
      .from(userRecipeIngredients)
      .where(and(eq(userRecipeIngredients.userId, user), eq(userRecipeIngredients.recipeId, id)))
      .orderBy(asc(userRecipeIngredients.position)),
    getIngredientLabels(),
  ]);

  return {
    id: recipe.id,
    name: recipe.name,
    steps: parseSteps(recipe.steps),
    ingredients: rows.map((row) => ({
      key: row.itemKey,
      label: labels[row.itemKey] ?? row.name,
      name: row.name,
      qty: row.qty,
      unit: row.unit,
    })),
  };
}

export interface RecipeInput {
  id?: number;
  name: string;
  steps: string[];
  ingredients: { name: string; amount: string }[];
}

/**
 * Creates or replaces a recipe. Each ingredient is resolved to its identity
 * key; two lines that resolve to the same key collapse to the first, and the
 * first name ever saved for a key becomes its label on this account.
 */
export async function saveUserRecipe(input: RecipeInput): Promise<number | null> {
  const name = clip(input.name, MAX_NAME);
  if (!name) return null;

  await ready();
  const user = await uid();
  const stamp = now();
  const steps = input.steps
    .map((step) => clip(step, MAX_STEP_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_STEPS);

  let id = input.id ?? null;
  if (id !== null) {
    const [existing] = await db
      .update(userRecipes)
      .set({ name, steps: JSON.stringify(steps), updatedAt: stamp })
      .where(and(eq(userRecipes.userId, user), eq(userRecipes.id, id)))
      .returning({ id: userRecipes.id });
    if (!existing) return null;
  } else {
    const [created] = await db
      .insert(userRecipes)
      .values({ userId: user, name, steps: JSON.stringify(steps), createdAt: stamp, updatedAt: stamp })
      .returning({ id: userRecipes.id });
    id = created.id;
  }

  const seen = new Set<string>();
  const lines: { key: string; name: string; qty: number | null; unit: string | null }[] = [];
  for (const ingredient of input.ingredients.slice(0, MAX_INGREDIENTS)) {
    const typed = clip(ingredient.name, MAX_NAME);
    if (!typed) continue;
    const key = resolveIngredientIdentity(typed).key;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({ key, name: typed, ...parseAmount(ingredient.amount.slice(0, 40)) });
  }

  await db
    .delete(userRecipeIngredients)
    .where(and(eq(userRecipeIngredients.userId, user), eq(userRecipeIngredients.recipeId, id)));

  for (const [position, line] of lines.entries()) {
    await db
      .insert(ingredientLabels)
      .values({ userId: user, itemKey: line.key, label: line.name, updatedAt: stamp })
      .onConflictDoNothing({ target: [ingredientLabels.userId, ingredientLabels.itemKey] });
    await db.insert(userRecipeIngredients).values({
      userId: user,
      recipeId: id,
      itemKey: line.key,
      name: line.name,
      qty: line.qty,
      unit: line.unit,
      position,
    });
  }

  return id;
}

export async function deleteUserRecipe(id: number): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .delete(userRecipeIngredients)
    .where(and(eq(userRecipeIngredients.userId, user), eq(userRecipeIngredients.recipeId, id)));
  await db.delete(userRecipes).where(and(eq(userRecipes.userId, user), eq(userRecipes.id, id)));
  await db
    .update(mealEntries)
    .set({ recipeRef: null, updatedAt: now() })
    .where(and(eq(mealEntries.userId, user), eq(mealEntries.recipeRef, `user:${id}`)));
}

/** Everything the meal composer can link: your recipes first, then the Instagram catalog. */
export async function recipeOptions(): Promise<RecipeOption[]> {
  const mine = await listUserRecipes();
  return [
    ...mine.map((recipe) => ({ ref: `user:${recipe.id}`, name: recipe.name, kind: "user" as const })),
    ...[...RECIPES]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((recipe) => ({ ref: `catalog:${recipe.id}`, name: recipe.name, kind: "catalog" as const })),
  ];
}

/** Your recipes as grocery lines: identity key, saved label, and the dish name. */
export async function userRecipeGroceryLines(): Promise<
  { recipeId: number; recipeName: string; key: string; label: string }[]
> {
  await ready();
  const user = await uid();
  const [recipes, rows, labels] = await Promise.all([
    db
      .select({ id: userRecipes.id, name: userRecipes.name })
      .from(userRecipes)
      .where(eq(userRecipes.userId, user)),
    db
      .select({
        recipeId: userRecipeIngredients.recipeId,
        itemKey: userRecipeIngredients.itemKey,
        name: userRecipeIngredients.name,
      })
      .from(userRecipeIngredients)
      .where(eq(userRecipeIngredients.userId, user)),
    getIngredientLabels(),
  ]);
  const names = new Map(recipes.map((recipe) => [recipe.id, recipe.name]));
  return rows.flatMap((row) => {
    const recipeName = names.get(row.recipeId);
    if (!recipeName) return [];
    return [{ recipeId: row.recipeId, recipeName, key: row.itemKey, label: labels[row.itemKey] ?? row.name }];
  });
}

/** Calories and macros from meals that link an Instagram catalog recipe. */
export function mealMacros(meals: MealEntry[]): { calories: number; protein: number; carbs: number; fat: number } {
  return meals.reduce(
    (sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fat: sum.fat + meal.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

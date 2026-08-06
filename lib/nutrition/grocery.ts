import {
  recipeById,
  RECIPES,
  type Aisle,
  type Diet,
  type Ingredient,
  type Recipe,
  type Slot,
} from "./recipes";

export interface GroceryItem {
  key: string;
  item: string;
  qty: number;
  unit: string;
  aisle: Aisle;
}

export interface GroceryLine extends GroceryItem {
  /** Recipe names that need this ingredient this week. */
  dishes: string[];
}

export interface GroceryAisle {
  aisle: Aisle;
  label: string;
  items: GroceryItem[];
}

export interface GroceryAisleDetailed {
  aisle: Aisle;
  label: string;
  items: GroceryLine[];
}

export interface RecipeReadiness {
  recipe: Recipe;
  have: number;
  total: number;
  pct: number;
}

const AISLE_ORDER: Aisle[] = ["produce", "protein", "dairy", "bakery", "pantry", "frozen", "fuel"];

const AISLE_LABEL: Record<Aisle, string> = {
  produce: "Produce",
  protein: "Meat & protein",
  dairy: "Dairy",
  bakery: "Bakery",
  pantry: "Pantry",
  frozen: "Frozen",
  fuel: "Run fuel",
};

export function ingredientKey(ingredient: Ingredient): string {
  return `${ingredient.item.toLowerCase()}|${ingredient.unit.toLowerCase()}`;
}

/** Rolls a week of planned recipes into one shopping list, merged by item and unit. */
export function buildGroceryList(recipeIds: (string | null)[]): GroceryAisle[] {
  return buildGroceryListDetailed(recipeIds).map((aisle) => ({
    aisle: aisle.aisle,
    label: aisle.label,
    items: aisle.items.map(({ dishes: _dishes, ...item }) => item),
  }));
}

/** Same as buildGroceryList, but each line lists which dishes need it. */
export function buildGroceryListDetailed(recipeIds: (string | null)[]): GroceryAisleDetailed[] {
  const merged = new Map<string, GroceryLine>();

  for (const id of recipeIds) {
    const recipe = recipeById(id);
    if (!recipe) continue;

    for (const ingredient of recipe.ingredients) {
      const key = ingredientKey(ingredient);
      const existing = merged.get(key);
      if (existing) {
        existing.qty += ingredient.qty;
        if (!existing.dishes.includes(recipe.name)) existing.dishes.push(recipe.name);
      } else {
        merged.set(key, {
          key,
          item: ingredient.item,
          qty: ingredient.qty,
          unit: ingredient.unit,
          aisle: ingredient.aisle,
          dishes: [recipe.name],
        });
      }
    }
  }

  const aisles: GroceryAisleDetailed[] = AISLE_ORDER.map((aisle) => ({
    aisle,
    label: AISLE_LABEL[aisle],
    items: [...merged.values()]
      .filter((item) => item.aisle === aisle)
      .map((item) => ({
        ...item,
        qty: Math.round(item.qty * 100) / 100,
        dishes: [...item.dishes].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.item.localeCompare(b.item)),
  }));

  return aisles.filter((aisle) => aisle.items.length > 0);
}

export function formatQty(item: Pick<GroceryItem, "qty" | "unit">): string {
  const qty = Number.isInteger(item.qty) ? String(item.qty) : item.qty.toFixed(2).replace(/0+$/, "");
  return `${qty} ${item.unit}`;
}

/** Grocery lines for one recipe — same shape as the week shopping list. */
export function groceryLinesForRecipe(recipe: Recipe): GroceryLine[] {
  return recipe.ingredients.map((ingredient) => ({
    key: ingredientKey(ingredient),
    item: ingredient.item,
    qty: ingredient.qty,
    unit: ingredient.unit,
    aisle: ingredient.aisle,
    dishes: [recipe.name],
  }));
}

/** Look up catalog ingredients by key (for shopping checks outside this week's plan). */
export function groceryLinesForKeys(keys: Iterable<string>): GroceryLine[] {
  const wanted = new Set(keys);
  if (wanted.size === 0) return [];

  const found = new Map<string, GroceryLine>();
  for (const recipe of RECIPES) {
    for (const ingredient of recipe.ingredients) {
      const key = ingredientKey(ingredient);
      if (!wanted.has(key)) continue;
      const existing = found.get(key);
      if (existing) {
        if (!existing.dishes.includes(recipe.name)) existing.dishes.push(recipe.name);
      } else {
        found.set(key, {
          key,
          item: ingredient.item,
          qty: ingredient.qty,
          unit: ingredient.unit,
          aisle: ingredient.aisle,
          dishes: [recipe.name],
        });
      }
    }
  }

  return [...found.values()]
    .map((item) => ({
      ...item,
      dishes: [...item.dishes].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.item.localeCompare(b.item));
}

/**
 * Week grocery list plus any buy-list keys that aren't from planned meals
 * (e.g. added from a recipe page).
 */
export function mergeGroceryWithBuyList(
  weekLines: GroceryLine[],
  onBuyList: Iterable<string>,
): GroceryLine[] {
  const byKey = new Map(weekLines.map((line) => [line.key, line]));
  const missingKeys = [...onBuyList].filter((key) => !byKey.has(key));
  for (const line of groceryLinesForKeys(missingKeys)) {
    byKey.set(line.key, line);
  }
  return [...byKey.values()];
}

/** How many of a recipe's ingredients are already at home. */
export function recipeReadiness(recipe: Recipe, haveKeys: Set<string>): RecipeReadiness {
  const total = recipe.ingredients.length;
  if (total === 0) return { recipe, have: 0, total: 0, pct: 0 };
  const have = recipe.ingredients.filter((ing) => haveKeys.has(ingredientKey(ing))).length;
  return { recipe, have, total, pct: Math.round((have / total) * 100) };
}

/** Recipes for a slot, sorted by pantry coverage (then name). */
export function recipesReadyForSlot(
  slot: Slot,
  haveKeys: Set<string>,
  dietLimit?: (recipe: Recipe) => boolean,
): RecipeReadiness[] {
  return RECIPES.filter((recipe) => recipe.slot === slot && (!dietLimit || dietLimit(recipe)))
    .map((recipe) => recipeReadiness(recipe, haveKeys))
    .sort((a, b) => b.pct - a.pct || a.recipe.name.localeCompare(b.recipe.name));
}

/** Top recipes across meal slots that you can mostly cook from what's at home. */
export function topReadyRecipes(
  haveKeys: Set<string>,
  limit = 6,
  allow?: (recipe: Recipe) => boolean,
): RecipeReadiness[] {
  if (haveKeys.size === 0) return [];
  return RECIPES.filter(
    (recipe) =>
      ["breakfast", "lunch", "dinner", "snack"].includes(recipe.slot) && (!allow || allow(recipe)),
  )
    .map((recipe) => recipeReadiness(recipe, haveKeys))
    .filter((row) => row.total > 0 && row.pct >= 50)
    .sort((a, b) => b.pct - a.pct || a.recipe.name.localeCompare(b.recipe.name))
    .slice(0, limit);
}

export interface BrowseRecipe {
  id: string;
  name: string;
  slot: Slot;
  diet: Diet;
  calories: number;
  protein: number;
  minutes: number;
  have: number;
  total: number;
  pct: number;
}

export function isVegRecipe(recipe: Pick<BrowseRecipe, "diet">): boolean {
  return recipe.diet === "vegan" || recipe.diet === "vegetarian";
}

/** Flat catalog for the client recipe picker — filter by slot in the browser. */
export function buildBrowseCatalog(
  haveKeys: Set<string>,
  allow: (recipe: Recipe) => boolean,
): BrowseRecipe[] {
  return RECIPES.filter(allow)
    .map((recipe) => {
      const ready = recipeReadiness(recipe, haveKeys);
      return {
        id: recipe.id,
        name: recipe.name,
        slot: recipe.slot,
        diet: recipe.diet,
        calories: recipe.calories,
        protein: recipe.protein,
        minutes: recipe.minutes,
        have: ready.have,
        total: ready.total,
        pct: ready.pct,
      };
    })
    .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
}


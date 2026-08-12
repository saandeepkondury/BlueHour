import {
  addCompatibleQty,
  canonicalizeStoredItemKey,
  ingredientRole,
  normalizeUnit,
  resolveIngredientIdentity,
} from "./ingredient-identity";
import {
  recipeById,
  RECIPES,
  type Aisle,
  type Diet,
  type Ingredient,
  type Recipe,
  type Slot,
} from "./recipes";

export interface QtyAmount {
  qty: number;
  unit: string;
}

export interface GroceryItem {
  key: string;
  item: string;
  qty: number;
  unit: string;
  aisle: Aisle;
  /** Present when amounts span incompatible units (e.g. ea + g). */
  amounts?: QtyAmount[];
}

export interface GroceryLine extends GroceryItem {
  /** Recipe names that use this ingredient (catalog context). */
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

/**
 * Stable grocery / pantry key for an ingredient.
 * Same food → same key, regardless of spelling, size, prep, or unit.
 */
export function ingredientKey(ingredient: Pick<Ingredient, "item"> | string): string {
  const item = typeof ingredient === "string" ? ingredient : ingredient.item;
  return resolveIngredientIdentity(item).key;
}

/** Remap legacy `name|unit` (and alias spellings) to the current identity key. */
export function normalizeGroceryKey(storedKey: string): string {
  return canonicalizeStoredItemKey(storedKey);
}

function roundQty(qty: number): number {
  return Math.round(qty * 100) / 100;
}

function mergeAmounts(into: QtyAmount[], qty: number, unit: string): QtyAmount[] {
  const next = [...into];
  const normalized = normalizeUnit(unit);
  for (let i = 0; i < next.length; i++) {
    const merged = addCompatibleQty(next[i]!.qty, next[i]!.unit, qty, normalized);
    if (merged) {
      next[i] = { qty: roundQty(merged.qty), unit: merged.unit };
      return next;
    }
  }
  next.push({ qty: roundQty(qty), unit: normalized });
  return next;
}

function primaryAmount(amounts: QtyAmount[]): QtyAmount {
  if (amounts.length === 0) return { qty: 0, unit: "ea" };
  // Prefer count, then weight, then whatever is first.
  const ranked = [...amounts].sort((a, b) => {
    const score = (unit: string) => {
      const u = normalizeUnit(unit);
      if (u === "ea" || u === "clove" || u === "slice" || u === "handful" || u === "packet") return 0;
      if (u === "g" || u === "kg") return 1;
      return 2;
    };
    return score(a.unit) - score(b.unit);
  });
  return ranked[0]!;
}

function finalizeAmounts(amounts: QtyAmount[]): Pick<GroceryItem, "qty" | "unit" | "amounts"> {
  const cleaned = amounts
    .map((a) => ({ qty: roundQty(a.qty), unit: normalizeUnit(a.unit) }))
    .filter((a) => a.qty > 0);
  if (cleaned.length <= 1) {
    const only = cleaned[0] ?? { qty: 0, unit: "ea" };
    return { qty: only.qty, unit: only.unit };
  }
  const primary = primaryAmount(cleaned);
  return { qty: primary.qty, unit: primary.unit, amounts: cleaned };
}

/**
 * Constant pantry inventory: one line per deduped ingredient identity across
 * the full recipe catalog. Membership does not depend on the week plan.
 */
export function buildPantryInventory(): GroceryLine[] {
  const merged = new Map<
    string,
    {
      key: string;
      item: string;
      aisle: Aisle;
      dishes: string[];
    }
  >();

  for (const recipe of RECIPES) {
    for (const ingredient of recipe.ingredients) {
      const identity = resolveIngredientIdentity(ingredient.item);
      const existing = merged.get(identity.key);
      if (existing) {
        if (!existing.dishes.includes(recipe.name)) existing.dishes.push(recipe.name);
      } else {
        merged.set(identity.key, {
          key: identity.key,
          item: identity.label,
          aisle: ingredient.aisle,
          dishes: [recipe.name],
        });
      }
    }
  }

  return [...merged.values()]
    .map((item) => ({
      key: item.key,
      item: item.item,
      qty: 0,
      unit: "ea",
      aisle: item.aisle,
      dishes: [...item.dishes].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => {
      const aisleDiff = AISLE_ORDER.indexOf(a.aisle) - AISLE_ORDER.indexOf(b.aisle);
      if (aisleDiff !== 0) return aisleDiff;
      return a.item.localeCompare(b.item);
    });
}

/** Group inventory lines by aisle for sectioned lists. */
export function groupGroceryByAisle(items: GroceryLine[]): GroceryAisleDetailed[] {
  return AISLE_ORDER.map((aisle) => ({
    aisle,
    label: AISLE_LABEL[aisle],
    items: items.filter((item) => item.aisle === aisle),
  })).filter((group) => group.items.length > 0);
}

/** Rolls a week of planned recipes into one shopping list, merged by item identity. */
export function buildGroceryList(recipeIds: (string | null)[]): GroceryAisle[] {
  return buildGroceryListDetailed(recipeIds).map((aisle) => ({
    aisle: aisle.aisle,
    label: aisle.label,
    items: aisle.items.map(({ dishes: _dishes, ...item }) => item),
  }));
}

/** Same as buildGroceryList, but each line lists which dishes need it. */
export function buildGroceryListDetailed(recipeIds: (string | null)[]): GroceryAisleDetailed[] {
  const merged = new Map<
    string,
    {
      key: string;
      item: string;
      aisle: Aisle;
      amounts: QtyAmount[];
      dishes: string[];
    }
  >();

  for (const id of recipeIds) {
    const recipe = recipeById(id);
    if (!recipe) continue;

    for (const ingredient of recipe.ingredients) {
      const identity = resolveIngredientIdentity(ingredient.item);
      const key = identity.key;
      const existing = merged.get(key);
      if (existing) {
        existing.amounts = mergeAmounts(existing.amounts, ingredient.qty, ingredient.unit);
        if (!existing.dishes.includes(recipe.name)) existing.dishes.push(recipe.name);
      } else {
        merged.set(key, {
          key,
          item: identity.label,
          aisle: ingredient.aisle,
          amounts: mergeAmounts([], ingredient.qty, ingredient.unit),
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
      .map((item) => {
        const qtyFields = finalizeAmounts(item.amounts);
        return {
          key: item.key,
          item: item.item,
          aisle: item.aisle,
          ...qtyFields,
          dishes: [...item.dishes].sort((a, b) => a.localeCompare(b)),
        };
      })
      .sort((a, b) => a.item.localeCompare(b.item)),
  }));

  return aisles.filter((aisle) => aisle.items.length > 0);
}

export function formatQty(item: Pick<GroceryItem, "qty" | "unit" | "amounts">): string {
  const parts = item.amounts && item.amounts.length > 1 ? item.amounts : [{ qty: item.qty, unit: item.unit }];
  return parts
    .map((part) => {
      const qty = Number.isInteger(part.qty) ? String(part.qty) : part.qty.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
      return `${qty} ${part.unit}`;
    })
    .join(" + ");
}

/** Grocery lines for one recipe — same identity keys as the week shopping list. */
export function groceryLinesForRecipe(recipe: Recipe): GroceryLine[] {
  const merged = new Map<string, GroceryLine & { amounts: QtyAmount[] }>();

  for (const ingredient of recipe.ingredients) {
    const identity = resolveIngredientIdentity(ingredient.item);
    const existing = merged.get(identity.key);
    if (existing) {
      existing.amounts = mergeAmounts(existing.amounts, ingredient.qty, ingredient.unit);
    } else {
      merged.set(identity.key, {
        key: identity.key,
        item: identity.label,
        qty: ingredient.qty,
        unit: ingredient.unit,
        aisle: ingredient.aisle,
        dishes: [recipe.name],
        amounts: mergeAmounts([], ingredient.qty, ingredient.unit),
      });
    }
  }

  return [...merged.values()].map((line) => {
    const qtyFields = finalizeAmounts(line.amounts);
    return {
      key: line.key,
      item: line.item,
      aisle: line.aisle,
      dishes: line.dishes,
      ...qtyFields,
    };
  });
}

/** Look up catalog ingredients by key (for shopping checks outside this week's plan). */
export function groceryLinesForKeys(keys: Iterable<string>): GroceryLine[] {
  const wanted = new Set([...keys].map(normalizeGroceryKey));
  if (wanted.size === 0) return [];

  const found = new Map<string, GroceryLine & { amounts: QtyAmount[] }>();
  for (const recipe of RECIPES) {
    for (const ingredient of recipe.ingredients) {
      const identity = resolveIngredientIdentity(ingredient.item);
      if (!wanted.has(identity.key)) continue;
      const existing = found.get(identity.key);
      if (existing) {
        if (!existing.dishes.includes(recipe.name)) existing.dishes.push(recipe.name);
      } else {
        found.set(identity.key, {
          key: identity.key,
          item: identity.label,
          qty: ingredient.qty,
          unit: ingredient.unit,
          aisle: ingredient.aisle,
          dishes: [recipe.name],
          amounts: mergeAmounts([], ingredient.qty, ingredient.unit),
        });
      }
    }
  }

  return [...found.values()]
    .map((item) => {
      const qtyFields = finalizeAmounts(item.amounts);
      return {
        key: item.key,
        item: item.item,
        aisle: item.aisle,
        dishes: [...item.dishes].sort((a, b) => a.localeCompare(b)),
        ...qtyFields,
      };
    })
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
  const missingKeys = [...onBuyList]
    .map(normalizeGroceryKey)
    .filter((key) => !byKey.has(key));
  for (const line of groceryLinesForKeys(missingKeys)) {
    byKey.set(line.key, line);
  }
  return [...byKey.values()];
}

/** Unique main (non-seasoning) ingredients for a recipe, in display order. */
export function mainIngredientLines(
  recipe: Recipe,
): { key: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const ingredient of recipe.ingredients) {
    if (ingredientRole(ingredient.item) !== "main") continue;
    const identity = resolveIngredientIdentity(ingredient.item);
    if (!seen.has(identity.key)) seen.set(identity.key, identity.label);
  }
  return [...seen.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** How many of a recipe's main ingredients are already at home. */
export function recipeReadiness(recipe: Recipe, haveKeys: Set<string>): RecipeReadiness {
  const normalizedHave = new Set([...haveKeys].map(normalizeGroceryKey));
  const mains = mainIngredientLines(recipe);
  // Fall back to all ingredients when a recipe somehow has no classified mains.
  const needed =
    mains.length > 0
      ? mains
      : [...new Set(recipe.ingredients.map((ing) => ingredientKey(ing)))].map((key) => ({
          key,
          label: key,
        }));
  const total = needed.length;
  if (total === 0) return { recipe, have: 0, total: 0, pct: 0 };
  let have = 0;
  for (const item of needed) {
    if (normalizedHave.has(item.key)) have += 1;
  }
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
  /** Main-ingredient pantry coverage (seasonings/garnishes excluded). */
  have: number;
  total: number;
  pct: number;
  /** All main ingredient labels for the dish. */
  mains: string[];
  /** Main ingredient labels currently marked at home. */
  mainsHave: string[];
}

export function isVegRecipe(recipe: Pick<BrowseRecipe, "diet">): boolean {
  return recipe.diet === "vegan" || recipe.diet === "vegetarian";
}

const MEAL_SLOT_SET = new Set<Slot>(["breakfast", "lunch", "dinner", "snack"]);

export type ReadyBand = "ready" | "almost" | "need";

/** Bucket a browse recipe by pantry coverage for picker sections. */
export function readinessBand(recipe: Pick<BrowseRecipe, "pct" | "total">): ReadyBand {
  if (recipe.total <= 0) return "need";
  if (recipe.pct >= 100) return "ready";
  if (recipe.pct >= 50) return "almost";
  return "need";
}

/**
 * Rank everyday meals you can cook from the pantry.
 * Defaults: meal slots only, fully covered (100%), protein then name, cap 6.
 */
export function readyToCook(
  catalog: BrowseRecipe[],
  options: { minPct?: number; limit?: number; mealSlotsOnly?: boolean } = {},
): BrowseRecipe[] {
  const minPct = options.minPct ?? 100;
  const limit = options.limit ?? 6;
  const mealSlotsOnly = options.mealSlotsOnly ?? true;

  return catalog
    .filter(
      (recipe) =>
        recipe.total > 0 &&
        recipe.pct >= minPct &&
        (!mealSlotsOnly || MEAL_SLOT_SET.has(recipe.slot)),
    )
    .sort(
      (a, b) =>
        b.pct - a.pct ||
        b.protein - a.protein ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

/** Flat catalog for the client recipe picker — filter by slot in the browser. */
export function buildBrowseCatalog(
  haveKeys: Set<string>,
  allow: (recipe: Recipe) => boolean,
): BrowseRecipe[] {
  const normalizedHave = new Set([...haveKeys].map(normalizeGroceryKey));
  return RECIPES.filter(allow)
    .map((recipe) => {
      const ready = recipeReadiness(recipe, normalizedHave);
      const mains = mainIngredientLines(recipe);
      const mainsHave = mains
        .filter((item) => normalizedHave.has(item.key))
        .map((item) => item.label);
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
        mains: mains.map((item) => item.label),
        mainsHave,
      };
    })
    .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
}

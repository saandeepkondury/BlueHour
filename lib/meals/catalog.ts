/**
 * Shared vocabulary for the meal log. No database or server imports, so the
 * client composer and recipe editor can use it directly.
 */

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type MealSource = "home" | "prepped" | "out";
export type MealMark = "healthy" | "cheat";

export const MEAL_SLOT_LIST: { id: MealSlot; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
];

export const MEAL_SOURCES: { id: MealSource; label: string }[] = [
  { id: "home", label: "Home cooked" },
  { id: "prepped", label: "Meal prepped" },
  { id: "out", label: "Out" },
];

export const MEAL_MARKS: { id: MealMark; label: string }[] = [
  { id: "healthy", label: "Healthy" },
  { id: "cheat", label: "Cheat" },
];

export const SLOT_NAME: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export const SOURCE_NAME: Record<MealSource, string> = {
  home: "Home cooked",
  prepped: "Meal prepped",
  out: "Out",
};

export const MARK_NAME: Record<MealMark, string> = {
  healthy: "Healthy",
  cheat: "Cheat",
};

export function isMealSlot(value: unknown): value is MealSlot {
  return value === "breakfast" || value === "lunch" || value === "dinner" || value === "snack";
}

export function isMealSource(value: unknown): value is MealSource {
  return value === "home" || value === "prepped" || value === "out";
}

export function isMealMark(value: unknown): value is MealMark {
  return value === "healthy" || value === "cheat";
}

/** Best guess for which meal is being logged at this hour of the day. */
export function slotForHour(hour: number): MealSlot {
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 17) return "snack";
  return "dinner";
}

export type RecipeRef = { kind: "catalog"; id: string } | { kind: "user"; id: number };

export function parseRecipeRef(ref: string | null | undefined): RecipeRef | null {
  if (!ref) return null;
  if (ref.startsWith("catalog:")) {
    const id = ref.slice("catalog:".length);
    return id ? { kind: "catalog", id } : null;
  }
  if (ref.startsWith("user:")) {
    const id = Number(ref.slice("user:".length));
    return Number.isInteger(id) && id > 0 ? { kind: "user", id } : null;
  }
  return null;
}

export function recipeHref(ref: RecipeRef): string {
  return ref.kind === "catalog" ? `/recipe/${ref.id}` : `/fuel/recipes/${ref.id}`;
}

/** A logged meal, ready to render. */
export interface MealEntry {
  id: number;
  date: string;
  slot: MealSlot;
  name: string;
  photoUrl: string | null;
  source: MealSource;
  mark: MealMark | null;
  starred: boolean;
  recipeRef: string | null;
  recipeName: string | null;
  recipeHref: string | null;
  /** Only known when the meal links an Instagram catalog recipe. */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** A recipe the composer can attach to a meal. */
export interface RecipeOption {
  ref: string;
  name: string;
  kind: "user" | "catalog";
}

/**
 * Splits a typed amount like "2", "1.5 cups", or "a pinch" into a number and
 * the rest. Either half can be missing.
 */
export function parseAmount(text: string): { qty: number | null; unit: string | null } {
  const raw = text.trim();
  if (!raw) return { qty: null, unit: null };

  const fraction = raw.match(/^(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (fraction) {
    const den = Number(fraction[2]);
    const qty = den > 0 ? Math.round((Number(fraction[1]) / den) * 100) / 100 : null;
    return { qty, unit: fraction[3].trim() || null };
  }

  const number = raw.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (number) return { qty: Number(number[1]), unit: number[2].trim() || null };

  return { qty: null, unit: raw };
}

export function formatAmount(qty: number | null, unit: string | null): string {
  return [qty === null ? "" : String(qty), unit ?? ""].join(" ").trim();
}

/**
 * Turns pasted text into separate steps: one per line, with any leading
 * "1.", "2)", "-", or "Step 3:" dropped.
 */
export function splitSteps(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*(?:step\s*\d+\s*[:.)-]?|\d+\s*[.)-]|[-*\u2022])\s*/i, "")
        .trim(),
    )
    .filter(Boolean);
}

import { eq, inArray } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { settings } from "@/drizzle/schema";

/**
 * Anything that is neither a training row nor part of the runner's profile —
 * coach overrides and the OpenAI credentials — lives in one key/value table.
 */

export const KEYS = {
  calorieDelta: "calorie_delta",
  proteinFloor: "protein_floor",
  openaiKey: "openai_api_key",
  openaiModel: "openai_model",
  ingestToken: "health_ingest_token",
  lastCoachRun: "last_coach_run",
  waterPushSlot: "water_push_slot",
  /** Oz per cup used when water_oz was last written — rescale history when CUP_OZ changes. */
  waterCupOz: "water_cup_oz",
  bannedRecipes: "banned_recipes",
  workoutxCache: "workoutx_cache",
  strengthCatalog: "strength_catalog_version",
  /** Bumped when the meal catalog is replaced so planned meals can be wiped once. */
  mealsCatalogVersion: "meals_catalog_version",
} as const;

export type SettingKey = (typeof KEYS)[keyof typeof KEYS];

export async function getSetting(key: SettingKey): Promise<string | null> {
  await ready();
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row?.value ?? null;
}

export async function getSettings(keys: SettingKey[]): Promise<Map<string, string>> {
  await ready();
  const rows = await db.select().from(settings).where(inArray(settings.key, keys));
  return new Map(rows.map((row) => [row.key, row.value]));
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await ready();
  const updatedAt = new Date().toISOString();
  if (value === "") {
    await db.delete(settings).where(eq(settings.key, key));
    return;
  }
  await db
    .insert(settings)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt } });
}

export async function getNumber(key: SettingKey, fallback: number): Promise<number> {
  const raw = await getSetting(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Coach overrides that shift the fuelling targets, both clamped to sane ranges. */
export async function fuelOverrides(): Promise<{ calorieDelta: number; proteinFloor: number | null }> {
  const rows = await getSettings([KEYS.calorieDelta, KEYS.proteinFloor]);
  const delta = Number(rows.get(KEYS.calorieDelta) ?? "0");
  const floor = Number(rows.get(KEYS.proteinFloor) ?? "");
  return {
    calorieDelta: Number.isFinite(delta) ? Math.max(-400, Math.min(400, delta)) : 0,
    proteinFloor: Number.isFinite(floor) && floor > 0 ? Math.max(1.2, Math.min(2.6, floor)) : null,
  };
}

/**
 * The environment wins over the stored key, so a deploy can rotate credentials
 * without anyone editing the database.
 */
export async function openaiConfig(): Promise<{ key: string | null; model: string; fromEnv: boolean }> {
  const rows = await getSettings([KEYS.openaiKey, KEYS.openaiModel]);
  const envKey = process.env.OPENAI_API_KEY?.trim() || null;
  const stored = rows.get(KEYS.openaiKey)?.trim() || null;
  return {
    key: envKey ?? stored,
    model: rows.get(KEYS.openaiModel)?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
    fromEnv: envKey !== null,
  };
}

export async function bannedRecipeIds(): Promise<string[]> {
  const raw = await getSetting(KEYS.bannedRecipes);
  if (!raw) return [];
  return [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
}

export async function banRecipe(recipeId: string): Promise<string[]> {
  const next = [...new Set([...(await bannedRecipeIds()), recipeId])];
  await setSetting(KEYS.bannedRecipes, next.join(","));
  return next;
}

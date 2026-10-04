import { and, eq, inArray } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { settings } from "@/drizzle/schema";
import { uid } from "@/lib/auth/current";

/**
 * Anything that is neither a training row nor part of the runner's profile,
 * like fuel overrides and the Health ingest token, lives in one key/value table,
 * keyed by account.
 */

export const KEYS = {
  calorieDelta: "calorie_delta",
  proteinFloor: "protein_floor",
  ingestToken: "health_ingest_token",
  waterPushSlot: "water_push_slot",
  /** Oz per cup used when water_oz was last written — rescale history when CUP_OZ changes. */
  waterCupOz: "water_cup_oz",
  bannedRecipes: "banned_recipes",
  workoutxCache: "workoutx_cache",
  strengthCatalog: "strength_catalog_version",
  /** Bumped when the meal catalog is replaced so planned meals can be wiped once. */
} as const;

export type SettingKey = (typeof KEYS)[keyof typeof KEYS];

/**
 * Owner for rows that are the same for everyone — the WorkoutX exercise catalog
 * cache. Not a real account, so it is never returned by any account lookup.
 */
const SHARED_SCOPE = "__shared__";

export async function getSharedSetting(key: SettingKey): Promise<string | null> {
  await ready();
  const [row] = await db
    .select()
    .from(settings)
    .where(and(eq(settings.userId, SHARED_SCOPE), eq(settings.key, key)));
  return row?.value ?? null;
}

export async function setSharedSetting(key: SettingKey, value: string): Promise<void> {
  await ready();
  const updatedAt = new Date().toISOString();
  await db
    .insert(settings)
    .values({ userId: SHARED_SCOPE, key, value, updatedAt })
    .onConflictDoUpdate({
      target: [settings.userId, settings.key],
      set: { value, updatedAt },
    });
}

export async function getSetting(key: SettingKey): Promise<string | null> {
  await ready();
  const user = await uid();
  const [row] = await db
    .select()
    .from(settings)
    .where(and(eq(settings.userId, user), eq(settings.key, key)));
  return row?.value ?? null;
}

export async function getSettings(keys: SettingKey[]): Promise<Map<string, string>> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(settings)
    .where(and(eq(settings.userId, user), inArray(settings.key, keys)));
  return new Map(rows.map((row) => [row.key, row.value]));
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await ready();
  const user = await uid();
  const updatedAt = new Date().toISOString();
  if (value === "") {
    await db.delete(settings).where(and(eq(settings.userId, user), eq(settings.key, key)));
    return;
  }
  await db
    .insert(settings)
    .values({ userId: user, key, value, updatedAt })
    .onConflictDoUpdate({
      target: [settings.userId, settings.key],
      set: { value, updatedAt },
    });
}

export async function getNumber(key: SettingKey, fallback: number): Promise<number> {
  const raw = await getSetting(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Fuel offsets that shift the fuelling targets, both clamped to sane ranges. */
export async function fuelOverrides(): Promise<{ calorieDelta: number; proteinFloor: number | null }> {
  const rows = await getSettings([KEYS.calorieDelta, KEYS.proteinFloor]);
  const delta = Number(rows.get(KEYS.calorieDelta) ?? "0");
  const floor = Number(rows.get(KEYS.proteinFloor) ?? "");
  return {
    calorieDelta: Number.isFinite(delta) ? Math.max(-400, Math.min(400, delta)) : 0,
    proteinFloor: Number.isFinite(floor) && floor > 0 ? Math.max(1.2, Math.min(2.6, floor)) : null,
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

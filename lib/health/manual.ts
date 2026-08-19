import { db, ready } from "@/lib/db";
import { healthDays } from "@/drizzle/schema";
import { uid } from "@/lib/auth/current";

/**
 * The Watch cannot measure a waist, and some mornings the sync does not run.
 * Hand-entered numbers use the same table so nothing downstream has to care
 * where a measurement came from.
 */

export interface ManualEntry {
  date: string;
  asleepMin?: number | null;
  restingHr?: number | null;
  hrvMs?: number | null;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  waistCm?: number | null;
}

export async function saveManualHealth(entry: ManualEntry): Promise<void> {
  await ready();
  const user = await uid();
  const now = new Date().toISOString();

  // Only fields the form actually submitted are written; the rest keep their values.
  const provided = Object.entries(entry).filter(
    ([key, value]) => key !== "date" && value !== undefined && value !== null,
  );
  if (provided.length === 0) return;

  const set = Object.fromEntries(provided) as Record<string, number>;

  await db
    .insert(healthDays)
    .values({ userId: user, date: entry.date, ...set, updatedAt: now })
    .onConflictDoUpdate({
      target: [healthDays.userId, healthDays.date],
      set: { ...set, updatedAt: now },
    });
}

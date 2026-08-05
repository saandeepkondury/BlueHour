import { sql } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { profile, workouts, type Profile } from "@/drizzle/schema";
import { startOfWeek, todayISO } from "@/lib/date";
import { generatePlan } from "./generate";

/** Pre-filled race so the app is usable before a Settings screen exists. */
const DEFAULT_RACE = {
  raceName: "Ascension Seton Austin Half Marathon",
  raceDate: "2027-02-14",
  longRunDay: 6,
};

/**
 * Creates the profile row and the 27-week block on first load. Both steps are
 * skipped once data exists, so this is safe to call from any page render.
 */
export async function ensureSeeded(): Promise<Profile> {
  await ready();

  const [existing] = await db.select().from(profile).limit(1);
  const row =
    existing ??
    (
      await db
        .insert(profile)
        .values({
          id: 1,
          raceName: DEFAULT_RACE.raceName,
          raceDate: DEFAULT_RACE.raceDate,
          startDate: startOfWeek(todayISO()),
          longRunDay: DEFAULT_RACE.longRunDay,
          updatedAt: new Date().toISOString(),
        })
        .returning()
    )[0];

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workouts);

  if (Number(count) === 0) {
    const seeds = generatePlan({
      startDate: row.startDate,
      raceDate: row.raceDate,
      longRunDay: row.longRunDay,
    });
    for (const seed of seeds) {
      await db.insert(workouts).values(seed).onConflictDoNothing();
    }
  }

  return row;
}

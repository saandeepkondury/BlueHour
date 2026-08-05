import { and, eq, gte, sql } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { strengthSessions, workouts, type Profile, type StrengthSession, type Workout } from "@/drizzle/schema";
import { addDays, dayOfWeek, daysBetween, todayISO } from "@/lib/date";
import type { Phase } from "@/lib/plan/types";
import { blocksFor, coreLevelFor, strengthLevelFor, type Focus } from "./exercises";

/**
 * Lifting is scheduled around the long run rather than around the calendar: two
 * clear days after it, never the day before it. That single rule is what keeps
 * strength work from quietly wrecking the mileage that matters more.
 */

export interface StrengthSeed {
  date: string;
  week: number;
  phase: string;
  focus: Focus;
  title: string;
  purpose: string;
  minutes: number;
  level: number;
  blocks: string;
}

const FULL_TITLES: Record<number, string> = {
  1: "Full body — foundation",
  2: "Full body — build",
  3: "Full body — heavy",
};

/** Preferred spacing after the long run: +2 and +4 first, then +3 and +5. */
const OFFSETS = [2, 4, 3, 5];

function longRunDow(week: Workout[]): number {
  const long = week.find((day) => day.type === "long" || day.type === "race");
  return long ? dayOfWeek(long.date) : 6;
}

function pickDays(
  week: Workout[],
  count: number,
  skip: Set<string>,
  spread = false,
): Workout[] {
  const L = longRunDow(week);
  const byDow = new Map<number, Workout>();
  for (const day of week) byDow.set(dayOfWeek(day.date), day);

  const chosen: Workout[] = [];
  const candidates: Workout[] = [];
  for (const offset of OFFSETS) {
    const day = byDow.get((L + offset) % 7);
    if (!day || skip.has(day.date)) continue;
    if (day.type === "long" || day.type === "race") continue;
    candidates.push(day);
  }

  // Two lifting days in a row is worse than one lifting day, so back-to-back
  // candidates are held back and only used if the week runs out of room.
  if (spread) {
    for (const day of candidates) {
      if (chosen.length >= count) break;
      const adjacent = chosen.some(
        (picked) => Math.abs(daysBetween(picked.date, day.date)) <= 1,
      );
      if (!adjacent) chosen.push(day);
    }
  }

  for (const day of candidates) {
    if (chosen.length >= count) break;
    if (chosen.includes(day)) continue;
    chosen.push(day);
  }

  return chosen.sort((a, b) => a.date.localeCompare(b.date));
}

export function buildStrengthPlan(
  plan: Workout[],
  options: { strengthDays: number; absGoal: boolean; raceDate: string },
): StrengthSeed[] {
  if (plan.length === 0) return [];

  const byWeek = new Map<number, Workout[]>();
  for (const day of plan) {
    const bucket = byWeek.get(day.week);
    if (bucket) bucket.push(day);
    else byWeek.set(day.week, [day]);
  }

  const totalWeeks = Math.max(...byWeek.keys());
  const seeds: StrengthSeed[] = [];
  // Nothing loaded inside the last three days: the legs are for the race.
  const quietFrom = addDays(options.raceDate, -3);

  for (const [week, days] of [...byWeek.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const phase = (sorted[0]?.phase ?? "base") as Phase;
    const level = strengthLevelFor(week, totalWeeks);
    const coreLevel = coreLevelFor(week, totalWeeks, options.absGoal);
    const deload = phase === "taper" || phase === "race";
    const skip = new Set(sorted.filter((day) => day.date >= quietFrom).map((day) => day.date));

    if (phase === "race") {
      const [first] = pickDays(sorted, 1, skip);
      if (first) {
        seeds.push({
          date: first.date,
          week,
          phase,
          focus: "mobility",
          title: "Loosen up",
          purpose: "Race week. Move well, lift nothing, leave the legs alone.",
          minutes: 15,
          level: 1,
          blocks: JSON.stringify(blocksFor("mobility", 1, 1, true)),
        });
      }
      continue;
    }

    const fullDays = pickDays(sorted, Math.max(0, Math.min(3, options.strengthDays)), skip, true);
    for (const day of fullDays) skip.add(day.date);
    const coreDays = phase === "taper" ? [] : pickDays(sorted, 2, skip);

    for (const day of fullDays) {
      seeds.push({
        date: day.date,
        week,
        phase,
        focus: "full",
        title: deload ? "Full body — sharpen" : FULL_TITLES[level],
        purpose: deload
          ? "Half the volume, same movements. Enough to keep what you built."
          : "Legs that hold their shape at mile 11, and the trunk strength the abs goal needs.",
        minutes: deload ? 28 : 40,
        level,
        blocks: JSON.stringify(blocksFor("full", level, coreLevel, deload)),
      });
    }

    for (const day of coreDays) {
      seeds.push({
        date: day.date,
        week,
        phase,
        focus: "core",
        title: `Core circuit — level ${coreLevel}`,
        purpose: options.absGoal
          ? "Ten focused minutes. Abs are built here and revealed in the kitchen."
          : "Ten focused minutes of trunk work to protect the miles.",
        minutes: 12,
        level: coreLevel,
        blocks: JSON.stringify(blocksFor("core", level, coreLevel, deload)),
      });
    }
  }

  return seeds;
}

async function insertSeeds(seeds: StrengthSeed[]): Promise<void> {
  for (const seed of seeds) {
    await db.insert(strengthSessions).values(seed).onConflictDoNothing();
  }
}

export async function ensureStrengthPlan(current: Profile): Promise<void> {
  await ready();
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(strengthSessions);
  if (Number(count) > 0) return;

  const plan = await db.select().from(workouts).orderBy(workouts.date);
  await insertSeeds(
    buildStrengthPlan(plan, {
      strengthDays: current.strengthDays,
      absGoal: current.absGoal === 1,
      raceDate: current.raceDate,
    }),
  );
}

/**
 * Rebuilds from today forward when the number of strength days or the abs goal
 * changes. Anything already done or skipped stays exactly as it was.
 */
export async function regenerateStrengthPlan(current: Profile): Promise<void> {
  await ready();
  const from = todayISO();

  await db
    .delete(strengthSessions)
    .where(and(gte(strengthSessions.date, from), eq(strengthSessions.status, "planned")));

  const plan = await db.select().from(workouts).where(gte(workouts.date, from)).orderBy(workouts.date);
  await insertSeeds(
    buildStrengthPlan(plan, {
      strengthDays: current.strengthDays,
      absGoal: current.absGoal === 1,
      raceDate: current.raceDate,
    }),
  );
}

export async function strengthFor(date: string): Promise<StrengthSession | null> {
  await ready();
  const [row] = await db.select().from(strengthSessions).where(eq(strengthSessions.date, date));
  return row ?? null;
}

export async function strengthBetween(from: string, to: string): Promise<StrengthSession[]> {
  await ready();
  return db
    .select()
    .from(strengthSessions)
    .where(and(gte(strengthSessions.date, from), sql`${strengthSessions.date} <= ${to}`))
    .orderBy(strengthSessions.date);
}

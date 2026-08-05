import { and, eq, gte, sql } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { strengthSessions, workouts, type Profile, type StrengthSession, type Workout } from "@/drizzle/schema";
import { addDays, dayOfWeek, todayISO } from "@/lib/date";
import { phaseFor, type Phase } from "@/lib/plan/types";
import { KEYS, getSetting, setSetting } from "@/lib/settings";
import { blocksFor, coreLevelFor, strengthLevelFor, type Focus, type StrengthVariant } from "./exercises";

/** Bump when the WorkoutX-backed catalog changes so planned sessions rewrite. */
export const STRENGTH_CATALOG_VERSION = "wx-runner-2026-08-05";

/**
 * Strength sits on a fixed weekly grid relative to the long run:
 *   +2 days  Strength A (lower)     — Monday after a Saturday long
 *   +4 days  Abs A                  — Wednesday
 *   −1 day   Strength B + Abs B     — Friday before a Saturday long
 *
 * Never the day before the long run for heavy lower body, never inside
 * the last three days before the race.
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

const TITLES_A: Record<number, string> = {
  1: "Strength A — foundation",
  2: "Strength A — build",
  3: "Strength A — heavy",
};

const TITLES_B: Record<number, string> = {
  1: "Strength B + Abs B — foundation",
  2: "Strength B + Abs B — build",
  3: "Strength B + Abs B — heavy",
};

function longRunDow(week: Workout[]): number {
  const long = week.find((day) => day.type === "long" || day.type === "race");
  return long ? dayOfWeek(long.date) : 6;
}

function dayByOffset(week: Workout[], longDow: number, offset: number): Workout | undefined {
  const target = (((longDow + offset) % 7) + 7) % 7;
  return week.find((day) => dayOfWeek(day.date) === target);
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
  const quietFrom = addDays(options.raceDate, -3);
  const liftDays = Math.max(0, Math.min(2, options.strengthDays));

  for (const [week, days] of [...byWeek.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const phase = (sorted[0]?.phase ?? phaseFor(totalWeeks - week)) as Phase;
    const level = strengthLevelFor(week, totalWeeks);
    const coreLevel = coreLevelFor(week, totalWeeks, options.absGoal);
    const deload = phase === "taper" || phase === "peak" || phase === "race";
    const L = longRunDow(sorted);

    const push = (
      day: Workout | undefined,
      focus: Focus,
      variant: StrengthVariant,
      title: string,
      purpose: string,
      minutes: number,
    ) => {
      if (!day || day.date >= quietFrom) return;
      if (day.type === "long" || day.type === "race") return;
      seeds.push({
        date: day.date,
        week,
        phase,
        focus,
        title,
        purpose,
        minutes,
        level: focus === "core" ? coreLevel : level,
        blocks: JSON.stringify(blocksFor(focus, level, coreLevel, deload, variant)),
      });
    };

    if (phase === "race") {
      push(
        dayByOffset(sorted, L, 2) ?? sorted[0],
        "mobility",
        "a",
        "Loosen up",
        "Race week. Move well, lift nothing, leave the legs alone.",
        15,
      );
      continue;
    }

    if (phase === "taper" && sorted[0] && sorted[0].weeksToRace === 1) {
      push(
        dayByOffset(sorted, L, 4),
        "core",
        "a",
        "Abs A — light",
        "Race week minus one. Ten quiet minutes of brace work, nothing that leaves you sore.",
        12,
      );
      continue;
    }

    if (liftDays >= 1) {
      push(
        dayByOffset(sorted, L, 2),
        "full",
        "a",
        deload ? "Strength A — sharpen" : TITLES_A[level],
        deload
          ? "Half the volume, same lower-body pattern. Enough to keep what you built."
          : "Lower body and posterior chain. Forty-eight hours after the long run, two days before Tuesday's run.",
        deload ? 28 : 40,
      );
    }

    if (liftDays >= 2 && phase !== "taper" && phase !== "peak") {
      push(
        dayByOffset(sorted, L, -1),
        "full",
        "b",
        deload ? "Strength B — sharpen + abs" : TITLES_B[level],
        "Upper body, hips, and anti-collapse, plus a short Abs B finisher. No heavy legs the day before the long run.",
        deload ? 28 : 40,
      );
    } else if (liftDays >= 2 && phase === "taper") {
      push(
        dayByOffset(sorted, L, 4),
        "core",
        "a",
        `Abs A — level ${coreLevel}`,
        "Taper week. Core only — keep the brace pattern awake without loading the legs.",
        12,
      );
    }

    if (phase !== "taper" && phase !== "peak") {
      push(
        dayByOffset(sorted, L, 4),
        "core",
        "a",
        `Abs A — level ${coreLevel}`,
        options.absGoal
          ? "Dedicated core day. Abs are built here and revealed in the kitchen."
          : "Dedicated trunk work to protect the miles.",
        18,
      );
    } else if (phase === "peak") {
      push(
        dayByOffset(sorted, L, 4),
        "core",
        "a",
        "Abs A — short",
        "Peak week. Short core only — Saturday's twelve miler is the session that matters.",
        12,
      );
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
  const version = await getSetting(KEYS.strengthCatalog);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(strengthSessions);

  if (Number(count) === 0) {
    const plan = await db.select().from(workouts).orderBy(workouts.date);
    await insertSeeds(
      buildStrengthPlan(plan, {
        strengthDays: current.strengthDays,
        absGoal: current.absGoal === 1,
        raceDate: current.raceDate,
      }),
    );
    await setSetting(KEYS.strengthCatalog, STRENGTH_CATALOG_VERSION);
    return;
  }

  if (version !== STRENGTH_CATALOG_VERSION) {
    await regenerateStrengthPlan(current);
    await setSetting(KEYS.strengthCatalog, STRENGTH_CATALOG_VERSION);
  }
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

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { workouts, type Workout } from "@/drizzle/schema";
import { uid } from "@/lib/auth/current";
import { addDays, dayOfWeek, startOfWeek } from "@/lib/date";

/**
 * The three escape hatches that keep a 28-week block survivable: skip a day,
 * repeat a week, or move the long run. None of them punish the runner by
 * stacking missed mileage onto later weeks.
 */

export async function markDone(date: string): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .update(workouts)
    .set({ status: "done", skipReason: null })
    .where(and(eq(workouts.userId, user), eq(workouts.date, date)));
}

export async function markPlanned(date: string): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .update(workouts)
    .set({ status: "planned", skipReason: null })
    .where(and(eq(workouts.userId, user), eq(workouts.date, date)));
}

export async function skipWorkout(date: string, reason: string): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .update(workouts)
    .set({ status: "skipped", skipReason: reason || null })
    .where(and(eq(workouts.userId, user), eq(workouts.date, date)));
}

export async function weekWorkouts(weekStart: string): Promise<Workout[]> {
  await ready();
  const user = await uid();
  return db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, user),
        gte(workouts.date, weekStart),
        lte(workouts.date, addDays(weekStart, 6)),
      ),
    )
    .orderBy(workouts.date);
}

/**
 * Repeats the current week's prescription next week instead of progressing.
 * Only touches days that are still planned, so logged work is never rewritten.
 */
export async function holdWeek(weekStart: string): Promise<void> {
  await ready();
  const user = await uid();
  const thisWeek = await weekWorkouts(weekStart);
  const nextStart = addDays(weekStart, 7);
  const nextWeek = await weekWorkouts(nextStart);
  if (thisWeek.length === 0 || nextWeek.length === 0) return;

  // Never rewrite race week — the taper exists for a reason.
  if (nextWeek.some((day) => day.phase === "race")) return;

  const byDow = new Map<number, Workout>();
  for (const day of thisWeek) byDow.set(dayOfWeek(day.date), day);

  for (const target of nextWeek) {
    if (target.status !== "planned") continue;
    const source = byDow.get(dayOfWeek(target.date));
    if (!source) continue;

    await db
      .update(workouts)
      .set({
        type: source.type,
        title: source.title,
        distanceMi: source.distanceMi,
        durationMin: source.durationMin,
        purpose: source.purpose,
        tip: source.tip,
      })
      .where(and(eq(workouts.userId, user), eq(workouts.id, target.id)));
  }
}

/** Swaps the long run with another day in the same week. */
export async function moveLongRun(weekStart: string, targetDow: number): Promise<void> {
  await ready();
  const user = await uid();
  const week = await weekWorkouts(weekStart);
  const long = week.find((day) => day.type === "long");
  const target = week.find((day) => dayOfWeek(day.date) === targetDow);
  if (!long || !target || long.id === target.id) return;
  if (long.status !== "planned" || target.status !== "planned") return;

  const swap = (from: Workout) => ({
    type: from.type,
    title: from.title,
    distanceMi: from.distanceMi,
    durationMin: from.durationMin,
    purpose: from.purpose,
    tip: from.tip,
  });

  const longPayload = swap(long);
  const targetPayload = swap(target);

  await db
    .update(workouts)
    .set(targetPayload)
    .where(and(eq(workouts.userId, user), eq(workouts.id, long.id)));
  await db
    .update(workouts)
    .set(longPayload)
    .where(and(eq(workouts.userId, user), eq(workouts.id, target.id)));
}

const round25 = (value: number) => Math.round(value * 4) / 4;

/**
 * Keeps the number in a title honest after the workout changes. Minutes are
 * checked first: "Walk/run — 22 min" is measured in time, and "min" would
 * otherwise be read as a mileage unit.
 */
function retitle(title: string, distanceMi: number, durationMin: number | null): string {
  const minutes = /—\s*\d+\s*min\b/;
  if (durationMin !== null && minutes.test(title)) {
    return title.replace(minutes, `— ${durationMin} min`);
  }

  const miles = /—\s*[\d.]+\s*mi(?![a-z])/;
  if (miles.test(title)) {
    return title.replace(miles, `— ${round25(distanceMi)} mi`);
  }

  return title;
}

/**
 * Scales a week's running up or down in one move. Race week is untouchable, and
 * only still-planned days change, so history stays true.
 */
export async function scaleWeek(weekStart: string, pct: number): Promise<void> {
  await ready();
  const user = await uid();
  const factor = Math.min(1.15, Math.max(0.5, pct / 100));
  const week = await weekWorkouts(weekStart);

  for (const day of week) {
    if (day.status !== "planned") continue;
    if (day.type === "rest" || day.type === "race" || day.type === "cross" || day.phase === "race") continue;

    const distanceMi = day.distanceMi > 0 ? Math.max(1, round25(day.distanceMi * factor)) : 0;
    const durationMin = day.durationMin ? Math.max(15, Math.round(day.durationMin * factor)) : day.durationMin;

    await db
      .update(workouts)
      .set({ distanceMi, durationMin, title: retitle(day.title, distanceMi, durationMin) })
      .where(and(eq(workouts.userId, user), eq(workouts.id, day.id)));
  }
}

/** Turns a single planned day into rest, an easy run, or a cross-train. */
export async function convertDay(date: string, to: "rest" | "easy" | "cross"): Promise<void> {
  await ready();
  const user = await uid();
  const [day] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, user), eq(workouts.date, date)));
  if (!day || day.status !== "planned" || day.type === "race") return;

  if (to === "rest") {
    await db
      .update(workouts)
      .set({
        type: "rest",
        title: "Rest",
        distanceMi: 0,
        durationMin: null,
        purpose: "Rest is training. This is when the adaptations actually happen.",
      })
      .where(and(eq(workouts.userId, user), eq(workouts.id, day.id)));
    return;
  }

  if (to === "cross") {
    await db
      .update(workouts)
      .set({
        type: "cross",
        title: "Cross-train — 30 min",
        distanceMi: 0,
        durationMin: 30,
        purpose: "Aerobic work without the pounding. Bike, swim, or the elliptical.",
      })
      .where(and(eq(workouts.userId, user), eq(workouts.id, day.id)));
    return;
  }

  const distanceMi = day.distanceMi > 0 ? Math.min(day.distanceMi, 4) : 2;
  await db
    .update(workouts)
    .set({
      type: "easy",
      title: `Easy run — ${round25(distanceMi)} mi`,
      distanceMi,
      durationMin: null,
      purpose: "Easy miles. Aerobic volume with almost no cost to recovery.",
    })
    .where(and(eq(workouts.userId, user), eq(workouts.id, day.id)));
}

/** Days in the same week that the long run can move to. */
export async function longRunOptions(weekStart: string): Promise<Workout[]> {
  const week = await weekWorkouts(weekStart);
  return week.filter((day) => day.status === "planned" && day.type !== "long");
}

export async function currentWeekStart(today: string): Promise<string> {
  return startOfWeek(today);
}

/** Marks every still-planned day before today as skipped, so streaks stay honest. */
export async function closeOutMissedDays(today: string): Promise<void> {
  await ready();
  const user = await uid();
  const stale = await db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, user),
        lte(workouts.date, addDays(today, -1)),
        eq(workouts.status, "planned"),
      ),
    );

  const runIds = stale.filter((day) => day.type !== "rest").map((day) => day.id);
  const restIds = stale.filter((day) => day.type === "rest").map((day) => day.id);

  if (restIds.length > 0) {
    await db
      .update(workouts)
      .set({ status: "done" })
      .where(and(eq(workouts.userId, user), inArray(workouts.id, restIds)));
  }
  if (runIds.length > 0) {
    await db
      .update(workouts)
      .set({ status: "skipped", skipReason: "missed" })
      .where(and(eq(workouts.userId, user), inArray(workouts.id, runIds)));
  }
}

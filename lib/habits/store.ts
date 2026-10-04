import { cache } from "react";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { habitStars } from "@/drizzle/schema";
import { uid } from "@/lib/auth/current";
import { addDays, startOfWeek, todayISO } from "@/lib/date";
import { HABITS, isHabitId, starKey, type HabitId } from "./catalog";

export { HABITS, isHabitId, starKey };
export type { HabitId };

export async function starsInRange(from: string, to: string): Promise<Set<string>> {
  await ready();
  const user = await uid();
  const rows = await db
    .select({ date: habitStars.date, habitId: habitStars.habitId })
    .from(habitStars)
    .where(
      and(
        eq(habitStars.userId, user),
        gte(habitStars.date, from),
        lte(habitStars.date, to),
        eq(habitStars.starred, 1),
      ),
    );

  return new Set(rows.map((row) => starKey(row.date, row.habitId as HabitId)));
}

/** Unstarred habits for today. Drives the tab badge. */
export const pendingCount = cache(async (): Promise<number> => {
  const today = todayISO();
  const stars = await starsInRange(today, today);
  return HABITS.filter((habit) => !stars.has(starKey(today, habit.id))).length;
});

export async function toggleStar(date: string, habitId: HabitId): Promise<void> {
  await ready();
  const user = await uid();

  const [existing] = await db
    .select({ starred: habitStars.starred })
    .from(habitStars)
    .where(
      and(eq(habitStars.userId, user), eq(habitStars.date, date), eq(habitStars.habitId, habitId)),
    );

  await setStar(date, habitId, existing?.starred !== 1);
}

/** Idempotent, so a widget tap that retries can't flip a star back off. */
export async function setStar(date: string, habitId: HabitId, on: boolean): Promise<void> {
  await ready();
  const user = await uid();
  if (date > todayISO()) return;

  const updatedAt = new Date().toISOString();
  const starred = on ? 1 : 0;

  await db
    .insert(habitStars)
    .values({ userId: user, date, habitId, starred, updatedAt })
    .onConflictDoUpdate({
      target: [habitStars.userId, habitStars.date, habitStars.habitId],
      set: { starred, updatedAt },
    });
}

/** Today's card: the same numbers as the hero on the Habits page. */
export async function todayHabits() {
  const today = todayISO();
  const stars = await starsInRange(addDays(today, -400), today);
  const habits = HABITS.map((habit) => ({
    id: habit.id,
    label: habit.label,
    done: stars.has(starKey(today, habit.id)),
  }));

  return {
    date: today,
    habits,
    done: habits.filter((habit) => habit.done).length,
    total: habits.length,
    streak: allStarStreak(stars, today),
  };
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** Consecutive days, ending today, where every habit has a star. */
export function allStarStreak(stars: Set<string>, today: string): number {
  let streak = 0;
  let cursor = today;
  while (true) {
    const complete = HABITS.every((habit) => stars.has(starKey(cursor, habit.id)));
    if (!complete) break;
    streak += 1;
    cursor = addDays(cursor, -1);
    if (streak > 400) break;
  }
  return streak;
}

export async function weekSheet(weekStart = startOfWeek(todayISO())) {
  const today = todayISO();
  const days = weekDays(weekStart);
  const from = addDays(days[0], -400);
  const stars = await starsInRange(from, today);
  const weekStars = days.reduce((total, date) => {
    return (
      total + HABITS.filter((habit) => stars.has(starKey(date, habit.id))).length
    );
  }, 0);

  return {
    today,
    weekStart,
    days,
    keys: [...stars],
    streak: allStarStreak(stars, today),
    weekStars,
    weekPossible: HABITS.length * days.filter((date) => date <= today).length,
  };
}

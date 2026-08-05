import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { strengthChecks, strengthLogs, strengthSessions } from "@/drizzle/schema";

export async function checkedExercises(date: string): Promise<Set<string>> {
  await ready();
  const rows = await db
    .select()
    .from(strengthChecks)
    .where(and(eq(strengthChecks.date, date), eq(strengthChecks.done, 1)));
  return new Set(rows.map((row) => row.exerciseId));
}

export async function toggleExercise(date: string, exerciseId: string, done: boolean): Promise<void> {
  await ready();
  await db
    .insert(strengthChecks)
    .values({ date, exerciseId, done: done ? 1 : 0 })
    .onConflictDoUpdate({
      target: [strengthChecks.date, strengthChecks.exerciseId],
      set: { done: done ? 1 : 0 },
    });
}

export async function setExerciseLoad(date: string, exerciseId: string, load: string | null): Promise<void> {
  await ready();
  await db
    .insert(strengthChecks)
    .values({ date, exerciseId, done: 0, load })
    .onConflictDoUpdate({
      target: [strengthChecks.date, strengthChecks.exerciseId],
      set: { load },
    });
}

export async function checkFor(date: string, exerciseId: string) {
  await ready();
  const [row] = await db
    .select()
    .from(strengthChecks)
    .where(and(eq(strengthChecks.date, date), eq(strengthChecks.exerciseId, exerciseId)));
  return row ?? null;
}

export async function historyForExercise(exerciseId: string, limit = 24) {
  await ready();
  return db
    .select({
      date: strengthChecks.date,
      done: strengthChecks.done,
      load: strengthChecks.load,
      status: strengthSessions.status,
      title: strengthSessions.title,
      notes: strengthLogs.notes,
      rpe: strengthLogs.rpe,
    })
    .from(strengthChecks)
    .leftJoin(strengthSessions, eq(strengthSessions.date, strengthChecks.date))
    .leftJoin(strengthLogs, eq(strengthLogs.date, strengthChecks.date))
    .where(eq(strengthChecks.exerciseId, exerciseId))
    .orderBy(desc(strengthChecks.date))
    .limit(limit);
}

export async function completeStrength(
  date: string,
  entry: { minutes: number | null; rpe: number | null; notes: string | null },
): Promise<void> {
  await ready();
  await db.update(strengthSessions).set({ status: "done", skipReason: null }).where(eq(strengthSessions.date, date));
  await db
    .insert(strengthLogs)
    .values({ date, ...entry, createdAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: strengthLogs.date, set: entry });
}

export async function skipStrength(date: string, reason: string): Promise<void> {
  await ready();
  await db
    .update(strengthSessions)
    .set({ status: "skipped", skipReason: reason || null })
    .where(eq(strengthSessions.date, date));
}

export async function reopenStrength(date: string): Promise<void> {
  await ready();
  await db
    .update(strengthSessions)
    .set({ status: "planned", skipReason: null })
    .where(eq(strengthSessions.date, date));
}

export async function strengthLogFor(date: string) {
  await ready();
  const [row] = await db.select().from(strengthLogs).where(eq(strengthLogs.date, date));
  return row ?? null;
}

/** Sessions done versus scheduled, used by Progress and the abs dashboard. */
export async function strengthAdherence(from: string, to: string): Promise<{ done: number; planned: number }> {
  await ready();
  const rows = await db
    .select()
    .from(strengthSessions)
    .where(and(gte(strengthSessions.date, from), lte(strengthSessions.date, to)));
  return {
    done: rows.filter((row) => row.status === "done").length,
    planned: rows.length,
  };
}

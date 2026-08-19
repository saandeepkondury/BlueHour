import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { strengthChecks, strengthLogs, strengthSessions } from "@/drizzle/schema";
import { uid } from "@/lib/auth/current";
import { exerciseById } from "@/lib/strength/exercises";

export async function checkedExercises(date: string): Promise<Set<string>> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(strengthChecks)
    .where(
      and(
        eq(strengthChecks.userId, user),
        eq(strengthChecks.date, date),
        eq(strengthChecks.done, 1),
      ),
    );
  return new Set(rows.map((row) => row.exerciseId));
}

export async function toggleExercise(date: string, exerciseId: string, done: boolean): Promise<void> {
  await ready();
  const user = await uid();
  const existing = await checkFor(date, exerciseId);
  const exercise = exerciseById(exerciseId);

  // Empty load + marked done ⇒ they did the prescription as written.
  let load = existing?.load?.trim() || null;
  if (done && !load && exercise?.prescription) {
    load = exercise.prescription;
  }

  await db
    .insert(strengthChecks)
    .values({ userId: user, date, exerciseId, done: done ? 1 : 0, load })
    .onConflictDoUpdate({
      target: [strengthChecks.userId, strengthChecks.date, strengthChecks.exerciseId],
      set: { done: done ? 1 : 0, load },
    });
}

export async function setExerciseLoad(date: string, exerciseId: string, load: string | null): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .insert(strengthChecks)
    .values({ userId: user, date, exerciseId, done: 0, load })
    .onConflictDoUpdate({
      target: [strengthChecks.userId, strengthChecks.date, strengthChecks.exerciseId],
      set: { load },
    });
}

export async function checkFor(date: string, exerciseId: string) {
  await ready();
  const user = await uid();
  const [row] = await db
    .select()
    .from(strengthChecks)
    .where(
      and(
        eq(strengthChecks.userId, user),
        eq(strengthChecks.date, date),
        eq(strengthChecks.exerciseId, exerciseId),
      ),
    );
  return row ?? null;
}

export async function historyForExercise(exerciseId: string, limit = 24) {
  await ready();
  const user = await uid();
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
    // The joins match on account as well as date, or one runner's session title
    // could surface on another's history.
    .leftJoin(
      strengthSessions,
      and(
        eq(strengthSessions.userId, user),
        eq(strengthSessions.date, strengthChecks.date),
      ),
    )
    .leftJoin(
      strengthLogs,
      and(eq(strengthLogs.userId, user), eq(strengthLogs.date, strengthChecks.date)),
    )
    .where(and(eq(strengthChecks.userId, user), eq(strengthChecks.exerciseId, exerciseId)))
    .orderBy(desc(strengthChecks.date))
    .limit(limit);
}

export async function completeStrength(
  date: string,
  entry: { minutes: number | null; rpe: number | null; notes: string | null },
): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .update(strengthSessions)
    .set({ status: "done", skipReason: null })
    .where(and(eq(strengthSessions.userId, user), eq(strengthSessions.date, date)));
  await db
    .insert(strengthLogs)
    .values({ userId: user, date, ...entry, createdAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: [strengthLogs.userId, strengthLogs.date],
      set: entry,
    });
}

export async function skipStrength(date: string, reason: string): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .update(strengthSessions)
    .set({ status: "skipped", skipReason: reason || null })
    .where(and(eq(strengthSessions.userId, user), eq(strengthSessions.date, date)));
}

export async function reopenStrength(date: string): Promise<void> {
  await ready();
  const user = await uid();
  await db
    .update(strengthSessions)
    .set({ status: "planned", skipReason: null })
    .where(and(eq(strengthSessions.userId, user), eq(strengthSessions.date, date)));
}

export async function strengthLogFor(date: string) {
  await ready();
  const user = await uid();
  const [row] = await db
    .select()
    .from(strengthLogs)
    .where(and(eq(strengthLogs.userId, user), eq(strengthLogs.date, date)));
  return row ?? null;
}

/** Sessions done versus scheduled, used by Progress and the abs dashboard. */
export async function strengthAdherence(from: string, to: string): Promise<{ done: number; planned: number }> {
  await ready();
  const user = await uid();
  const rows = await db
    .select()
    .from(strengthSessions)
    .where(
      and(
        eq(strengthSessions.userId, user),
        gte(strengthSessions.date, from),
        lte(strengthSessions.date, to),
      ),
    );
  return {
    done: rows.filter((row) => row.status === "done").length,
    planned: rows.length,
  };
}

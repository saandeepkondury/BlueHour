import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { coachSuggestions, profile, strengthSessions, type CoachSuggestion, type Profile } from "@/drizzle/schema";
import { addDays, isoInTimeZone, startOfWeek, todayISO } from "@/lib/date";
import { convertDay, holdWeek, moveLongRun, scaleWeek } from "@/lib/plan/adapt";
import { regenerateStrengthPlan } from "@/lib/strength/plan";
import { banRecipe, getSetting, KEYS, openaiConfig, setSetting } from "@/lib/settings";
import { reshuffleWeekMeals, updateProfile } from "@/lib/store";
import { askOpenAI, CoachError } from "./openai";
import { runRules } from "./rules";
import { buildSnapshot, type Snapshot } from "./snapshot";
import { parseChanges, type Change, type SuggestionDraft } from "./types";

/**
 * Suggestions are proposals, not decisions. The model is asked once a day from
 * what was actually logged — never as a chatbot. Nothing touches the plan
 * until Apply. Delete is a fingerprint tombstone so the same idea stays gone.
 */

export interface CoachRun {
  created: number;
  pending: number;
  askedModel: boolean;
  error: string | null;
  lastRunAt: string | null;
}

async function persist(
  drafts: SuggestionDraft[],
  snapshot: Snapshot,
  origin: "rules" | "openai",
  model: string | null,
): Promise<number> {
  const createdAt = new Date().toISOString();
  const serialized = JSON.stringify(snapshot);
  let created = 0;

  for (const draft of drafts) {
    const result = await db
      .insert(coachSuggestions)
      .values({
        createdAt,
        date: snapshot.today,
        origin,
        model,
        kind: draft.kind,
        title: draft.title,
        rationale: draft.rationale,
        confidence: draft.confidence,
        changes: JSON.stringify(draft.changes),
        snapshot: serialized,
        fingerprint: draft.fingerprint,
      })
      .onConflictDoNothing()
      .returning({ id: coachSuggestions.id });
    if (result.length > 0) created += 1;
  }

  return created;
}

function ranTodayInAustin(lastRunAt: string | null, today: string): boolean {
  if (!lastRunAt) return false;
  const parsed = new Date(lastRunAt);
  if (Number.isNaN(parsed.getTime())) return false;
  return isoInTimeZone(parsed) === today;
}

/**
 * Guardrails always run. The model runs at most once per Austin calendar day
 * unless skipModel is set (Today and Health ingest stay cheap).
 */
export async function refreshCoach(
  current: Profile,
  options?: { skipModel?: boolean },
): Promise<CoachRun> {
  await ready();
  const today = todayISO();
  const snapshot = await buildSnapshot(current, today);
  const lastRunAt = await getSetting(KEYS.lastCoachRun);

  let created = await persist(runRules(snapshot), snapshot, "rules", null);
  let askedModel = false;
  let error: string | null = null;

  const wantsModel =
    !options?.skipModel &&
    current.aiEnabled === 1 &&
    !ranTodayInAustin(lastRunAt, today);

  if (wantsModel) {
    const config = await openaiConfig();
    if (config.key) {
      askedModel = true;
      try {
        const drafts = await askOpenAI(snapshot, {
          key: config.key,
          model: config.model,
        });
        created += await persist(drafts, snapshot, "openai", config.model);
        await setSetting(KEYS.lastCoachRun, new Date().toISOString());
      } catch (caught) {
        error = caught instanceof CoachError ? caught.message : "The coach could not be reached.";
      }
    }
  }

  return {
    created,
    pending: await pendingCount(),
    askedModel,
    error,
    lastRunAt: (await getSetting(KEYS.lastCoachRun)) ?? lastRunAt,
  };
}

export function changesOf(row: CoachSuggestion): Change[] {
  try {
    return parseChanges(JSON.parse(row.changes));
  } catch {
    return [];
  }
}

export async function pendingSuggestions(): Promise<CoachSuggestion[]> {
  await ready();
  return db
    .select()
    .from(coachSuggestions)
    .where(eq(coachSuggestions.status, "pending"))
    .orderBy(desc(coachSuggestions.createdAt));
}

export async function pendingCount(): Promise<number> {
  return (await pendingSuggestions()).length;
}

export async function decidedSuggestions(limit = 30): Promise<CoachSuggestion[]> {
  await ready();
  return db
    .select()
    .from(coachSuggestions)
    .where(
      and(
        inArray(coachSuggestions.status, ["applied", "dismissed", "expired"]),
        gte(coachSuggestions.date, addDays(todayISO(), -60)),
      ),
    )
    .orderBy(desc(coachSuggestions.decidedAt), desc(coachSuggestions.createdAt))
    .limit(limit);
}

/** Anything stale enough that the data behind it has moved on. */
export async function expireOldSuggestions(): Promise<void> {
  await ready();
  const cutoff = addDays(todayISO(), -4);
  const stale = await db
    .select()
    .from(coachSuggestions)
    .where(eq(coachSuggestions.status, "pending"));

  for (const row of stale) {
    if (row.date >= cutoff) continue;
    await db
      .update(coachSuggestions)
      .set({ status: "expired", decidedAt: new Date().toISOString() })
      .where(eq(coachSuggestions.id, row.id));
  }
}

async function applyChange(change: Change, current: Profile): Promise<Profile> {
  switch (change.op) {
    case "hold_week":
      await holdWeek(change.weekStart);
      return current;
    case "scale_week":
      await scaleWeek(change.weekStart, change.pct);
      return current;
    case "move_long_run":
      await moveLongRun(change.weekStart, change.dow);
      return current;
    case "set_long_run_day":
      return updateProfile({ longRunDay: change.dow });
    case "convert_day":
      await convertDay(change.date, change.to);
      return current;
    case "skip_strength":
      await db
        .update(strengthSessions)
        .set({ status: "skipped", skipReason: "coach" })
        .where(and(eq(strengthSessions.date, change.date), eq(strengthSessions.status, "planned")));
      return current;
    case "set_calorie_delta":
      await setSetting(KEYS.calorieDelta, String(change.kcal));
      return current;
    case "set_protein_floor":
      await setSetting(KEYS.proteinFloor, String(change.gPerKg));
      return current;
    case "set_strength_days": {
      const [updated] = await db
        .update(profile)
        .set({ strengthDays: change.days, updatedAt: new Date().toISOString() })
        .where(eq(profile.id, current.id))
        .returning();
      const next = updated ?? current;
      await regenerateStrengthPlan(next);
      return next;
    }
    case "set_target_body_fat": {
      const [updated] = await db
        .update(profile)
        .set({ targetBodyFatPct: change.pct, updatedAt: new Date().toISOString() })
        .where(eq(profile.id, current.id))
        .returning();
      return updated ?? current;
    }
    case "set_diet_pref": {
      const next = await updateProfile({ dietPref: change.diet });
      await reshuffleWeekMeals(startOfWeek(todayISO()));
      return next;
    }
    case "reshuffle_meals":
      await reshuffleWeekMeals(change.weekStart);
      return current;
    case "ban_recipe": {
      await banRecipe(change.recipeId);
      await reshuffleWeekMeals(startOfWeek(todayISO()));
      return current;
    }
  }
}

export async function applySuggestion(id: number, current: Profile): Promise<void> {
  await ready();
  const [row] = await db.select().from(coachSuggestions).where(eq(coachSuggestions.id, id));
  if (!row || row.status !== "pending") return;

  let running = current;
  for (const change of changesOf(row)) {
    running = await applyChange(change, running);
  }

  await db
    .update(coachSuggestions)
    .set({ status: "applied", decidedAt: new Date().toISOString() })
    .where(eq(coachSuggestions.id, id));
}

export async function dismissSuggestion(id: number): Promise<void> {
  await ready();
  await db
    .update(coachSuggestions)
    .set({ status: "dismissed", decidedAt: new Date().toISOString() })
    .where(and(eq(coachSuggestions.id, id), eq(coachSuggestions.status, "pending")));
}

export async function deleteSuggestion(id: number): Promise<void> {
  await ready();
  await db
    .update(coachSuggestions)
    .set({ status: "deleted", decidedAt: new Date().toISOString() })
    .where(eq(coachSuggestions.id, id));
}

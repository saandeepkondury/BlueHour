import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, ready } from "@/lib/db";
import { reminderRuns } from "@/drizzle/schema";
import { runAsUser } from "@/lib/auth/scope";
import { pruneExpiredSessions } from "@/lib/auth/tokens";
import { allUserIds } from "@/lib/auth/users";
import { hourInTimeZone, todayISO } from "@/lib/date";
import { buildBrief } from "@/lib/notify/brief";
import { cronAuthorized } from "@/lib/notify/cron-auth";
import { sendPush } from "@/lib/notify/push";
import { getProfile } from "@/lib/store";
import { expireOldSuggestions, refreshCoach } from "@/lib/coach/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called by Vercel Cron. Hobby is limited to one run per day, so vercel.json
 * fires at 12:00 UTC. Every account is visited in turn and judged against its
 * own timezone and reminder hour, so a runner in Austin and one in Berlin each
 * get their brief in the morning. A recorded send prevents a retry from
 * delivering the same brief twice.
 */

interface Outcome {
  userId: string;
  sent?: number;
  skipped?: string;
  error?: string;
}

async function alreadySent(userId: string, date: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(reminderRuns)
    .where(and(eq(reminderRuns.userId, userId), eq(reminderRuns.date, date)));
  return Boolean(row);
}

async function remindOne(userId: string, appUrl: string, force: boolean): Promise<Outcome> {
  const current = await getProfile();

  if (current.remindersEnabled !== 1 && !force) {
    return { userId, skipped: "reminders are paused" };
  }
  if (!current.onboardedAt && !force) {
    return { userId, skipped: "not onboarded" };
  }

  const hour = hourInTimeZone(new Date(), current.timeZone);
  // Accept the following hour too, so a once-a-day schedule still lands after a
  // daylight-saving shift.
  const due = hour === current.reminderHour || hour === (current.reminderHour + 1) % 24;
  if (!due && !force) {
    return { userId, skipped: `hour ${hour} is not ${current.reminderHour}` };
  }

  const date = todayISO(current.timeZone);
  if (!force && (await alreadySent(userId, date))) {
    return { userId, skipped: "already sent today" };
  }

  // Once-a-day synthesis, then the brief can quote anything still waiting.
  await expireOldSuggestions();
  await refreshCoach(current);

  const brief = await buildBrief(date, appUrl);
  if (!brief) return { userId, skipped: "no session scheduled today" };

  const push = await sendPush(brief.push);
  if (push.sent > 0) {
    const sentAt = new Date().toISOString();
    await db
      .insert(reminderRuns)
      .values({ userId, date, sentAt, channels: "push" })
      .onConflictDoUpdate({
        target: [reminderRuns.userId, reminderRuns.date],
        set: { sentAt, channels: "push" },
      });
  }

  return { userId, sent: push.sent };
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await ready();
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || url.origin;

  const results: Outcome[] = [];
  for (const userId of await allUserIds()) {
    try {
      results.push(await runAsUser(userId, () => remindOne(userId, appUrl, force)));
    } catch (error) {
      // One broken account must not stop the rest of the run.
      console.error("morning brief failed", userId, error);
      results.push({ userId, error: "failed" });
    }
  }

  await pruneExpiredSessions();

  return NextResponse.json({
    ok: true,
    accounts: results.length,
    sent: results.reduce((total, row) => total + (row.sent ?? 0), 0),
    results,
  });
}

/** Same behaviour for a manual POST, which is easier to trigger from a phone. */
export const POST = GET;

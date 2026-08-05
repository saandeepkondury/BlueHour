import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, ready } from "@/lib/db";
import { reminderRuns } from "@/drizzle/schema";
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
 * fires at 12:00 UTC (6am CST / 7am CDT). Pro can switch that back to hourly.
 * We send when the Austin hour is the chosen reminder hour, or one hour later
 * to cover the DST offset on a once-a-day schedule. A recorded send prevents
 * a retry from delivering the brief twice.
 */

async function alreadySent(date: string): Promise<boolean> {
  await ready();
  const [row] = await db.select().from(reminderRuns).where(eq(reminderRuns.date, date));
  return Boolean(row);
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const date = todayISO();
  const current = await getProfile();

  if (current.remindersEnabled !== 1 && !force) {
    return NextResponse.json({ ok: true, skipped: "reminders are paused" });
  }

  const hour = hourInTimeZone(new Date());
  const due =
    hour === current.reminderHour || hour === (current.reminderHour + 1) % 24;
  if (!due && !force) {
    return NextResponse.json({ ok: true, skipped: `hour ${hour} is not ${current.reminderHour}` });
  }

  if (!force && (await alreadySent(date))) {
    return NextResponse.json({ ok: true, skipped: "already sent today" });
  }

  // Once-a-day synthesis, then the brief can quote anything still waiting.
  await expireOldSuggestions();
  await refreshCoach(current, { mode: "daily" });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || url.origin;
  const brief = await buildBrief(date, appUrl);
  if (!brief) {
    return NextResponse.json({ ok: true, skipped: "no session scheduled today" });
  }

  const push = await sendPush(brief.push);

  if (push.sent > 0) {
    await db
      .insert(reminderRuns)
      .values({ date, sentAt: new Date().toISOString(), channels: "push" })
      .onConflictDoUpdate({
        target: reminderRuns.date,
        set: { sentAt: new Date().toISOString(), channels: "push" },
      });
  }

  return NextResponse.json({
    ok: true,
    date,
    push,
    subject: brief.subject,
  });
}

/** Same behaviour for a manual POST, which is easier to trigger from a phone. */
export const POST = GET;

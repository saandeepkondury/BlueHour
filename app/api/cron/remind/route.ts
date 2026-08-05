import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, ready } from "@/lib/db";
import { reminderRuns } from "@/drizzle/schema";
import { hourInTimeZone, todayISO } from "@/lib/date";
import { buildBrief } from "@/lib/notify/brief";
import { sendEmail } from "@/lib/notify/email";
import { sendPush } from "@/lib/notify/push";
import { getProfile } from "@/lib/store";
import { refreshCoach } from "@/lib/coach/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called hourly by Vercel Cron. It sends nothing unless the current Austin hour
 * matches the runner's chosen reminder hour, and records the send so a retried
 * invocation cannot deliver the brief twice.
 */

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function alreadySent(date: string): Promise<boolean> {
  await ready();
  const [row] = await db.select().from(reminderRuns).where(eq(reminderRuns.date, date));
  return Boolean(row);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
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
  if (hour !== current.reminderHour && !force) {
    return NextResponse.json({ ok: true, skipped: `hour ${hour} is not ${current.reminderHour}` });
  }

  if (!force && (await alreadySent(date))) {
    return NextResponse.json({ ok: true, skipped: "already sent today" });
  }

  // Fresh guardrail advice before the brief quotes it.
  await refreshCoach(current, { useModel: false });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || url.origin;
  const brief = await buildBrief(date, appUrl);
  if (!brief) {
    return NextResponse.json({ ok: true, skipped: "no session scheduled today" });
  }

  const [email, push] = await Promise.all([
    sendEmail({
      to: current.email,
      subject: `Blue Hour — ${brief.subject}`,
      text: brief.text,
      html: brief.html,
    }),
    sendPush(brief.push),
  ]);

  const channels = [email.sent ? "email" : null, push.sent > 0 ? "push" : null]
    .filter(Boolean)
    .join(",");

  if (channels !== "") {
    await db
      .insert(reminderRuns)
      .values({ date, sentAt: new Date().toISOString(), channels })
      .onConflictDoUpdate({
        target: reminderRuns.date,
        set: { sentAt: new Date().toISOString(), channels },
      });
  }

  return NextResponse.json({
    ok: true,
    date,
    email,
    push,
    subject: brief.subject,
  });
}

/** Same behaviour for a manual POST, which is easier to trigger from a phone. */
export const POST = GET;

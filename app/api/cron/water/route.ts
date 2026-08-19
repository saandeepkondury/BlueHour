import { NextResponse } from "next/server";
import { ready } from "@/lib/db";
import { runAsUser } from "@/lib/auth/scope";
import { allUserIds } from "@/lib/auth/users";
import { hourInTimeZone, todayISO } from "@/lib/date";
import { cronAuthorized } from "@/lib/notify/cron-auth";
import { sendPush } from "@/lib/notify/push";
import { dueWaterSlot, waterPush, waterSlotKey } from "@/lib/notify/water";
import { KEYS, getSetting, setSetting } from "@/lib/settings";
import { getDayBundle, getDayLog, getProfile } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hydration nudge paced by each account's cup target. Vercel Hobby can only cron
 * once a day, so GitHub Actions hits this route hourly; every runner is checked
 * against their own timezone and only pinged when they are behind pace.
 */

interface Outcome {
  userId: string;
  sent?: number;
  skipped?: string;
  error?: string;
}

async function waterOne(userId: string, appUrl: string, force: boolean): Promise<Outcome> {
  const current = await getProfile();

  if (current.remindersEnabled !== 1 && !force) {
    return { userId, skipped: "reminders are paused" };
  }
  if (!current.onboardedAt && !force) {
    return { userId, skipped: "not onboarded" };
  }

  const date = todayISO(current.timeZone);
  const hour = hourInTimeZone(new Date(), current.timeZone);

  const [log, bundle] = await Promise.all([getDayLog(date), getDayBundle(date)]);
  const target = bundle?.targets.waterOz ?? 80;

  if (!force && log.waterOz >= target) {
    return { userId, skipped: "water target already met" };
  }

  const slot =
    dueWaterSlot(hour, target, force ? 0 : log.waterOz) ??
    (force ? { hour, minute: 0, index: 0 } : null);
  if (!slot) {
    return { userId, skipped: `hour ${hour} has no due water slot (or already on pace)` };
  }

  const key = waterSlotKey(date, slot.hour, slot.minute);
  if (!force && (await getSetting(KEYS.waterPushSlot)) === key) {
    return { userId, skipped: "already sent this slot" };
  }

  const push = await sendPush(waterPush(appUrl, log.waterOz, target, date));
  if (push.sent > 0) await setSetting(KEYS.waterPushSlot, key);

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
      results.push(await runAsUser(userId, () => waterOne(userId, appUrl, force)));
    } catch (error) {
      console.error("water reminder failed", userId, error);
      results.push({ userId, error: "failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    accounts: results.length,
    sent: results.reduce((total, row) => total + (row.sent ?? 0), 0),
    results,
  });
}

export const POST = GET;

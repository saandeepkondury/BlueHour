import { NextResponse } from "next/server";
import { hourInTimeZone, todayISO } from "@/lib/date";
import { cronAuthorized } from "@/lib/notify/cron-auth";
import { sendPush } from "@/lib/notify/push";
import { dueWaterSlot, waterPush, waterSlotKey } from "@/lib/notify/water";
import { KEYS, getSetting, setSetting } from "@/lib/settings";
import { getDayBundle, getDayLog, getProfile } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hydration nudge paced by the day's cup target. Vercel Hobby can only cron
 * once a day, so GitHub Actions hits this route hourly and we send when Austin
 * is on a cup-spaced slot (9am–8pm) and intake is behind pace.
 */

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const date = todayISO();
  const hour = hourInTimeZone(new Date());
  const current = await getProfile();

  if (current.remindersEnabled !== 1 && !force) {
    return NextResponse.json({ ok: true, skipped: "reminders are paused" });
  }

  const [log, bundle] = await Promise.all([getDayLog(date), getDayBundle(date)]);
  const target = bundle?.targets.waterOz ?? 80;

  if (!force && log.waterOz >= target) {
    return NextResponse.json({ ok: true, skipped: "water target already met" });
  }

  const slot =
    dueWaterSlot(hour, target, force ? 0 : log.waterOz) ??
    (force ? { hour, minute: 0, index: 0 } : null);

  if (!slot) {
    return NextResponse.json({
      ok: true,
      skipped: `hour ${hour} has no due water slot (or already on pace)`,
    });
  }

  const key = waterSlotKey(date, slot.hour, slot.minute);
  if (!force && (await getSetting(KEYS.waterPushSlot)) === key) {
    return NextResponse.json({ ok: true, skipped: "already sent this slot" });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || url.origin;
  const push = await sendPush(waterPush(appUrl, log.waterOz, target, date));

  if (push.sent > 0) {
    await setSetting(KEYS.waterPushSlot, key);
  }

  return NextResponse.json({
    ok: true,
    date,
    hour,
    slot: key,
    index: slot.index,
    push,
  });
}

export const POST = GET;

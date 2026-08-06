import { NextResponse } from "next/server";
import { hourInTimeZone, todayISO } from "@/lib/date";
import { cronAuthorized } from "@/lib/notify/cron-auth";
import { sendPush } from "@/lib/notify/push";
import { waterPush, waterSlotDue, waterSlotKey } from "@/lib/notify/water";
import { KEYS, getSetting, setSetting } from "@/lib/settings";
import { getDayBundle, getDayLog, getProfile } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hydration nudge every two waking hours. Vercel Hobby can only cron once a
 * day, so GitHub Actions hits this route hourly and we decide whether Austin
 * is on a due slot (8am–10pm, even hours).
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

  if (!waterSlotDue(hour) && !force) {
    return NextResponse.json({ ok: true, skipped: `hour ${hour} is outside the water window` });
  }

  const slot = waterSlotKey(date, hour);
  if (!force && (await getSetting(KEYS.waterPushSlot)) === slot) {
    return NextResponse.json({ ok: true, skipped: "already sent this slot" });
  }

  const [log, bundle] = await Promise.all([getDayLog(date), getDayBundle(date)]);
  const target = bundle?.targets.waterOz ?? 80;
  if (!force && log.waterOz >= target) {
    return NextResponse.json({ ok: true, skipped: "water target already met" });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || url.origin;
  const push = await sendPush(waterPush(appUrl, log.waterOz, target, date));

  if (push.sent > 0) {
    await setSetting(KEYS.waterPushSlot, slot);
  }

  return NextResponse.json({ ok: true, date, hour, slot, push });
}

export const POST = GET;

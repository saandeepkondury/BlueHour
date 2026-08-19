import { NextResponse } from "next/server";
import { authenticate, isDenied } from "@/lib/auth/request";
import { runAsUser } from "@/lib/auth/scope";
import { todayISO } from "@/lib/date";
import { buildBrief } from "@/lib/notify/brief";
import { CUP_OZ } from "@/lib/notify/water";
import { getDayBundle, getDayLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compact today snapshot for Siri App Intents on the iPhone shell, for whichever
 * account that phone signed in as.
 */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (isDenied(auth)) return auth.denied;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const date = todayISO();
  const [brief, log, bundle] = await runAsUser(auth.userId, () =>
    Promise.all([buildBrief(date, appUrl), getDayLog(date), getDayBundle(date)]),
  );

  if (!brief || !bundle) {
    return NextResponse.json({ error: "No plan for today." }, { status: 404 });
  }

  const waterTarget = bundle.targets.waterOz;
  const waterOz = log.waterOz;
  const cupsLeft = Math.max(0, Math.ceil((waterTarget - waterOz) / CUP_OZ));

  const spokenParts = [brief.push.title];
  if (brief.push.body) spokenParts.push(brief.push.body);
  if (waterOz > 0) {
    spokenParts.push(`${waterOz} of ${waterTarget} ounces of water so far.`);
  } else {
    spokenParts.push(`Water target is ${waterTarget} ounces.`);
  }

  return NextResponse.json({
    date,
    title: brief.push.title,
    summary: brief.push.body,
    spoken: spokenParts.join(" "),
    waterOz,
    waterTarget,
    cupsLeft,
  });
}

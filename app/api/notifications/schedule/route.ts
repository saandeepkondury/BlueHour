import { NextResponse } from "next/server";
import { authenticate, isDenied } from "@/lib/auth/request";
import { runAsUser } from "@/lib/auth/scope";
import { buildLocalSchedule } from "@/lib/notify/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Upcoming morning briefs, 10pm previews of the next day, and water pings for
 * the iPhone shell to schedule as native local notifications.
 */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (isDenied(auth)) return auth.denied;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const schedule = await runAsUser(auth.userId, () => buildLocalSchedule(appUrl));
  return NextResponse.json(schedule);
}

import { NextResponse } from "next/server";
import { guardIngest } from "@/lib/health/guard";
import { buildLocalSchedule } from "@/lib/notify/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Upcoming morning briefs and water pings for the iPhone shell to schedule
 * as native local notifications. Same sync key as Health ingest.
 */
export async function GET(request: Request) {
  const denied = await guardIngest(request);
  if (denied) return denied;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const schedule = await buildLocalSchedule(appUrl);
  return NextResponse.json(schedule);
}

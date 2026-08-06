import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, gateEnabled, isValidToken } from "@/lib/auth";
import { todayISO } from "@/lib/date";
import { guardIngest } from "@/lib/health/guard";
import { CUP_OZ } from "@/lib/notify/water";
import { addWater, getDayLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Log a cup from a notification action — iOS local (+ Cup) or web push.
 * Auth: Bearer sync key (iPhone shell) or the unlock cookie (PWA).
 */

async function authorize(request: Request): Promise<NextResponse | null> {
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ") || new URL(request.url).searchParams.has("key")) {
    return guardIngest(request);
  }

  if (!gateEnabled()) return null;
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!isValidToken(token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;

  let date = todayISO();
  let oz = CUP_OZ;

  try {
    const body = (await request.json()) as { date?: unknown; oz?: unknown };
    if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      date = body.date;
    }
    if (typeof body.oz === "number" && Number.isFinite(body.oz) && body.oz !== 0) {
      oz = body.oz;
    }
  } catch {
    // Empty body is fine — defaults to today + one cup.
  }

  await addWater(date, oz);
  const log = await getDayLog(date);

  revalidatePath("/");
  revalidatePath("/water");
  revalidatePath(`/day/${date}`);
  revalidatePath("/progress");

  return NextResponse.json({ ok: true, date, waterOz: log.waterOz, addedOz: oz });
}

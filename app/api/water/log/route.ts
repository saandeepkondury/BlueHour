import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authenticate, isDenied } from "@/lib/auth/request";
import { runAsUser } from "@/lib/auth/scope";
import { todayISO } from "@/lib/date";
import { CUP_OZ } from "@/lib/notify/water";
import { addWater, getDayLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Log a cup from a notification action — iOS local (+ Cup) or web push.
 * Auth: a device token from the iPhone shell, or the session cookie from the PWA.
 */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (isDenied(auth)) return auth.denied;

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

  const log = await runAsUser(auth.userId, async () => {
    await addWater(date, oz);
    return getDayLog(date);
  });

  revalidatePath("/");
  revalidatePath("/water");
  revalidatePath(`/day/${date}`);
  revalidatePath("/progress");

  return NextResponse.json({ ok: true, date, waterOz: log.waterOz, addedOz: oz });
}

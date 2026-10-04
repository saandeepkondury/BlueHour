import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authenticate, isDenied } from "@/lib/auth/request";
import { runAsUser } from "@/lib/auth/scope";
import { isHabitId, setStar, todayHabits } from "@/lib/habits/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sets one star from the home screen widget. The body names the desired state
 * rather than toggling, so a retried tap lands where the user meant.
 */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (isDenied(auth)) return auth.denied;

  const body = (await request.json().catch(() => null)) as
    | { date?: unknown; habitId?: unknown; on?: unknown }
    | null;
  const habitId = typeof body?.habitId === "string" ? body.habitId : "";
  const date = typeof body?.date === "string" ? body.date : "";
  if (!isHabitId(habitId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof body?.on !== "boolean") {
    return NextResponse.json({ error: "Expected { date, habitId, on }." }, { status: 400 });
  }
  const on = body.on;

  const habits = await runAsUser(auth.userId, async () => {
    await setStar(date, habitId, on);
    return todayHabits();
  });

  revalidatePath("/habits");
  revalidatePath("/");
  return NextResponse.json(habits);
}

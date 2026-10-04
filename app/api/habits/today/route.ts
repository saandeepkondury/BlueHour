import { NextResponse } from "next/server";
import { authenticate, isDenied } from "@/lib/auth/request";
import { runAsUser } from "@/lib/auth/scope";
import { widgetToday } from "@/lib/habits/widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the home screen widget draws, for the account this phone signed in as. */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (isDenied(auth)) return auth.denied;
  const payload = await runAsUser(auth.userId, widgetToday);
  return NextResponse.json(payload);
}

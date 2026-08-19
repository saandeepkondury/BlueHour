import { NextResponse } from "next/server";
import { authenticate, isDenied } from "@/lib/auth/request";
import { runAsUser } from "@/lib/auth/scope";
import { sendPush } from "@/lib/notify/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (isDenied(auth)) return auth.denied;

  const result = await runAsUser(auth.userId, () =>
    sendPush({
      title: "Blue Hour",
      body: "Push is working. This is what the morning brief will look like.",
      url: process.env.NEXT_PUBLIC_APP_URL || "/",
    }),
  );

  if (result.sent === 0) {
    return NextResponse.json({ ok: false, ...result }, { status: 503 });
  }
  return NextResponse.json({ ok: true, ...result });
}

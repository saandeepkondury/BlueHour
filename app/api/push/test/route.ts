import { NextResponse } from "next/server";
import { sendPush } from "@/lib/notify/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await sendPush({
    title: "Blue Hour",
    body: "Push is working. This is what the morning brief will look like.",
    url: process.env.NEXT_PUBLIC_APP_URL || "/",
  });

  if (result.sent === 0) {
    return NextResponse.json({ ok: false, ...result }, { status: 503 });
  }
  return NextResponse.json({ ok: true, ...result });
}

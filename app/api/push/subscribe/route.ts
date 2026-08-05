import { NextResponse } from "next/server";
import { deletePushSubscription, savePushSubscription } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stores the browser's push subscription. Guarded by the same passcode as the app. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const sub = body as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "incomplete subscription" }, { status: 400 });
  }

  await savePushSubscription({
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const endpoint = (body as { endpoint?: string }).endpoint;
  if (!endpoint) return NextResponse.json({ error: "endpoint is required" }, { status: 400 });

  await deletePushSubscription(endpoint);
  return NextResponse.json({ ok: true });
}

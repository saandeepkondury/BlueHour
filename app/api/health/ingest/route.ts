import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ingestHealth, parsePayload, PayloadError } from "@/lib/health/ingest";
import { lastSync } from "@/lib/health/read";
import { refreshCoach } from "@/lib/coach/store";
import { getProfile } from "@/lib/store";
import { getSetting, KEYS } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where Apple Health data arrives — from the iPhone Shortcut, or from a native
 * shell if one is ever built. Health data is the most sensitive thing this app
 * stores, so this route refuses to run without a key rather than falling open
 * the way the passcode gate does.
 */

async function secrets(): Promise<string[]> {
  const fromEnv = process.env.HEALTH_INGEST_SECRET?.trim();
  const stored = (await getSetting(KEYS.ingestToken))?.trim();
  return [fromEnv, stored].filter((value): value is string => !!value && value.length > 0);
}

function matches(token: string, expected: string): boolean {
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Accepts a bearer header or a ?key= query, because Shortcuts makes headers fiddly. */
function presented(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return new URL(request.url).searchParams.get("key")?.trim() ?? "";
}

async function guard(request: Request): Promise<NextResponse | null> {
  const allowed = await secrets();
  if (allowed.length === 0) {
    return NextResponse.json(
      { error: "No sync key configured. Generate one on the Apple Health screen." },
      { status: 503 },
    );
  }
  const token = presented(request);
  if (!token || !allowed.some((expected) => matches(token, expected))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  try {
    const result = await ingestHealth(parsePayload(body));

    // New data can change what the guardrails see, so re-run them immediately.
    // The model is left for the coach screen, where a person is watching.
    const current = await getProfile();
    const coach = await refreshCoach(current, { useModel: false });

    revalidatePath("/");
    revalidatePath("/core");
    revalidatePath("/coach");

    return NextResponse.json({ ok: true, ...result, suggestions: coach.pending });
  } catch (error) {
    if (error instanceof PayloadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("health ingest failed", error);
    return NextResponse.json({ error: "ingest failed" }, { status: 500 });
  }
}

/** Lets the phone confirm the URL and key before it asks for Health access. */
export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;

  return NextResponse.json({ ok: true, lastSync: await lastSync() });
}

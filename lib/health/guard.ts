import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSetting, KEYS } from "@/lib/settings";

/**
 * Shared gate for anything the iPhone shell calls: Health ingest and the
 * local-notification schedule. Same key as HEALTH_INGEST_SECRET.
 */

export async function ingestSecrets(): Promise<string[]> {
  const fromEnv = process.env.HEALTH_INGEST_SECRET?.trim();
  const stored = (await getSetting(KEYS.ingestToken))?.trim();
  return [fromEnv, stored].filter((value): value is string => !!value && value.length > 0);
}

function matches(token: string, expected: string): boolean {
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function presentedIngestToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return new URL(request.url).searchParams.get("key")?.trim() ?? "";
}

export async function guardIngest(request: Request): Promise<NextResponse | null> {
  const allowed = await ingestSecrets();
  if (allowed.length === 0) {
    return NextResponse.json(
      { error: "No sync key configured. Set HEALTH_INGEST_SECRET." },
      { status: 503 },
    );
  }
  const token = presentedIngestToken(request);
  if (!token || !allowed.some((expected) => matches(token, expected))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

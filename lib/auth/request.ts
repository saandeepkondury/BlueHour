import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { settings, users } from "@/drizzle/schema";
import { KEYS } from "@/lib/settings";
import { sessionUserId } from "./session";
import { bearerToken, userIdForDeviceToken } from "./tokens";

/**
 * Who is calling an API route. Three ways in, in order of preference:
 *
 * 1. A device token issued by signing in from the iPhone shell.
 * 2. A sync key the runner pasted into Settings, stored against their account.
 * 3. `HEALTH_INGEST_SECRET`, which only resolves when the deploy has exactly one
 *    account — the upgrade path for a personal install that predates accounts.
 *
 * The session cookie is accepted too, for the installed PWA calling its own
 * endpoints.
 */

async function userIdForStoredSyncKey(token: string): Promise<string | null> {
  await ready();
  const [row] = await db
    .select({ userId: settings.userId })
    .from(settings)
    .where(and(eq(settings.key, KEYS.ingestToken), eq(settings.value, token)));
  return row?.userId ?? null;
}

async function soleUserId(): Promise<string | null> {
  await ready();
  const rows = await db.select({ id: users.id }).from(users).limit(2);
  return rows.length === 1 ? rows[0].id : null;
}

async function userIdForLegacySecret(token: string): Promise<string | null> {
  const secret = process.env.HEALTH_INGEST_SECRET?.trim();
  if (!secret || token !== secret) return null;
  return soleUserId();
}

export async function userIdForRequest(request: Request): Promise<string | null> {
  const token = bearerToken(request);

  if (token) {
    return (
      (await userIdForDeviceToken(token)) ??
      (await userIdForStoredSyncKey(token)) ??
      (await userIdForLegacySecret(token))
    );
  }

  return sessionUserId();
}

export type ApiAuth = { userId: string } | { denied: NextResponse };

export function isDenied(auth: ApiAuth): auth is { denied: NextResponse } {
  return "denied" in auth;
}

export async function authenticate(request: Request): Promise<ApiAuth> {
  const userId = await userIdForRequest(request);
  if (userId) return { userId };
  return {
    denied: NextResponse.json(
      { error: "unauthorized", hint: "Sign in from the app to get a device token." },
      { status: 401 },
    ),
  };
}

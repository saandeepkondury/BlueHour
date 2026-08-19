import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { deviceTokens, sessions } from "@/drizzle/schema";

/**
 * Session and device tokens are random secrets held only by the client. The
 * database stores a SHA-256 of each one, so a dump of the tables cannot be
 * replayed as a login.
 */

export const SESSION_TTL_DAYS = 90;

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return new URL(request.url).searchParams.get("key")?.trim() ?? "";
}

// ---------- sessions ----------

export async function createSessionToken(
  userId: string,
  userAgent?: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  await ready();
  const token = newToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000);

  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastSeenAt: now.toISOString(),
    userAgent: userAgent?.slice(0, 200) ?? null,
  });

  return { token, expiresAt };
}

export async function userIdForSessionToken(token: string): Promise<string | null> {
  if (!token) return null;
  await ready();
  const [row] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date().toISOString())));
  return row?.userId ?? null;
}

export async function revokeSessionToken(token: string): Promise<void> {
  if (!token) return;
  await ready();
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await ready();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Clears expired rows. Cheap enough to call from the daily cron. */
export async function pruneExpiredSessions(): Promise<void> {
  await ready();
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString()));
}

// ---------- device tokens ----------

export async function createDeviceToken(userId: string, label: string): Promise<string> {
  await ready();
  const token = newToken();
  await db.insert(deviceTokens).values({
    id: hashToken(token),
    userId,
    label: label.trim().slice(0, 60) || "iPhone",
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  });
  return token;
}

export async function userIdForDeviceToken(token: string): Promise<string | null> {
  if (!token) return null;
  await ready();
  const id = hashToken(token);
  const [row] = await db
    .select({ userId: deviceTokens.userId })
    .from(deviceTokens)
    .where(eq(deviceTokens.id, id));
  if (!row) return null;

  await db
    .update(deviceTokens)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(deviceTokens.id, id));
  return row.userId;
}

export async function listDeviceTokens(userId: string) {
  await ready();
  return db
    .select({
      id: deviceTokens.id,
      label: deviceTokens.label,
      createdAt: deviceTokens.createdAt,
      lastUsedAt: deviceTokens.lastUsedAt,
    })
    .from(deviceTokens)
    .where(eq(deviceTokens.userId, userId));
}

export async function revokeDeviceToken(userId: string, id: string): Promise<void> {
  await ready();
  await db
    .delete(deviceTokens)
    .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.id, id)));
}

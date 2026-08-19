import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE } from "@/lib/auth-cookie";
import { findUserById } from "./users";
import {
  createSessionToken,
  revokeSessionToken,
  SESSION_TTL_DAYS,
  userIdForSessionToken,
} from "./tokens";
import type { User } from "@/drizzle/schema";

export { SESSION_COOKIE };

/**
 * The browser half of authentication: an HttpOnly cookie holding a session
 * token. Reads are cached per request so a layout and its pages share one
 * lookup.
 */

/** Only callable from a server action or route handler — cookies are read-only during render. */
export async function startSession(userId: string, userAgent?: string | null): Promise<void> {
  const { token } = await createSessionToken(userId, userAgent);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionToken(token);
  jar.delete(SESSION_COOKIE);
}

export const sessionUserId = cache(async (): Promise<string | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return userIdForSessionToken(token);
});

export const sessionUser = cache(async (): Promise<User | null> => {
  const id = await sessionUserId();
  if (!id) return null;
  return (await findUserById(id)) ?? null;
});

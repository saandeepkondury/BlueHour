import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-cookie";
import { authenticate, isDenied } from "@/lib/auth/request";
import { createSessionToken } from "@/lib/auth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trades the iPhone shell's device token for a web session.
 *
 * The native app and its WKWebView keep separate credential stores, so without
 * this the runner would sign in twice: once natively for Health sync and again
 * inside the embedded pages. The app calls this after signing in and injects the
 * result as a cookie into the web view.
 */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (isDenied(auth)) return auth.denied;

  const { token, expiresAt } = await createSessionToken(
    auth.userId,
    request.headers.get("user-agent"),
  );

  return NextResponse.json({
    cookieName: SESSION_COOKIE,
    token,
    expiresAt: expiresAt.toISOString(),
  });
}

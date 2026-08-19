import { NextResponse } from "next/server";
import { AppleAuthError, appleSignInConfigured, verifyAppleIdentityToken } from "@/lib/auth/apple";
import { resolveAppleUser } from "@/lib/auth/apple-user";
import { startSession } from "@/lib/auth/session";
import { createDeviceToken } from "@/lib/auth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign in with Apple.
 *
 * - mode "device" (default): iPhone shell — returns a device token.
 * - mode "session": browser — sets the session cookie and returns { ok, created }.
 *
 * POST { identityToken, name?, label?, mode? }
 */
export async function POST(request: Request) {
  if (!appleSignInConfigured()) {
    return NextResponse.json(
      { error: "Sign in with Apple is not configured. Set APPLE_CLIENT_ID." },
      { status: 503 },
    );
  }

  let body: {
    identityToken?: unknown;
    name?: unknown;
    label?: unknown;
    mode?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const identityToken = typeof body.identityToken === "string" ? body.identityToken : "";
  if (!identityToken) {
    return NextResponse.json({ error: "identityToken is required" }, { status: 400 });
  }

  let identity;
  try {
    identity = await verifyAppleIdentityToken(identityToken);
  } catch (error) {
    if (error instanceof AppleAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }

  const name = typeof body.name === "string" ? body.name : "";
  const label = typeof body.label === "string" ? body.label : "iPhone";
  const mode = body.mode === "session" ? "session" : "device";

  const { user, created } = await resolveAppleUser({ identity, name });

  if (mode === "session") {
    await startSession(user.id, request.headers.get("user-agent"));
    return NextResponse.json({
      ok: true,
      created,
      email: user.email,
      name: user.name,
    });
  }

  return NextResponse.json({
    token: await createDeviceToken(user.id, label),
    email: user.email,
    name: user.name,
    created,
  });
}

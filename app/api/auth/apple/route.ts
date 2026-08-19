import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AppleAuthError, appleSignInConfigured, verifyAppleIdentityToken } from "@/lib/auth/apple";
import { createDeviceToken } from "@/lib/auth/tokens";
import {
  createUser,
  findUserByAppleSub,
  findUserByEmail,
  linkAppleSub,
} from "@/lib/auth/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign in with Apple from the iPhone shell. Apple requires this once any other
 * sign-in method exists, and it is the only route that can create an account
 * without a password.
 *
 * POST { identityToken, name?, label? } -> { token, email, name, created }
 */
export async function POST(request: Request) {
  if (!appleSignInConfigured()) {
    return NextResponse.json(
      { error: "Sign in with Apple is not configured. Set APPLE_CLIENT_ID." },
      { status: 503 },
    );
  }

  let body: { identityToken?: unknown; name?: unknown; label?: unknown };
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

  let user = await findUserByAppleSub(identity.sub);
  let created = false;

  if (!user && identity.email) {
    // Same person coming back through Apple after signing up with a password.
    const byEmail = await findUserByEmail(identity.email);
    if (byEmail) {
      await linkAppleSub(byEmail.id, identity.sub);
      user = { ...byEmail, appleSub: identity.sub };
    }
  }

  if (!user) {
    // Private Relay can withhold the address; a placeholder keeps email unique
    // and the account usable, and the runner can set a real one later.
    const email = identity.email ?? `apple-${randomUUID()}@appleid.invalid`;
    user = await createUser({ email, name, appleSub: identity.sub });
    created = true;
  }

  return NextResponse.json({
    token: await createDeviceToken(user.id, label),
    email: user.email,
    name: user.name,
    created,
  });
}

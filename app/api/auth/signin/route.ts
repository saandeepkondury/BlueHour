import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { createDeviceToken } from "@/lib/auth/tokens";
import { findUserByEmail } from "@/lib/auth/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign-in for the iPhone shell. Returns a long-lived device token that the app
 * keeps in the keychain and sends as a Bearer on Health ingest, the day
 * snapshot, the notification schedule, and Siri — so a runner never types a
 * shared secret again.
 *
 * POST { email, password, label? } -> { token, email, name }
 */
export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown; label?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const label = typeof body.label === "string" ? body.label : "iPhone";

  const user = await findUserByEmail(email);
  // Verified even when the account is missing, so a wrong email and a wrong
  // password cost the same time.
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !ok) {
    return NextResponse.json({ error: "Email and password do not match." }, { status: 401 });
  }

  return NextResponse.json({
    token: await createDeviceToken(user.id, label),
    email: user.email,
    name: user.name,
  });
}

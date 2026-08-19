import { NextResponse } from "next/server";
import { passwordProblem } from "@/lib/auth/password";
import { createDeviceToken } from "@/lib/auth/tokens";
import { createUser, emailProblem, EmailTakenError } from "@/lib/auth/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Account creation for the iPhone shell, so a runner can start on the phone
 * without opening a browser first. Returns a device token; race setup still
 * happens in the app's onboarding screen.
 *
 * POST { email, password, name?, label? } -> { token, email, name }
 */
export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown; name?: unknown; label?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name : "";
  const label = typeof body.label === "string" ? body.label : "iPhone";

  const problem = emailProblem(email) ?? passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    const user = await createUser({ email, password, name });
    return NextResponse.json({
      token: await createDeviceToken(user.id, label),
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

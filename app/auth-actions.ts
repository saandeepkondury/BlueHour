"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, sessionUserId, startSession } from "@/lib/auth/session";
import { passwordProblem, verifyPassword } from "@/lib/auth/password";
import {
  createUser,
  deleteAccount,
  emailProblem,
  EmailTakenError,
  findUserByEmail,
  normalizeEmail,
} from "@/lib/auth/users";
import { createDeviceToken, revokeAllSessions, revokeDeviceToken } from "@/lib/auth/tokens";

/**
 * Account actions. Sign-up and sign-in both set the session cookie, so they can
 * only run as server actions or route handlers — never during a render.
 */

function safeNext(value: string): string {
  // Only same-origin paths, so a crafted ?next= cannot bounce anyone off-site.
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function signUp(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/"));

  const problem = emailProblem(email) ?? passwordProblem(password);
  if (problem) {
    redirect(`/signup?error=${encodeURIComponent(problem)}&next=${encodeURIComponent(next)}`);
  }

  let userId: string;
  try {
    const user = await createUser({ email, password, name });
    userId = user.id;
  } catch (error) {
    if (error instanceof EmailTakenError) {
      redirect(
        `/signup?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
      );
    }
    throw error;
  }

  await startSession(userId, (await headers()).get("user-agent"));
  redirect("/onboard");
}

export async function signIn(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/"));
  const wrong = `/signin?error=${encodeURIComponent("That email and password do not match.")}&next=${encodeURIComponent(next)}`;

  const user = await findUserByEmail(email);
  // Verify even when the account is missing so a wrong email and a wrong
  // password take the same amount of time to answer.
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !ok) redirect(wrong);

  await startSession(user.id, (await headers()).get("user-agent"));
  redirect(next);
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/signin");
}

/** Signs out everywhere — useful after a password change or a lost phone. */
export async function signOutEverywhere(): Promise<void> {
  const userId = await sessionUserId();
  if (userId) await revokeAllSessions(userId);
  await endSession();
  redirect("/signin");
}

export async function issueDeviceToken(formData: FormData): Promise<void> {
  const userId = await sessionUserId();
  if (!userId) redirect("/signin");

  const label = String(formData.get("label") ?? "iPhone");
  const token = await createDeviceToken(userId, label);
  // Shown once, then only its label remains. Passed back through the URL so the
  // page can display it without storing the plaintext anywhere.
  redirect(`/account?token=${encodeURIComponent(token)}`);
}

export async function revokeDevice(formData: FormData): Promise<void> {
  const userId = await sessionUserId();
  if (!userId) redirect("/signin");

  const id = String(formData.get("id") ?? "");
  if (id) await revokeDeviceToken(userId, id);
  revalidatePath("/account");
}

/**
 * Deletes the account and everything it owns. Apple requires this to be
 * reachable in-app, and the confirmation is deliberately typed by hand.
 */
export async function deleteMyAccount(formData: FormData): Promise<void> {
  const userId = await sessionUserId();
  if (!userId) redirect("/signin");

  const typed = normalizeEmail(String(formData.get("confirmEmail") ?? ""));
  const password = String(formData.get("password") ?? "");

  const { findUserById } = await import("@/lib/auth/users");
  const user = await findUserById(userId);
  if (!user) redirect("/signin");

  const emailMatches = typed === user.email;
  // Apple-only accounts have no password to check.
  const passwordMatches = user.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : true;

  if (!emailMatches || !passwordMatches) {
    redirect(
      `/account?error=${encodeURIComponent("Type your email exactly, with your password, to delete the account.")}`,
    );
  }

  await deleteAccount(userId);
  await endSession();
  redirect("/signin?deleted=1");
}

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, LEGACY_USER_ID, ready } from "@/lib/db";
import {
  coachSuggestions,
  dayLogs,
  deviceTokens,
  foodLogs,
  fuelChecks,
  groceryChecks,
  healthDays,
  healthSync,
  mealPlans,
  pantryItems,
  profile,
  pushSubscriptions,
  reminderRuns,
  sessions,
  settings,
  strengthChecks,
  strengthLogs,
  strengthSessions,
  supplementLogs,
  supplementPrefs,
  users,
  workoutLogs,
  workouts,
  type User,
} from "@/drizzle/schema";
import { hashPassword } from "./password";

/** Every table that holds per-account rows, for deletion and legacy adoption. */
const OWNED_TABLES = [
  profile,
  workouts,
  workoutLogs,
  healthDays,
  healthSync,
  mealPlans,
  foodLogs,
  dayLogs,
  groceryChecks,
  pantryItems,
  supplementPrefs,
  supplementLogs,
  fuelChecks,
  pushSubscriptions,
  reminderRuns,
  strengthSessions,
  strengthChecks,
  strengthLogs,
  coachSuggestions,
  settings,
];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailProblem(email: string): string | null {
  const value = normalizeEmail(email);
  if (value.length === 0) return "Enter an email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "That does not look like an email address.";
  return null;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  await ready();
  const [row] = await db.select().from(users).where(eq(users.email, normalizeEmail(email)));
  return row;
}

export async function findUserById(id: string): Promise<User | undefined> {
  await ready();
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
}

export async function findUserByAppleSub(appleSub: string): Promise<User | undefined> {
  await ready();
  const [row] = await db.select().from(users).where(eq(users.appleSub, appleSub));
  return row;
}

/** Every account, for the crons that have to visit each runner in turn. */
export async function allUserIds(): Promise<string[]> {
  await ready();
  const rows = await db.select({ id: users.id }).from(users);
  return rows.map((row) => row.id);
}

export async function userCount(): Promise<number> {
  await ready();
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(users);
  return Number(row?.n ?? 0);
}

export class EmailTakenError extends Error {
  constructor() {
    super("That email already has an account.");
  }
}

export async function createUser(input: {
  email: string;
  password?: string;
  name?: string;
  appleSub?: string;
}): Promise<User> {
  await ready();
  const email = normalizeEmail(input.email);
  if (await findUserByEmail(email)) throw new EmailTakenError();

  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    email,
    passwordHash: input.password ? await hashPassword(input.password) : null,
    name: input.name?.trim() ?? "",
    appleSub: input.appleSub ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(users).values(row);
  await adoptLegacyData(row.id);
  return (await findUserById(row.id))!;
}

export async function linkAppleSub(userId: string, appleSub: string): Promise<void> {
  await ready();
  await db
    .update(users)
    .set({ appleSub, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId));
}

export async function setPassword(userId: string, password: string): Promise<void> {
  await ready();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId));
}

/**
 * Hands training data from a pre-accounts install to the first account created
 * on the deploy. Only ever runs once: after the first account exists there is
 * nothing left under the legacy owner, and a second account would be wrong to
 * hand someone else's history to.
 */
export async function adoptLegacyData(userId: string): Promise<boolean> {
  if (userId === LEGACY_USER_ID) return false;
  if ((await userCount()) !== 1) return false;

  let adopted = false;
  for (const table of OWNED_TABLES) {
    const moved = await db
      .update(table)
      .set({ userId })
      .where(eq(table.userId, LEGACY_USER_ID))
      .returning({ userId: table.userId });
    if (moved.length > 0) adopted = true;
  }
  return adopted;
}

/** Wipes an account and everything it owns. Required for App Store review. */
export async function deleteAccount(userId: string): Promise<void> {
  await ready();
  for (const table of OWNED_TABLES) {
    await db.delete(table).where(eq(table.userId, userId));
  }
  await db.delete(deviceTokens).where(eq(deviceTokens.userId, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

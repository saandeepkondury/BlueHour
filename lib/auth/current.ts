import { LEGACY_USER_ID } from "@/lib/db";
import { scopedUserId } from "./scope";
import { sessionUserId } from "./session";

/**
 * The one function the data layer asks for an owner. Nothing in lib/ reads or
 * writes a row without it, which is what keeps one runner's plan, meals, and
 * Health data out of another's.
 */

export class Unauthorized extends Error {
  constructor() {
    super("Not signed in.");
    this.name = "Unauthorized";
  }
}

export async function uid(): Promise<string> {
  const scoped = scopedUserId();
  if (scoped) return scoped;

  const fromCookie = await sessionUserId();
  if (fromCookie) return fromCookie;

  // Personal install / passcode gate: no account session yet.
  return LEGACY_USER_ID;
}

/** For the few places that render differently when signed out. */
export async function optionalUid(): Promise<string | null> {
  const scoped = scopedUserId();
  if (scoped) return scoped;
  return sessionUserId();
}

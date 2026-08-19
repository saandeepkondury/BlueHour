import { randomUUID } from "node:crypto";
import type { AppleIdentity } from "./apple";
import {
  createUser,
  findUserByAppleSub,
  findUserByEmail,
  linkAppleSub,
} from "./users";
import type { User } from "@/drizzle/schema";

/**
 * Find or create the Blue Hour account behind an Apple identity token.
 * Same person can arrive via Apple after an email signup — we link the sub.
 */
export async function resolveAppleUser(input: {
  identity: AppleIdentity;
  name?: string;
}): Promise<{ user: User; created: boolean }> {
  const { identity, name = "" } = input;

  let user = await findUserByAppleSub(identity.sub);
  if (user) return { user, created: false };

  if (identity.email) {
    const byEmail = await findUserByEmail(identity.email);
    if (byEmail) {
      await linkAppleSub(byEmail.id, identity.sub);
      return { user: { ...byEmail, appleSub: identity.sub }, created: false };
    }
  }

  // Private Relay can withhold the address; a placeholder keeps email unique
  // and the account usable. The runner can set a real one later if needed.
  const email = identity.email ?? `apple-${randomUUID()}@appleid.invalid`;
  user = await createUser({ email, name, appleSub: identity.sub });
  return { user, created: true };
}

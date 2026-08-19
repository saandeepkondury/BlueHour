import { createPublicKey, createVerify } from "node:crypto";

/**
 * Sign in with Apple, verified locally. The phone gets an identity token from
 * `ASAuthorizationAppleIDProvider` and posts it here; we check the signature
 * against Apple's published keys rather than trusting the payload. Required for
 * App Store review once any other sign-in method exists.
 */

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
const KEY_CACHE_MS = 60 * 60 * 1000;

interface AppleKey {
  kid: string;
  n: string;
  e: string;
  kty: string;
  alg: string;
}

type Global = typeof globalThis & {
  __bhAppleKeys?: { at: number; keys: AppleKey[] };
};

const g = globalThis as Global;

export class AppleAuthError extends Error {}

/** Bundle ids and Services IDs allowed to sign in. Comma-separated. */
function audiences(): string[] {
  const parts = [
    ...(process.env.APPLE_CLIENT_ID ?? "").split(","),
    ...(process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ?? "").split(","),
  ];
  return [...new Set(parts.map((value) => value.trim()).filter((value) => value.length > 0))];
}

export function appleSignInConfigured(): boolean {
  return audiences().length > 0;
}

async function appleKeys(): Promise<AppleKey[]> {
  const cached = g.__bhAppleKeys;
  if (cached && Date.now() - cached.at < KEY_CACHE_MS) return cached.keys;

  const response = await fetch(APPLE_KEYS_URL, { cache: "no-store" });
  if (!response.ok) throw new AppleAuthError("Could not reach Apple to verify the sign-in.");

  const body = (await response.json()) as { keys?: AppleKey[] };
  const keys = body.keys ?? [];
  if (keys.length === 0) throw new AppleAuthError("Apple returned no signing keys.");

  g.__bhAppleKeys = { at: Date.now(), keys };
  return keys;
}

function decodeSegment(segment: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new AppleAuthError("The Apple token was malformed.");
  }
}

export interface AppleIdentity {
  sub: string;
  email: string | null;
  emailVerified: boolean;
}

export async function verifyAppleIdentityToken(identityToken: string): Promise<AppleIdentity> {
  if (!appleSignInConfigured()) {
    throw new AppleAuthError("Sign in with Apple is not configured on this server.");
  }

  const parts = identityToken.split(".");
  if (parts.length !== 3) throw new AppleAuthError("The Apple token was malformed.");

  const [rawHeader, rawPayload, rawSignature] = parts;
  const header = decodeSegment(rawHeader);
  if (header.alg !== "RS256") throw new AppleAuthError("Unexpected Apple token algorithm.");

  const key = (await appleKeys()).find((candidate) => candidate.kid === header.kid);
  if (!key) throw new AppleAuthError("Apple signed the token with an unknown key.");

  const publicKey = createPublicKey({
    key: { kty: key.kty, n: key.n, e: key.e },
    format: "jwk",
  });

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${rawHeader}.${rawPayload}`);
  if (!verifier.verify(publicKey, Buffer.from(rawSignature, "base64url"))) {
    throw new AppleAuthError("The Apple token signature did not check out.");
  }

  const payload = decodeSegment(rawPayload);
  if (payload.iss !== APPLE_ISSUER) throw new AppleAuthError("The Apple token was not issued by Apple.");

  const aud = typeof payload.aud === "string" ? [payload.aud] : (payload.aud as string[]) ?? [];
  if (!aud.some((value) => audiences().includes(value))) {
    throw new AppleAuthError("The Apple token was issued for a different app.");
  }

  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) {
    throw new AppleAuthError("The Apple token has expired. Try signing in again.");
  }

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!sub) throw new AppleAuthError("The Apple token had no subject.");

  return {
    sub,
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
  };
}

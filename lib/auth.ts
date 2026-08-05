import { createHmac, timingSafeEqual } from "node:crypto";

export { AUTH_COOKIE } from "./auth-cookie";

function passcode(): string {
  return process.env.APP_PASSCODE ?? "";
}

/** With no passcode configured the app is open, which keeps localhost frictionless. */
export function gateEnabled(): boolean {
  return passcode().length > 0;
}

export function tokenFor(code: string): string {
  return createHmac("sha256", "blue-hour").update(code).digest("hex");
}

export function isValidCode(candidate: string): boolean {
  const expected = Buffer.from(tokenFor(passcode()));
  const actual = Buffer.from(tokenFor(candidate));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function isValidToken(token: string | undefined): boolean {
  if (!gateEnabled()) return true;
  if (!token) return false;
  const expected = Buffer.from(tokenFor(passcode()));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

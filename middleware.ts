import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-cookie";

/**
 * First line of the gate: bounce requests with no session cookie before any page
 * renders or touches the database. The cookie is only checked for presence here;
 * it is validated against the sessions table in the gated layout, which is where
 * a revoked or expired session is caught.
 */

const PUBLIC_PATHS = ["/signin", "/signup", "/privacy", "/terms"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const signin = new URL("/signin", request.url);
  if (pathname !== "/") signin.searchParams.set("next", pathname);
  return NextResponse.redirect(signin);
}

export const config = {
  /**
   * API routes authenticate themselves — the iPhone shell and the crons carry a
   * bearer token, not a cookie — so they are left out along with static assets.
   */
  matcher: [
    "/((?!api/|_next/|icon|apple-icon|opengraph-image|manifest\\.webmanifest|sw\\.js|favicon\\.ico).*)",
  ],
};

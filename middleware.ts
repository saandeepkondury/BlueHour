import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-cookie";

/**
 * Edge middleware can't use node:crypto, so it only checks that a cookie is
 * present. Pages re-verify the token value with lib/auth on the server.
 */
export function middleware(request: NextRequest) {
  if (!process.env.APP_PASSCODE) return NextResponse.next();
  if (request.cookies.get(AUTH_COOKIE)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // API routes are deliberately absent: each carries its own key, and the
  // iPhone Shortcut and Vercel Cron have no way to hold a browser cookie.
  matcher: [
    "/",
    "/plan",
    "/plan/:path*",
    "/fuel",
    "/fuel/:path*",
    "/core",
    "/coach",
    "/more",
    "/progress",
    "/settings",
    "/settings/:path*",
    "/recipe/:path*",
    "/day/:path*",
  ],
};

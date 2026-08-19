import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Return URL registered on the Apple Services ID. Popup sign-in finishes in
 * JS; this route exists so Apple's domain check and redirectURI resolve cleanly.
 */
export async function GET() {
  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST() {
  return GET();
}

import { NextResponse } from "next/server";
import { authenticate, isDenied } from "@/lib/auth/request";
import { parsePhotoParts, readMealPhoto } from "@/lib/meals/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves a meal photo to its owner only. Other accounts get a 404, not a 403. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string; file: string }> },
) {
  const auth = await authenticate(request);
  if (isDenied(auth)) return auth.denied;

  const { userId, file } = await params;
  const parts = parsePhotoParts(decodeURIComponent(userId), file);
  if (!parts || parts.userId !== auth.userId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const photo = await readMealPhoto(parts.userId, parts.file);
  if (!photo) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(photo.body as BodyInit, {
    headers: {
      "Content-Type": photo.contentType,
      // File names are random and never reused, so the bytes behind a URL never change.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

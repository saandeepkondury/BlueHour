import { NextResponse } from "next/server";
import { fetchWorkoutXGif } from "@/lib/workoutx/client";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const gif = await fetchWorkoutXGif(id);
  if (!gif) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(Buffer.from(gif.body), {
    headers: {
      "Content-Type": gif.contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}

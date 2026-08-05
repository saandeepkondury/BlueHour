import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";
import { ingestHealth, parsePayload, PayloadError } from "@/lib/health/ingest";
import { lastSync } from "@/lib/health/read";
import { guardIngest } from "@/lib/health/guard";
import { refreshCoach } from "@/lib/coach/store";
import { getProfile } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where the iPhone app posts Apple Health samples. Health data is the most
 * sensitive thing this app stores, so this route refuses to run without a key
 * rather than falling open the way the passcode gate does.
 */

export async function POST(request: Request) {
  const denied = await guardIngest(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  try {
    const result = await ingestHealth(parsePayload(body));

    revalidatePath("/");
    revalidatePath("/core");
    revalidatePath("/coach");

    // Coach refresh is useful but must not block the phone — a cold Next compile
    // plus rules can exceed the iOS URLSession timeout and look like a failed sync.
    after(async () => {
      try {
        const current = await getProfile();
        await refreshCoach(current, { mode: "rules" });
        revalidatePath("/coach");
      } catch (error) {
        console.error("post-ingest coach refresh failed", error);
      }
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PayloadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("health ingest failed", error);
    return NextResponse.json({ error: "ingest failed" }, { status: 500 });
  }
}

/** Lets the phone confirm the URL and key before it asks for Health access. */
export async function GET(request: Request) {
  const denied = await guardIngest(request);
  if (denied) return denied;

  return NextResponse.json({ ok: true, lastSync: await lastSync() });
}

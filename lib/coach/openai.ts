import { createHash } from "node:crypto";
import type { Snapshot } from "./snapshot";
import { parseChanges, type Confidence, type SuggestionDraft } from "./types";

/**
 * The language-model layer. It reads the same snapshot the rules do and can
 * only answer in the change vocabulary the app already knows how to perform,
 * which is what makes it safe to let it near a training plan. Nothing it
 * returns is applied automatically.
 */

export class CoachError extends Error {}

const TIMEOUT_MS = 45_000;

/** OPENAI_BASE_URL exists for gateways and proxies; unset means OpenAI itself. */
function endpoint(): string {
  const base = process.env.OPENAI_BASE_URL?.trim().replace(/\/$/, "");
  return `${base || "https://api.openai.com/v1"}/chat/completions`;
}

const SYSTEM = `You are the coach inside Blue Hour, a training app for one beginner runner preparing for the Austin Half Marathon while also trying to get visible abs.

You are given a JSON snapshot: the last 14 days of planned versus completed running, Apple Watch sleep, resting heart rate and HRV, logged nutrition against targets, strength and core sessions, body-composition trend, and the week ahead.

Your job is to propose at most three adjustments, ordered by importance. Be a good coach, not an enthusiastic one:

- Finishing healthy outranks the abs goal. The abs goal outranks lifting volume. Nothing outranks the long run.
- Only raise something you can point at in the data. Quote the actual numbers in your rationale.
- Prefer the smallest intervention that fixes the problem. Say nothing rather than say something vague.
- Never suggest a calorie deficit during taper or race week, and never on a long-run or race day.
- Never increase training load when recovery markers are down or runs are being missed.
- No medical claims, no diagnosis. If something looks like injury or illness, say so plainly and suggest rest and a doctor, with no plan changes attached.
- Write in plain sentences, no bullet lists, no emoji, no exclamation marks. Two to four sentences per rationale.

Reply with JSON only, in this shape:

{"suggestions":[{"kind":"short-slug","title":"one line, under 70 characters","rationale":"2-4 sentences citing the data","confidence":"low|medium|high","changes":[{"op":"...","...":"..."}]}]}

Allowed change operations, and nothing else:

{"op":"hold_week","weekStart":"YYYY-MM-DD"} repeat that week instead of progressing
{"op":"scale_week","weekStart":"YYYY-MM-DD","pct":50-115} scale that week's mileage
{"op":"move_long_run","weekStart":"YYYY-MM-DD","dow":0-6} 0 is Sunday, 6 is Saturday
{"op":"convert_day","date":"YYYY-MM-DD","to":"rest|easy|cross"}
{"op":"skip_strength","date":"YYYY-MM-DD"}
{"op":"set_calorie_delta","kcal":-400..400} positive adds calories back to the daily target
{"op":"set_protein_floor","gPerKg":1.2-2.6}
{"op":"set_strength_days","days":0-3}
{"op":"set_target_body_fat","pct":8-30}

Use only dates that appear in the snapshot. A suggestion may carry an empty changes array when the right move is a note rather than an edit. If the data genuinely warrants no changes, return {"suggestions":[]}.`;

function fingerprint(kind: string, title: string, date: string): string {
  const hash = createHash("sha256").update(`${kind}|${title}`).digest("hex").slice(0, 10);
  return `ai:${kind}:${date}:${hash}`;
}

function asConfidence(value: unknown): Confidence {
  return value === "low" || value === "high" ? value : "medium";
}

function toDrafts(raw: unknown, today: string): SuggestionDraft[] {
  if (typeof raw !== "object" || raw === null) return [];
  const list = (raw as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(list)) return [];

  const drafts: SuggestionDraft[] = [];
  for (const entry of list.slice(0, 3)) {
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const rationale = typeof item.rationale === "string" ? item.rationale.trim() : "";
    if (title === "" || rationale === "") continue;
    const kind = typeof item.kind === "string" && item.kind.trim() !== "" ? item.kind.trim() : "coach-note";

    drafts.push({
      kind,
      title,
      rationale,
      confidence: asConfidence(item.confidence),
      changes: parseChanges(item.changes),
      fingerprint: fingerprint(kind, title, today),
    });
  }
  return drafts;
}

export async function askOpenAI(
  snapshot: Snapshot,
  options: { key: string; model: string; question?: string },
): Promise<SuggestionDraft[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(endpoint(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.key}`,
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: options.question
              ? `${JSON.stringify(snapshot)}\n\nThe runner also asks: ${options.question}`
              : JSON.stringify(snapshot),
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      // Never echo the request back — it carries the key.
      throw new CoachError(
        response.status === 401
          ? "OpenAI rejected the API key."
          : `OpenAI returned ${response.status}. ${detail.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new CoachError("OpenAI returned an empty response.");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new CoachError("OpenAI did not return usable JSON.");
    }

    return toDrafts(parsed, snapshot.today);
  } catch (error) {
    if (error instanceof CoachError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new CoachError("The coach took too long to answer. Try again.");
    }
    throw new CoachError("Could not reach OpenAI.");
  } finally {
    clearTimeout(timer);
  }
}

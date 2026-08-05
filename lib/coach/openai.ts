import { startOfWeek } from "@/lib/date";
import type { Snapshot } from "./snapshot";
import { parseChanges, type Change, type Confidence, type SuggestionDraft } from "./types";

/**
 * The language-model layer. It reads the same snapshot the rules do and can
 * only answer in the change vocabulary the app already knows how to perform,
 * which is what makes it safe to let it near a training plan. Nothing it
 * returns is applied automatically. It is asked once a day, not on demand.
 */

export class CoachError extends Error {}

const TIMEOUT_MS = 45_000;

/** OPENAI_BASE_URL exists for gateways and proxies; unset means OpenAI itself. */
function endpoint(): string {
  const base = process.env.OPENAI_BASE_URL?.trim().replace(/\/$/, "");
  return `${base || "https://api.openai.com/v1"}/chat/completions`;
}

const SYSTEM = `You are the daily coach inside Blue Hour. There is one runner: a beginner training for the Ascension Seton Austin Half Marathon on Sunday, February 14, 2027, who also wants visible abs and a diet he will actually keep.

You are not a chatbot. You are not answering a question he typed. Once a day you read what he did versus what was planned, learn his preferences from that gap, and propose at most two conservative adjustments. Quiet is a valid outcome.

The snapshot includes:
- planned vs completed runs, rest days, strength and core
- sleep, resting heart rate, HRV
- meals eaten vs skipped, recipes he keeps ignoring, extra foods he logs instead
- grocery checks, fuel checks, supplements
- body-composition trend and fuel overrides
- past coach decisions he applied or dismissed — do not re-raise those

North star, in order:
1. Finish the half healthy on Feb 14, 2027.
2. Reveal abs without starving the training.
3. Make the diet, grocery list, rest, and lifting match the life he is actually living.

How to coach:
- Notice what he completes versus what he skips. Adjust the plan toward reality, do not nag him to follow a plan he is not following.
- Learn meal taste from eaten vs ignored recipes and from extra foods. Prefer banning or reshuffling over lecturing.
- Sleep debt and missed runs mean less load, not more ambition.
- Grocery lists that go unchecked while meals go uneaten means the menu is wrong, not that he needs more willpower.
- Prefer the smallest change. At most two suggestions. Empty list if nothing clear.
- Never invent data. Quote the numbers. Never increase load when recovery is down or sessions are being missed.
- Never suggest a calorie deficit in taper or race week, or on a long-run or race day.
- No medical claims. If something looks like injury or illness, say so plainly with no plan edits.
- Plain sentences. No bullets, no emoji, no exclamation marks. Two to four sentences per rationale.

Reply with JSON only:

{"suggestions":[{"kind":"short-slug","title":"one line, under 70 characters","rationale":"2-4 sentences citing the data","confidence":"low|medium|high","changes":[{"op":"...","...":"..."}]}]}

Allowed change operations, and nothing else:

{"op":"hold_week","weekStart":"YYYY-MM-DD"}
{"op":"scale_week","weekStart":"YYYY-MM-DD","pct":50-115}
{"op":"move_long_run","weekStart":"YYYY-MM-DD","dow":0-6}
{"op":"set_long_run_day","dow":0-6}
{"op":"convert_day","date":"YYYY-MM-DD","to":"rest|easy|cross"}
{"op":"skip_strength","date":"YYYY-MM-DD"}
{"op":"set_calorie_delta","kcal":-400..400}
{"op":"set_protein_floor","gPerKg":1.2-2.6}
{"op":"set_strength_days","days":0-3}
{"op":"set_target_body_fat","pct":8-30}
{"op":"set_diet_pref","diet":"omnivore|vegetarian|vegan"}
{"op":"reshuffle_meals","weekStart":"YYYY-MM-DD"}
{"op":"ban_recipe","recipeId":"id-from-snapshot"}

Use only dates and recipe ids that appear in the snapshot. A suggestion may carry an empty changes array when the right move is a note. If nothing warrants a change, return {"suggestions":[]}.`;

function fingerprint(kind: string, changes: Change[], today: string): string {
  const ops = changes.map((change) => change.op).sort().join("+") || "note";
  return `ai:${kind}:${ops}:${startOfWeek(today)}`;
}

function asConfidence(value: unknown): Confidence {
  return value === "low" || value === "high" ? value : "medium";
}

function toDrafts(raw: unknown, today: string): SuggestionDraft[] {
  if (typeof raw !== "object" || raw === null) return [];
  const list = (raw as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(list)) return [];

  const drafts: SuggestionDraft[] = [];
  for (const entry of list.slice(0, 2)) {
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const rationale = typeof item.rationale === "string" ? item.rationale.trim() : "";
    if (title === "" || rationale === "") continue;
    const kind = typeof item.kind === "string" && item.kind.trim() !== "" ? item.kind.trim() : "coach-note";
    const changes = parseChanges(item.changes);

    drafts.push({
      kind,
      title,
      rationale,
      confidence: asConfidence(item.confidence),
      changes,
      fingerprint: fingerprint(kind, changes, today),
    });
  }
  return drafts;
}

export async function askOpenAI(
  snapshot: Snapshot,
  options: { key: string; model: string },
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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(snapshot) },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
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
      throw new CoachError("The daily review took too long. It will try again tomorrow.");
    }
    throw new CoachError("Could not reach OpenAI.");
  } finally {
    clearTimeout(timer);
  }
}

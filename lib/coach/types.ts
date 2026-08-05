/**
 * The coach can only ask for changes from this list. Both the rule engine and
 * the language model produce the same shapes, so anything arriving from OpenAI
 * is validated into a known operation or thrown away — the model never gets to
 * write arbitrary instructions into the plan.
 */

export type Change =
  | { op: "hold_week"; weekStart: string }
  | { op: "scale_week"; weekStart: string; pct: number }
  | { op: "move_long_run"; weekStart: string; dow: number }
  | { op: "convert_day"; date: string; to: "rest" | "easy" | "cross" }
  | { op: "skip_strength"; date: string }
  | { op: "set_calorie_delta"; kcal: number }
  | { op: "set_protein_floor"; gPerKg: number }
  | { op: "set_strength_days"; days: number }
  | { op: "set_target_body_fat"; pct: number };

export type Confidence = "low" | "medium" | "high";

export interface SuggestionDraft {
  kind: string;
  title: string;
  rationale: string;
  confidence: Confidence;
  changes: Change[];
  /** Stable within a day so the same nudge is not raised twice. */
  fingerprint: string;
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const isISODate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Returns null for anything unrecognised or out of range. */
export function parseChange(raw: unknown): Change | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const num = (key: string): number | null => {
    const n = Number(value[key]);
    return Number.isFinite(n) ? n : null;
  };

  switch (value.op) {
    case "hold_week":
      return isISODate(value.weekStart) ? { op: "hold_week", weekStart: value.weekStart } : null;
    case "scale_week": {
      const pct = num("pct");
      if (!isISODate(value.weekStart) || pct === null) return null;
      return { op: "scale_week", weekStart: value.weekStart, pct: clamp(Math.round(pct), 50, 115) };
    }
    case "move_long_run": {
      const dow = num("dow");
      if (!isISODate(value.weekStart) || dow === null) return null;
      return { op: "move_long_run", weekStart: value.weekStart, dow: clamp(Math.round(dow), 0, 6) };
    }
    case "convert_day": {
      const to = value.to;
      if (!isISODate(value.date)) return null;
      if (to !== "rest" && to !== "easy" && to !== "cross") return null;
      return { op: "convert_day", date: value.date, to };
    }
    case "skip_strength":
      return isISODate(value.date) ? { op: "skip_strength", date: value.date } : null;
    case "set_calorie_delta": {
      const kcal = num("kcal");
      return kcal === null ? null : { op: "set_calorie_delta", kcal: clamp(Math.round(kcal), -400, 400) };
    }
    case "set_protein_floor": {
      const g = num("gPerKg");
      return g === null
        ? null
        : { op: "set_protein_floor", gPerKg: Math.round(clamp(g, 1.2, 2.6) * 10) / 10 };
    }
    case "set_strength_days": {
      const days = num("days");
      return days === null ? null : { op: "set_strength_days", days: clamp(Math.round(days), 0, 3) };
    }
    case "set_target_body_fat": {
      const pct = num("pct");
      return pct === null
        ? null
        : { op: "set_target_body_fat", pct: Math.round(clamp(pct, 8, 30) * 10) / 10 };
    }
    default:
      return null;
  }
}

export function parseChanges(raw: unknown): Change[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseChange).filter((change): change is Change => change !== null);
}

/** Plain-language line shown next to the Apply button, so nothing is a surprise. */
export function describeChange(change: Change): string {
  switch (change.op) {
    case "hold_week":
      return `Repeat this week's mileage in the week of ${change.weekStart} instead of progressing`;
    case "scale_week":
      return `Set the week of ${change.weekStart} to ${change.pct}% of its planned mileage`;
    case "move_long_run":
      return `Move that week's long run to ${DOW[change.dow]}`;
    case "convert_day":
      return change.to === "rest"
        ? `Turn ${change.date} into a rest day`
        : change.to === "cross"
          ? `Turn ${change.date} into a 30-minute cross-train`
          : `Turn ${change.date} into an easy run`;
    case "skip_strength":
      return `Drop the strength session on ${change.date}`;
    case "set_calorie_delta":
      return change.kcal === 0
        ? "Clear the calorie adjustment"
        : `${change.kcal > 0 ? "Add" : "Remove"} ${Math.abs(change.kcal)} kcal from the daily target`;
    case "set_protein_floor":
      return `Hold protein at ${change.gPerKg} g per kg of bodyweight`;
    case "set_strength_days":
      return change.days === 0
        ? "Pause full-body lifting"
        : `Lift ${change.days} day${change.days === 1 ? "" : "s"} a week`;
    case "set_target_body_fat":
      return `Set the body-fat target to ${change.pct}%`;
  }
}

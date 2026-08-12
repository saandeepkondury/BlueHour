import { monthOf } from "@/lib/date";
import type { WorkoutType } from "@/lib/plan/types";

export type Evidence = "solid" | "situational" | "thin";

export interface SupplementContext {
  date: string;
  type: WorkoutType;
  runMinutes: number;
  isRaceWeek: boolean;
  heat: boolean;
  proteinGap: boolean;
}

export interface Supplement {
  id: string;
  name: string;
  dose: string;
  timing: string;
  purpose: string;
  evidence: Evidence;
  /** Whether it belongs on today's list at all. */
  applies: (ctx: SupplementContext) => boolean;
}

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  solid: "Well supported",
  situational: "Useful in context",
  thin: "Thin evidence",
};

export const SUPPLEMENTS: Supplement[] = [
  {
    id: "vitamin-d",
    name: "Vitamin D3",
    dose: "1000–2000 IU",
    timing: "With breakfast",
    purpose:
      "Bone and muscle function through the darker months, when Austin mornings are dim and you are running before sunrise.",
    evidence: "situational",
    applies: ({ date }) => {
      const month = monthOf(date);
      return month >= 11 || month <= 3;
    },
  },
  {
    id: "protein-powder",
    name: "Protein powder",
    dose: "1 scoop (~25 g)",
    timing: "After the run, or with breakfast on rest days",
    purpose: "Only to close the gap when real food came up short. Food first, powder second.",
    evidence: "solid",
    applies: ({ proteinGap }) => proteinGap,
  },
  {
    id: "electrolytes",
    name: "Electrolyte tab or drink mix",
    dose: "1 serving (300–600 mg sodium)",
    timing: "In your bottle during the run",
    purpose:
      "Austin humidity pulls a lot of sodium out of you. Replacing some of it keeps late-run legs and stomach steady.",
    evidence: "solid",
    applies: ({ runMinutes, heat }) => runMinutes >= 60 || (heat && runMinutes >= 40),
  },
  {
    id: "caffeine",
    name: "Caffeine",
    dose: "1–3 mg per kg (a normal coffee is plenty)",
    timing: "45–60 min before the start",
    purpose:
      "One of the few genuinely reliable performance aids. Optional, and only if you already tolerate it in training.",
    evidence: "solid",
    applies: ({ type, isRaceWeek }) => type === "race" || (isRaceWeek && type === "long"),
  },
  {
    id: "carb-load",
    name: "Extra carbohydrate (food, not a pill)",
    dose: "7–10 g per kg per day for the final 2 days",
    timing: "Spread across meals, low fiber",
    purpose:
      "Tops off glycogen before 13.1 miles. Rice, pasta, bagels, potatoes — familiar things, larger portions.",
    evidence: "solid",
    applies: ({ isRaceWeek }) => isRaceWeek,
  },
  {
    id: "magnesium",
    name: "Magnesium glycinate",
    dose: "200–300 mg",
    timing: "Evening",
    purpose:
      "Sometimes helps sleep during the heaviest peak weeks. Evidence for cramp prevention specifically is weak.",
    evidence: "thin",
    applies: ({ type }) => type === "long",
  },
];

export function supplementsForDay(ctx: SupplementContext, disabled: Set<string>): Supplement[] {
  return SUPPLEMENTS.filter((item) => item.applies(ctx) && !disabled.has(item.id));
}

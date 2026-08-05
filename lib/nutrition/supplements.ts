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

export interface PlaybookStep {
  when: string;
  title: string;
  detail: string;
}

export const RACE_PLAYBOOK: PlaybookStep[] = [
  {
    when: "Race week, Monday to Wednesday",
    title: "Normal eating, more sleep",
    detail:
      "Do not start cutting anything. Keep protein steady, keep carbs normal, and get the sleep you will lose on Saturday night.",
  },
  {
    when: "Friday and Saturday",
    title: "Carb load, low fiber",
    detail:
      "Aim for 7–10 g of carbs per kg each day from familiar food. Back off salads, beans, and anything high fiber so race morning is calm. Salt your food.",
  },
  {
    when: "Saturday",
    title: "Lay everything out",
    detail:
      "Bib, shoes, socks, gels, and the exact breakfast you have practiced. Packet pickup runs 9 AM to 6 PM. Congress Avenue start, corral by 6:55 AM.",
  },
  {
    when: "Race morning, 3 hours out",
    title: "Practiced breakfast",
    detail:
      "Bagel with jam, or oatmeal with maple. 60–100 g of carbs. Sip 16 oz of water with a pinch of salt. Coffee only if it is your routine.",
  },
  {
    when: "20 minutes before the gun",
    title: "Last top-off",
    detail: "One gel with a few sips of water. Then stop drinking so you are not hunting a portable toilet in the corral.",
  },
  {
    when: "Miles 4, 7, 10",
    title: "Gel on schedule, not on feel",
    detail:
      "Take a gel roughly every 25–30 minutes with water from the aid station. There are 22 aid stations; you do not need to carry everything.",
  },
  {
    when: "Within an hour of finishing",
    title: "Protein and salt",
    detail:
      "Chocolate milk or a shake plus something salty. Then walk around the finish festival instead of sitting down immediately.",
  },
];

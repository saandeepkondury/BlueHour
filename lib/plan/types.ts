export type Phase = "base" | "build" | "specific" | "peak" | "taper" | "race";

export type WorkoutType =
  | "rest"
  | "walk_run"
  | "easy"
  | "quality"
  | "long"
  | "cross"
  | "shakeout"
  | "race";

export interface WorkoutSeed {
  date: string;
  week: number;
  weeksToRace: number;
  phase: Phase;
  type: WorkoutType;
  title: string;
  distanceMi: number;
  durationMin: number | null;
  purpose: string;
  tip: string | null;
}

export const PHASE_LABEL: Record<Phase, string> = {
  base: "I · Base",
  build: "II · Build",
  specific: "III · Specific",
  peak: "IV · Peak",
  taper: "Taper",
  race: "Race week",
};

export const PHASE_BLURB: Record<Phase, string> = {
  base: "Consistency and tissue. Easy running, strength, and abs — walk breaks early are part of the plan.",
  build: "Four run days. The long run grows, strides appear, and light tempo starts to teach pace.",
  specific: "This is how you get faster. One quality Tuesday, race-pace endings on long runs, strength held not built.",
  peak: "The biggest week of the block. Twelve miles on Saturday, then we start coming down.",
  taper: "Volume comes down, a little sharpness stays. Resist the urge to add miles.",
  race: "Nothing new. Sleep, carbs, and Congress Avenue.",
};

export const TYPE_LABEL: Record<WorkoutType, string> = {
  rest: "Rest",
  walk_run: "Walk / run",
  easy: "Easy run",
  quality: "Quality",
  long: "Long run",
  cross: "Cross-train",
  shakeout: "Shakeout",
  race: "Race",
};

export const RUN_TYPES: WorkoutType[] = ["walk_run", "easy", "quality", "long", "shakeout", "race"];

export function isRun(type: WorkoutType): boolean {
  return RUN_TYPES.includes(type);
}

/**
 * Phases are assigned backward from race day so a shorter runway trims Base
 * first, and a longer one simply extends it.
 *
 * 28-week shape: Base 8 → Build 8 → Specific 8 → Peak 1 → Taper 2 → Race 1.
 */
export function phaseFor(weeksToRace: number): Phase {
  if (weeksToRace <= 0) return "race";
  if (weeksToRace <= 2) return "taper";
  if (weeksToRace === 3) return "peak";
  if (weeksToRace <= 11) return "specific";
  if (weeksToRace <= 19) return "build";
  return "base";
}

export function isCutbackWeek(weeksToRace: number): boolean {
  return weeksToRace === 4 || weeksToRace === 8 || weeksToRace === 12 || weeksToRace === 16 || weeksToRace === 20 || weeksToRace === 24;
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function roman(n: number): string {
  if (n < ROMAN.length) return ROMAN[n];
  let value = n;
  const table: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [amount, numeral] of table) {
    while (value >= amount) {
      out += numeral;
      value -= amount;
    }
  }
  return out;
}

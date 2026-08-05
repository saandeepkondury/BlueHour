export type Phase = "base" | "build" | "peak" | "taper" | "race";

export type WorkoutType =
  | "rest"
  | "walk_run"
  | "easy"
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
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
  race: "Race week",
};

export const PHASE_BLURB: Record<Phase, string> = {
  base: "Teaching your body to run easy and often. Walk breaks are part of the plan, not a failure.",
  build: "Four days a week now. The long run starts to feel like the main event.",
  peak: "The biggest weeks of the block, with a cutback every third week so you absorb the work.",
  taper: "Volume comes down, legs come back. Resist the urge to add miles.",
  race: "Nothing new. Sleep, carbs, and Congress Avenue.",
};

export const TYPE_LABEL: Record<WorkoutType, string> = {
  rest: "Rest",
  walk_run: "Walk / run",
  easy: "Easy run",
  long: "Long run",
  cross: "Cross-train",
  shakeout: "Shakeout",
  race: "Race",
};

export const RUN_TYPES: WorkoutType[] = ["walk_run", "easy", "long", "shakeout", "race"];

export function isRun(type: WorkoutType): boolean {
  return RUN_TYPES.includes(type);
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

import { monthOf } from "@/lib/date";
import type { WorkoutType } from "@/lib/plan/types";

export interface BodyStats {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: string | null;
}

export interface DayTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterOz: number;
  sodiumMg: number | null;
  /** True when body stats are missing and defaults were assumed. */
  estimated: boolean;
  runMinutes: number;
  needsDuringFuel: boolean;
  headline: string;
}

const DEFAULTS = { weightKg: 75, heightCm: 175, age: 32, sex: "unspecified" };

/** Beginner pace assumption, used to turn miles into time on feet. */
const MIN_PER_MILE: Record<string, number> = {
  walk_run: 15,
  easy: 12,
  quality: 11,
  long: 12.5,
  shakeout: 12,
  race: 11.5,
};

const CARBS_PER_KG: Record<string, number> = {
  rest: 3.5,
  cross: 4,
  walk_run: 4.5,
  easy: 4.5,
  quality: 5.5,
  shakeout: 4.5,
  long: 6.5,
  race: 7,
};

export function isHeatMonth(date: string): boolean {
  const month = monthOf(date);
  return month >= 5 && month <= 10;
}

export function runMinutesFor(type: WorkoutType, distanceMi: number, durationMin: number | null): number {
  if (durationMin) return durationMin;
  const pace = MIN_PER_MILE[type];
  if (!pace || distanceMi <= 0) return 0;
  return Math.round(distanceMi * pace);
}

interface ResolvedStats {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: string;
}

function bmr(stats: ResolvedStats): number {
  const base = 10 * stats.weightKg + 6.25 * stats.heightCm - 5 * stats.age;
  if (stats.sex === "male") return base + 5;
  if (stats.sex === "female") return base - 161;
  return base - 78;
}

export interface TargetAdjust {
  /** Calories held back for the abs goal. Ignored on long-run and race days. */
  deficitKcal?: number;
  /** Protein floor in g/kg, raised while cutting so the loss is fat, not muscle. */
  proteinPerKg?: number;
}

export function computeTargets(
  stats: BodyStats,
  workout: { type: WorkoutType; distanceMi: number; durationMin: number | null },
  date: string,
  adjust: TargetAdjust = {},
): DayTargets {
  const estimated = stats.weightKg == null || stats.heightCm == null || stats.age == null;
  const resolved = {
    weightKg: stats.weightKg ?? DEFAULTS.weightKg,
    heightCm: stats.heightCm ?? DEFAULTS.heightCm,
    age: stats.age ?? DEFAULTS.age,
    sex: stats.sex ?? DEFAULTS.sex,
  };

  const kg = resolved.weightKg;
  const lb = kg * 2.20462;
  const runMinutes = runMinutesFor(workout.type, workout.distanceMi, workout.durationMin);
  const runKcal = Math.round(workout.distanceMi * lb * 0.63);

  const resting = bmr(resolved);
  const maintenance = Math.round(resting * 1.35);
  const isLongish = workout.type === "long" || workout.type === "race";
  const deficit = isLongish ? 0 : Math.max(0, adjust.deficitKcal ?? 0);
  // Never eat under resting metabolism, whatever the goal says.
  const floor = Math.round(resting * 1.15) + runKcal;
  const calories = Math.round(Math.max(floor, maintenance + runKcal - deficit) / 10) * 10;

  const protein = Math.round(kg * (adjust.proteinPerKg ?? (isLongish ? 1.8 : 1.6)));
  const fatFloor = Math.round(kg * 0.6);
  let carbs = Math.round(kg * (CARBS_PER_KG[workout.type] ?? 4));
  let fat = Math.round((calories - protein * 4 - carbs * 4) / 9);
  if (fat < fatFloor) {
    // Carbs give way before protein or essential fat does.
    fat = fatFloor;
    carbs = Math.max(Math.round(kg * 2), Math.round((calories - protein * 4 - fat * 9) / 4));
  }

  const heat = isHeatMonth(date);
  const runHours = runMinutes / 60;
  const waterOz = Math.round(lb * 0.5 + runHours * (heat ? 24 : 18) + (heat ? 12 : 0));

  const sodiumMg =
    runMinutes >= 60 || (heat && runMinutes >= 40)
      ? Math.round(runHours * (heat ? 600 : 400)) + 1500
      : null;

  const needsDuringFuel = runMinutes >= 75;

  return {
    calories,
    protein,
    carbs,
    fat,
    waterOz,
    sodiumMg,
    estimated,
    runMinutes,
    needsDuringFuel,
    headline: headlineFor(workout.type, needsDuringFuel, heat),
  };
}

function headlineFor(type: WorkoutType, needsDuringFuel: boolean, heat: boolean): string {
  switch (type) {
    case "race":
      return "Race day. Carbs at breakfast, gels on schedule, nothing you have not practiced.";
    case "long":
      return needsDuringFuel
        ? "Long-run day. Eat before, fuel on the move, and get protein in within an hour of finishing."
        : "Long-run day. Something small before, real food after.";
    case "rest":
      return "Rest day. Slightly fewer carbs, same protein — recovery is built from protein.";
    case "cross":
      return "Cross-train day. Fuel it like an easy run.";
    case "quality":
      return "Quality day. A few more carbs than an easy day so the workout has something to burn.";
    default:
      return heat
        ? "Easy day. Front-load water in this Austin heat and keep protein steady."
        : "Easy day. Steady protein, moderate carbs.";
  }
}

export interface FuelStage {
  stage: "pre" | "during" | "post";
  label: string;
  timing: string;
  detail: string;
}

/** Pre / during / post prescription for the days that actually need it. */
export function fuelPlan(
  targets: DayTargets,
  workout: { type: WorkoutType; distanceMi: number },
  weightKg: number | null,
): FuelStage[] {
  if (workout.type !== "long" && workout.type !== "race") return [];
  const kg = weightKg ?? DEFAULTS.weightKg;
  const hours = targets.runMinutes / 60;
  const preCarbs = Math.round(kg * (targets.runMinutes >= 75 ? 1 : 0.6));
  const duringCarbs = Math.round(Math.max(0, hours - 1) * 45);
  const gels = Math.max(1, Math.round(duringCarbs / 22));

  const stages: FuelStage[] = [
    {
      stage: "pre",
      label: `About ${preCarbs} g carbs`,
      timing: "60–90 min before",
      detail:
        "Toast with honey and a banana, or oatmeal. Low fiber, low fat, nothing experimental.",
    },
  ];

  if (targets.needsDuringFuel) {
    stages.push({
      stage: "during",
      label: `${duringCarbs} g carbs on the move (~${gels} gel${gels === 1 ? "" : "s"})`,
      timing: "Start at 45 min, then every 25–30 min",
      detail:
        "Take each gel with a few sips of water. Practice the exact brand you plan to use on Congress Avenue.",
    });
  }

  stages.push({
    stage: "post",
    label: `${Math.round(kg * 0.35)} g protein + carbs`,
    timing: "Within 60 min of finishing",
    detail: "Chocolate milk, eggs and toast, or a shake plus fruit. Salt if you finished crusty.",
  });

  return stages;
}

import { formatMiles } from "@/lib/format";
import { SLEEP_TARGET_HOURS } from "@/lib/health/read";
import { isRun, type WorkoutType } from "@/lib/plan/types";
import { getDayBundle } from "@/lib/store";

/** 10:00 PM Austin. After the last water ping, before bed. */
export const EVENING_HOUR = 22;

export interface EveningPreview {
  title: string;
  body: string;
}

/**
 * What tomorrow asks for: run or not (and how far), water, and sleep.
 * Fired the evening before, from the same local-notification schedule as the morning brief.
 */
export async function buildEveningPreview(date: string): Promise<EveningPreview | null> {
  const bundle = await getDayBundle(date);
  if (!bundle) return null;

  const { workout, targets } = bundle;
  const session = sessionLine(workout.type as WorkoutType, workout);

  return {
    title: "Tomorrow",
    body: `${session}. Water ${targets.waterOz} oz. Sleep ${SLEEP_TARGET_HOURS} hr.`,
  };
}

function sessionLine(
  type: WorkoutType,
  workout: { title: string; distanceMi: number; durationMin: number | null },
): string {
  if (type === "rest") return "No run";
  if (isRun(type) && workout.distanceMi > 0) {
    return `${workout.title}, ${formatMiles(workout.distanceMi)} mi`;
  }
  if (workout.durationMin && workout.durationMin > 0) {
    return `${workout.title}, ${workout.durationMin} min`;
  }
  return workout.title;
}

import { exerciseById } from "@/lib/strength/exercises";

/** Direct WorkoutX id for a BlueHour exercise. No fuzzy name search. */
export function wxIdFor(exerciseId: string): string | undefined {
  return exerciseById(exerciseId)?.wxId;
}

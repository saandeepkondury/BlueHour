import type { IconName } from "@/components/Icon";

export type HabitId = "sleep" | "meal_prep" | "plan";

export interface Habit {
  id: HabitId;
  label: string;
  hint: string;
  icon: IconName;
}

export const HABITS: readonly Habit[] = [
  {
    id: "sleep",
    label: "Good sleep",
    hint: "Rested enough to train",
    icon: "moon",
  },
  {
    id: "meal_prep",
    label: "Meal prepped",
    hint: "Ate the food you packed",
    icon: "fuel",
  },
  {
    id: "plan",
    label: "Did the plan",
    hint: "Ran, lifted, or rested as written",
    icon: "run",
  },
];

export function isHabitId(value: string): value is HabitId {
  return HABITS.some((habit) => habit.id === value);
}

export function starKey(date: string, habitId: HabitId): string {
  return `${date}:${habitId}`;
}

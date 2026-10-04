import { formatMiles } from "@/lib/format";
import { cupsForTarget, loggedCups } from "@/lib/notify/water";
import { computeTargets } from "@/lib/nutrition/targets";
import { isRun, TYPE_LABEL, type WorkoutType } from "@/lib/plan/types";
import { getDayBundle, getDayLog, getDayLogs, getProfile, getWorkouts, type DayBundle } from "@/lib/store";
import { todayHabits } from "./store";

export type WidgetPlan = {
  title: string;
  detail: string;
  done: boolean;
};

export type WidgetWater = {
  oz: number;
  target: number | null;
  cups: number;
  cupsTarget: number | null;
};

export type WidgetToday = Awaited<ReturnType<typeof todayHabits>> & {
  plan: WidgetPlan;
  mealsLogged: number;
  water: WidgetWater;
};

/** Seeded titles carry a dashed block suffix; the widget only has room for the name. */
function shortTitle(title: string): string {
  return title.split(/\s[\u2014\u2013-]\s/)[0].trim();
}

function planLine(bundle: DayBundle | null): WidgetPlan {
  if (!bundle) return { title: "No plan yet", detail: "Set one up on Plan", done: false };

  const { workout, strength: lift } = bundle;
  const type = workout.type as WorkoutType;
  const run = isRun(type)
    ? `${TYPE_LABEL[type]} · ${formatMiles(workout.distanceMi)} mi`
    : type === "cross"
      ? TYPE_LABEL.cross
      : null;
  const liftLine = lift ? `${shortTitle(lift.title)} · ${lift.minutes} min` : null;
  const phase = workout.phase.charAt(0).toUpperCase() + workout.phase.slice(1);

  if (run) {
    return {
      title: run,
      detail: liftLine ? `Plus ${liftLine}` : `Week ${workout.week} · ${phase}`,
      done: workout.status === "done",
    };
  }
  if (lift && liftLine) {
    return { title: liftLine, detail: "No run today", done: lift.status === "done" };
  }
  return { title: "Rest day", detail: "Recover and refuel", done: false };
}

/** Same payload the home screen widget draws. */
export async function widgetToday(): Promise<WidgetToday> {
  const habits = await todayHabits();
  const bundle = await getDayBundle(habits.date);
  const oz = bundle ? bundle.dayLog.waterOz : (await getDayLog(habits.date)).waterOz;
  const target = bundle?.targets.waterOz ?? null;

  return {
    ...habits,
    plan: planLine(bundle),
    mealsLogged: bundle?.meals.length ?? 0,
    water: {
      oz,
      target,
      cups: loggedCups(oz),
      cupsTarget: target === null ? null : cupsForTarget(target),
    },
  };
}

/** One day's cups for the week sheet, using that day's water target. */
export async function weekWaterMap(days: string[]): Promise<Record<string, WidgetWater>> {
  if (days.length === 0) return {};
  const from = days[0];
  const to = days[days.length - 1];
  const [logs, workouts, profile] = await Promise.all([
    getDayLogs(from, to),
    getWorkouts(from, to),
    getProfile(),
  ]);
  const ozByDate = new Map(logs.map((row) => [row.date, row.waterOz]));
  const workoutByDate = new Map(workouts.map((row) => [row.date, row]));
  const body = {
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
    sex: profile.sex,
  };

  return Object.fromEntries(
    days.map((date) => {
      const workout = workoutByDate.get(date);
      const target = workout
        ? computeTargets(
            body,
            {
              type: workout.type as WorkoutType,
              distanceMi: workout.distanceMi,
              durationMin: workout.durationMin,
            },
            date,
          ).waterOz
        : 80;
      const oz = ozByDate.get(date) ?? 0;
      return [
        date,
        {
          oz,
          target,
          cups: loggedCups(oz),
          cupsTarget: cupsForTarget(target),
        } satisfies WidgetWater,
      ];
    }),
  );
}

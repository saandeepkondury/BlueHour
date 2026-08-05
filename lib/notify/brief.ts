import { daysBetween } from "@/lib/date";
import { formatMiles } from "@/lib/format";
import { isRun, type WorkoutType } from "@/lib/plan/types";
import { pendingSuggestions } from "@/lib/coach/store";
import { getDayBundle } from "@/lib/store";
import { parseBlocks } from "@/lib/strength/exercises";

/**
 * The morning brief. Compact copy for the in-app preview and the push
 * notification that lands on the phone before coffee.
 */

export interface Brief {
  date: string;
  subject: string;
  text: string;
  push: { title: string; body: string; url: string };
}

export async function buildBrief(date: string, appUrl: string): Promise<Brief | null> {
  const bundle = await getDayBundle(date);
  if (!bundle) return null;

  const { workout, targets, profile, recovery, strength } = bundle;
  const type = workout.type as WorkoutType;
  const toRace = Math.max(0, daysBetween(date, profile.raceDate));
  const pending = await pendingSuggestions();

  const lines: string[] = [];

  const heading =
    type === "race" ? "Race day." : type === "rest" ? "Rest day." : `${workout.title}.`;

  lines.push(heading);
  if (workout.purpose) lines.push(workout.purpose);

  if (recovery.score !== null) {
    lines.push(
      "",
      `Readiness ${recovery.score} — ${recovery.label}.${
        recovery.advisory ? ` ${recovery.advisory}` : ""
      }`,
    );
  }

  if (workout.tip) {
    lines.push("", workout.tip);
  }

  if (strength && strength.status === "planned") {
    const blocks = parseBlocks(strength.blocks);
    const names = blocks
      .flatMap((block) => block.exercises.map((exercise) => exercise.name))
      .slice(0, 4)
      .join(", ");
    lines.push("", `${strength.title} — ${strength.minutes} min. ${names}.`);
  }

  lines.push(
    "",
    `Fuel: ${targets.calories} kcal · ${targets.protein}g protein · ${targets.carbs}g carbs · ${targets.waterOz} oz water.`,
  );
  if (profile.absGoal === 1) lines.push(bundle.fuelNote);

  if (bundle.fuel.length > 0) {
    lines.push("", ...bundle.fuel.map((stage) => `${stage.timing}: ${stage.label}`));
  }

  const meals = bundle.meals.map((meal) => `${meal.name} (${meal.calories} kcal)`);
  if (meals.length > 0) {
    lines.push("", "Meals: " + meals.join("; "));
  }

  if (pending.length > 0) {
    lines.push(
      "",
      `Coach: ${pending[0].title}${pending.length > 1 ? ` (and ${pending.length - 1} more)` : ""}`,
      `${appUrl}/coach`,
    );
  }

  lines.push("", `${toRace} days to ${profile.raceName}.`);

  const subject =
    type === "race"
      ? `Race day — ${profile.raceName}`
      : type === "rest"
        ? `Rest day · ${toRace} days out`
        : `${workout.title} · ${toRace} days out`;

  const pushBody = isRun(type)
    ? `${formatMiles(workout.distanceMi)} mi · ${targets.calories} kcal · ${targets.protein}g protein`
    : strength && strength.status === "planned"
      ? `${strength.title} · ${strength.minutes} min`
      : `${targets.calories} kcal · ${targets.protein}g protein`;

  return {
    date,
    subject,
    text: lines.join("\n"),
    push: {
      title: type === "rest" && strength ? strength.title : workout.title,
      body: recovery.score !== null ? `Readiness ${recovery.score} · ${pushBody}` : pushBody,
      url: appUrl,
    },
  };
}

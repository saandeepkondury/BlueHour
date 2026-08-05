import { daysBetween, formatLong } from "@/lib/date";
import { formatMiles } from "@/lib/format";
import { PHASE_LABEL, isRun, type Phase, type WorkoutType } from "@/lib/plan/types";
import { pendingSuggestions } from "@/lib/coach/store";
import { getDayBundle } from "@/lib/store";
import { parseBlocks } from "@/lib/strength/exercises";

/**
 * The morning brief. One screen of text that answers the only questions that
 * matter before coffee: what am I doing today, how did I sleep, what do I eat,
 * and is there anything I should decide.
 */

export interface Brief {
  date: string;
  subject: string;
  text: string;
  html: string;
  push: { title: string; body: string; url: string };
}

const escape = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function buildBrief(date: string, appUrl: string): Promise<Brief | null> {
  const bundle = await getDayBundle(date);
  if (!bundle) return null;

  const { workout, targets, profile, recovery, strength } = bundle;
  const type = workout.type as WorkoutType;
  const toRace = Math.max(0, daysBetween(date, profile.raceDate));
  const pending = await pendingSuggestions();

  const lines: string[] = [];
  const sections: string[] = [];

  const heading =
    type === "race"
      ? "Race day."
      : type === "rest"
        ? "Rest day."
        : `${workout.title}.`;

  lines.push(heading);
  if (workout.purpose) lines.push(workout.purpose);
  sections.push(`<h2 style="font:600 20px Georgia,serif;margin:0 0 6px">${escape(heading)}</h2>
    <p style="margin:0 0 14px;color:#565b4a">${escape(workout.purpose)}</p>`);

  if (recovery.score !== null) {
    const readiness = `Readiness ${recovery.score} — ${recovery.label}.${
      recovery.advisory ? ` ${recovery.advisory}` : ""
    }`;
    lines.push("", readiness);
    sections.push(`<p style="margin:0 0 14px"><strong>${escape(
      `Readiness ${recovery.score} · ${recovery.label}`,
    )}</strong>${recovery.advisory ? `<br><span style="color:#565b4a">${escape(recovery.advisory)}</span>` : ""}</p>`);
  }

  if (workout.tip) {
    lines.push("", workout.tip);
    sections.push(`<p style="margin:0 0 14px;color:#565b4a">${escape(workout.tip)}</p>`);
  }

  if (strength && strength.status === "planned") {
    const blocks = parseBlocks(strength.blocks);
    const names = blocks
      .flatMap((block) => block.exercises.map((exercise) => exercise.name))
      .slice(0, 4)
      .join(", ");
    lines.push("", `${strength.title} — ${strength.minutes} min. ${names}.`);
    sections.push(`<p style="margin:0 0 14px"><strong>${escape(strength.title)}</strong> · ${
      strength.minutes
    } min<br><span style="color:#565b4a">${escape(names)}</span></p>`);
  }

  const fuel = `Fuel: ${targets.calories} kcal · ${targets.protein}g protein · ${targets.carbs}g carbs · ${targets.waterOz} oz water.`;
  lines.push("", fuel);
  if (profile.absGoal === 1) lines.push(bundle.fuelNote);
  sections.push(`<p style="margin:0 0 14px"><strong>Fuel</strong><br><span style="color:#565b4a">${escape(
    `${targets.calories} kcal · ${targets.protein}g protein · ${targets.carbs}g carbs · ${targets.waterOz} oz water`,
  )}${profile.absGoal === 1 ? `<br>${escape(bundle.fuelNote)}` : ""}</span></p>`);

  if (bundle.fuel.length > 0) {
    const cues = bundle.fuel.map((stage) => `${stage.timing}: ${stage.label}`);
    lines.push("", ...cues);
    sections.push(`<p style="margin:0 0 14px"><strong>Long-run fuel</strong><br><span style="color:#565b4a">${cues
      .map(escape)
      .join("<br>")}</span></p>`);
  }

  const meals = bundle.meals.map((meal) => `${meal.name} (${meal.calories} kcal)`);
  if (meals.length > 0) {
    lines.push("", "Meals: " + meals.join("; "));
    sections.push(`<p style="margin:0 0 14px"><strong>Meals</strong><br><span style="color:#565b4a">${meals
      .map(escape)
      .join("<br>")}</span></p>`);
  }

  if (pending.length > 0) {
    const note = `Coach: ${pending[0].title}${
      pending.length > 1 ? ` (and ${pending.length - 1} more)` : ""
    }`;
    lines.push("", note, `${appUrl}/coach`);
    sections.push(`<p style="margin:0 0 14px"><strong>From the coach</strong><br><span style="color:#565b4a">${escape(
      pending[0].title,
    )}</span><br><a href="${appUrl}/coach" style="color:#3f7196">Review it</a></p>`);
  }

  lines.push("", `${toRace} days to ${profile.raceName}.`, appUrl);

  const subject =
    type === "race"
      ? `Race day — ${profile.raceName}`
      : type === "rest"
        ? `Rest day · ${toRace} days out`
        : `${workout.title} · ${toRace} days out`;

  const html = `<div style="max-width:520px;margin:0 auto;padding:28px 22px;background:#eae4d8;font:16px/1.55 Georgia,serif;color:#2b2f26">
  <p style="margin:0 0 4px;font:600 11px Georgia,serif;letter-spacing:.22em;text-transform:uppercase;color:#7d8270">${escape(
    formatLong(date),
  )} · ${escape(PHASE_LABEL[workout.phase as Phase])} · week ${workout.week}</p>
  <div style="height:1px;background:rgba(43,47,38,.16);margin:14px 0 18px"></div>
  ${sections.join("\n")}
  <div style="height:1px;background:rgba(43,47,38,.16);margin:18px 0"></div>
  <p style="margin:0 0 10px;color:#565b4a">${toRace} days to ${escape(profile.raceName)}.</p>
  <a href="${appUrl}" style="display:inline-block;padding:11px 16px;background:#2b2f26;color:#f5f1e8;text-decoration:none;font:600 11px Georgia,serif;letter-spacing:.14em;text-transform:uppercase">Open Blue Hour</a>
</div>`;

  const pushBody = isRun(type)
    ? `${formatMiles(workout.distanceMi)} mi · ${targets.calories} kcal · ${targets.protein}g protein`
    : strength && strength.status === "planned"
      ? `${strength.title} · ${strength.minutes} min`
      : `${targets.calories} kcal · ${targets.protein}g protein`;

  return {
    date,
    subject,
    text: lines.join("\n"),
    html,
    push: {
      title: type === "rest" && strength ? strength.title : workout.title,
      body: recovery.score !== null ? `Readiness ${recovery.score} · ${pushBody}` : pushBody,
      url: appUrl,
    },
  };
}

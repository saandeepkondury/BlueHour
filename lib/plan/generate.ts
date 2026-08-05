import { addDays, dayOfWeek, daysBetween, monthOf, startOfWeek } from "@/lib/date";
import type { Phase, WorkoutSeed, WorkoutType } from "./types";

export const RACE_DISTANCE_MI = 13.1;

/**
 * Long-run mileage keyed by weeks-to-race. Built backward from race day so a
 * shorter or longer runway simply trims the front of the block.
 * Cutback weeks (r = 6, 11, 14) intentionally dip.
 */
const LONG_BY_WEEKS_TO_RACE: Record<number, number> = {
  0: RACE_DISTANCE_MI,
  1: 6,
  2: 8,
  3: 12,
  4: 11,
  5: 10,
  6: 7,
  7: 9,
  8: 8,
  9: 8,
  10: 7,
  11: 5,
  12: 7,
  13: 6,
  14: 4.5,
  15: 6,
  16: 5,
};

const BASE_LONG_CEILING = 4;
const BASE_LONG_FLOOR = 1.5;

function phaseFor(weeksToRace: number): Phase {
  if (weeksToRace === 0) return "race";
  if (weeksToRace <= 2) return "taper";
  if (weeksToRace <= 8) return "peak";
  if (weeksToRace <= 16) return "build";
  return "base";
}

function longRunFor(weeksToRace: number): number {
  const table = LONG_BY_WEEKS_TO_RACE[weeksToRace];
  if (table !== undefined) return table;
  // Base phase: walk further back in time, shorter the long run gets.
  const stepsIntoBase = weeksToRace - 17;
  return clamp(round25(BASE_LONG_CEILING - stepsIntoBase * 0.25), BASE_LONG_FLOOR, BASE_LONG_CEILING);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round25(value: number): number {
  return Math.round(value * 4) / 4;
}

function isCutback(weeksToRace: number): boolean {
  return weeksToRace === 6 || weeksToRace === 11 || weeksToRace === 14;
}

/** Walk/run interval prescription eases toward continuous running. */
function walkRunInterval(weeksToRace: number): { run: number; walk: number; totalMin: number } {
  const stepsIntoBase = Math.max(0, weeksToRace - 17);
  if (stepsIntoBase >= 8) return { run: 1, walk: 2, totalMin: 22 };
  if (stepsIntoBase >= 6) return { run: 2, walk: 2, totalMin: 24 };
  if (stepsIntoBase >= 4) return { run: 3, walk: 2, totalMin: 26 };
  if (stepsIntoBase >= 2) return { run: 4, walk: 1, totalMin: 28 };
  return { run: 6, walk: 1, totalMin: 30 };
}

function easyDistances(phase: Phase, long: number, weeksToRace: number): number[] {
  switch (phase) {
    case "base":
      return [clamp(round25(long * 0.6), 1.5, 3), clamp(round25(long * 0.55), 1.5, 3)];
    case "build":
      return [
        clamp(round25(long * 0.5), 2, 4),
        clamp(round25(long * 0.45), 2, 4),
        clamp(round25(long * 0.4), 2, 3.5),
      ];
    case "peak":
      return [
        clamp(round25(long * 0.42), 2.5, 5),
        clamp(round25(long * 0.38), 2.5, 4.5),
        clamp(round25(long * 0.34), 2, 4),
      ];
    case "taper":
      return weeksToRace === 2 ? [4, 3, 3] : [3, 3, 2];
    case "race":
      return [];
  }
}

/** Minutes of easy running, used for walk/run days where distance is a rough estimate. */
function walkRunMinutes(weeksToRace: number): number {
  return walkRunInterval(weeksToRace).totalMin;
}

function austinTip(date: string, type: WorkoutType, phase: Phase, long: number): string | null {
  const month = monthOf(date);

  if (type === "race") {
    return "Waves start at 7:00 AM on Congress. Be in the corral by 6:55. Nothing new today — same breakfast, same shoes, same gels you practiced.";
  }
  if (phase === "race" && type === "shakeout") {
    return "Easy and short. You are not getting fitter this week, you are staying loose.";
  }
  if (type === "long") {
    if (month === 8 || month === 9) {
      return "Austin in the heat: start before 7 AM, take the shaded stretch of the Ann and Roy Butler trail, and add 30–60 sec/mile. Effort matters, pace does not.";
    }
    if (month === 10 || month === 11) {
      return "Cooler mornings finally. Use them to practice race-day breakfast and gel timing.";
    }
    if (month === 12 || month === 1) {
      return "Cold start, warm finish. Overdress by one layer you can tie around your waist.";
    }
    if (long >= 8) {
      return "Run some rolling hills — the Austin course climbs through the first half before the drop onto Congress.";
    }
    return "Keep it conversational. If you cannot talk, you are running the long run too fast.";
  }
  if (type === "walk_run" && (month === 8 || month === 9)) {
    return "Before sunrise or after dusk. Walk breaks are the point, not a concession.";
  }
  if (type === "rest") return null;
  return null;
}

function purposeFor(type: WorkoutType, phase: Phase, long: number, cutback: boolean): string {
  switch (type) {
    case "race":
      return "Thirteen point one miles from downtown to the Capitol. Everything in this plan pointed here.";
    case "long":
      if (cutback) return "Cutback long run. Backing off this week is what lets next week's jump stick.";
      if (long >= 10) return "The confidence run. Time on feet teaches your legs the second half of the race.";
      return "Builds the aerobic base that carries the back half of a half marathon.";
    case "easy":
      return "Easy miles. Aerobic volume with almost no cost to recovery.";
    case "walk_run":
      return "Walk/run intervals build durability while keeping impact low — this is how beginners avoid shin splints.";
    case "shakeout":
      return "Short and loose to keep the legs awake without spending anything.";
    case "cross":
      return "Optional cross-train. Aerobic work without the pounding.";
    case "rest":
      return "Rest is training. This is when the adaptations actually happen.";
  }
}

function titleFor(type: WorkoutType, distance: number, weeksToRace: number): string {
  switch (type) {
    case "race":
      return "Austin Half Marathon — 13.1 mi";
    case "long":
      return `Long run — ${formatMi(distance)} mi`;
    case "easy":
      return `Easy run — ${formatMi(distance)} mi`;
    case "walk_run": {
      const { run, walk, totalMin } = walkRunInterval(weeksToRace);
      return `Walk/run — ${totalMin} min (${run} min run / ${walk} min walk)`;
    }
    case "shakeout":
      return `Shakeout — ${formatMi(distance)} mi`;
    case "cross":
      return "Cross-train — 30 min";
    case "rest":
      return "Rest";
  }
}

export function formatMi(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
}

interface GenerateInput {
  startDate: string;
  raceDate: string;
  /** 6 = Saturday, 0 = Sunday */
  longRunDay: number;
}

/**
 * Builds the full day-by-day block. Weeks run Monday–Sunday and phases are
 * assigned backward from race day, so the plan adapts to whatever runway exists.
 */
export function generatePlan({ startDate, raceDate, longRunDay }: GenerateInput): WorkoutSeed[] {
  const planStart = startOfWeek(startDate);
  const raceWeekStart = startOfWeek(raceDate);
  const totalWeeks = Math.max(1, Math.round(daysBetween(planStart, raceWeekStart) / 7) + 1);

  const seeds: WorkoutSeed[] = [];

  for (let week = 1; week <= totalWeeks; week += 1) {
    const weekStart = addDays(planStart, (week - 1) * 7);
    const weeksToRace = totalWeeks - week;
    const phase = phaseFor(weeksToRace);
    const long = longRunFor(weeksToRace);
    const cutback = isCutback(weeksToRace);
    const easies = easyDistances(phase, long, weeksToRace);

    // Long run anchors the week; easy days fill Tue/Wed/Thu around it.
    const easyDays = phase === "base" ? [2, 4] : [2, 3, 4];
    const assignments = new Map<number, { type: WorkoutType; distance: number }>();

    if (phase === "race") {
      assignments.set(2, { type: "easy", distance: 2 });
      assignments.set(3, { type: "shakeout", distance: 2 });
      assignments.set(5, { type: "shakeout", distance: 1.5 });
    } else {
      const longType: WorkoutType = "long";
      assignments.set(longRunDay, { type: longType, distance: long });
      easies.forEach((distance, index) => {
        const dow = easyDays[index];
        if (dow === undefined || dow === longRunDay) return;
        const type: WorkoutType = phase === "base" && weeksToRace >= 21 ? "walk_run" : "easy";
        assignments.set(dow, { type, distance });
      });
    }

    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(weekStart, offset);
      if (date < startDate) continue;
      if (date > raceDate) continue;

      const dow = dayOfWeek(date);
      const isRaceDay = date === raceDate;
      const assigned = assignments.get(dow);

      const type: WorkoutType = isRaceDay ? "race" : (assigned?.type ?? "rest");
      const distance = isRaceDay ? RACE_DISTANCE_MI : (assigned?.distance ?? 0);
      const durationMin =
        type === "walk_run"
          ? walkRunMinutes(weeksToRace)
          : type === "cross"
            ? 30
            : null;

      seeds.push({
        date,
        week,
        weeksToRace,
        phase,
        type,
        title: titleFor(type, distance, weeksToRace),
        distanceMi: type === "walk_run" ? estimateWalkRunMiles(weeksToRace) : distance,
        durationMin,
        purpose: purposeFor(type, phase, long, cutback),
        tip: austinTip(date, type, phase, long),
      });
    }
  }

  return seeds;
}

/** Walk/run days are prescribed by time; miles are an estimate at ~15 min/mi blended pace. */
function estimateWalkRunMiles(weeksToRace: number): number {
  return round25(walkRunMinutes(weeksToRace) / 15);
}

export function plannedMiles(seeds: Pick<WorkoutSeed, "distanceMi">[]): number {
  return round25(seeds.reduce((total, seed) => total + seed.distanceMi, 0));
}

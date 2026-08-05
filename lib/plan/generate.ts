import { addDays, dayOfWeek, daysBetween, monthOf, startOfWeek } from "@/lib/date";
import { isCutbackWeek, phaseFor, type Phase, type WorkoutSeed, type WorkoutType } from "./types";

export const RACE_DISTANCE_MI = 13.1;

/**
 * Long-run mileage keyed by weeks-to-race. Built backward from race day so a
 * shorter or longer runway simply trims the front of the block.
 * Cutback weeks (4, 8, 12, 16, 20, 24) intentionally dip.
 */
const LONG_BY_WEEKS_TO_RACE: Record<number, number> = {
  0: RACE_DISTANCE_MI,
  1: 5.5,
  2: 8,
  3: 12,
  4: 8,
  5: 11,
  6: 10.5,
  7: 10,
  8: 7,
  9: 9.5,
  10: 9,
  11: 8.5,
  12: 6,
  13: 7.5,
  14: 7,
  15: 6.5,
  16: 5,
  17: 6.5,
  18: 6,
  19: 5.5,
  20: 4,
  21: 4.5,
  22: 4,
  23: 3.5,
  24: 2.5,
  25: 3,
  26: 2.5,
  27: 2,
};

const BASE_LONG_CEILING = 2;
const BASE_LONG_FLOOR = 1.5;

function longRunFor(weeksToRace: number): number {
  const table = LONG_BY_WEEKS_TO_RACE[weeksToRace];
  if (table !== undefined) return table;
  const stepsPast = weeksToRace - 27;
  return clamp(round25(BASE_LONG_CEILING - stepsPast * 0.25), BASE_LONG_FLOOR, BASE_LONG_CEILING);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round25(value: number): number {
  return Math.round(value * 4) / 4;
}

/** Walk/run only in the first ~3 weeks of a full 28-week runway. */
function walkRunInterval(weeksToRace: number): { run: number; walk: number; totalMin: number } {
  if (weeksToRace >= 27) return { run: 3, walk: 1, totalMin: 22 };
  if (weeksToRace >= 26) return { run: 4, walk: 1, totalMin: 26 };
  return { run: 5, walk: 1, totalMin: 30 };
}

function usesWalkRun(weeksToRace: number): boolean {
  return weeksToRace >= 25;
}

interface DayAssign {
  type: WorkoutType;
  distance: number;
  durationMin: number | null;
  title?: string;
  purpose?: string;
}

interface QualitySpec {
  title: string;
  distance: number;
  durationMin: number;
  purpose: string;
  tip: string;
}

function qualityFor(weeksToRace: number, phase: Phase, cutback: boolean): QualitySpec | null {
  if (phase === "base") return null;
  if (cutback) return null;

  if (phase === "build") {
    if (weeksToRace >= 16) return null;
    if (weeksToRace >= 14) {
      return {
        title: "Tempo — 2 × 5 min",
        distance: 4,
        durationMin: 40,
        purpose: "Warm up 10 min easy, 2 × 5 min comfortably hard with 2 min jog, then cool down. Short phrases, not gasping.",
        tip: "Tempo is 6–7/10. Thursday and Saturday must stay easy or this session did not work.",
      };
    }
    return {
      title: "Tempo — 3 × 5 min",
      distance: 4.5,
      durationMin: 45,
      purpose: "Warm up 10 min easy, 3 × 5 min comfortably hard with 2 min jog, cool down 8 min.",
      tip: "If you cannot speak a short phrase, slow down. This is not a time trial.",
    };
  }

  if (phase === "specific") {
    // Alternate tempo / intervals across the 8-week block.
    const specs: Record<number, QualitySpec> = {
      11: {
        title: "Tempo — 15 min",
        distance: 4.5,
        durationMin: 42,
        purpose: "Warm up 10 min, 15 min at half-marathon effort, 8 min easy. This block is how you get faster.",
        tip: "Half-marathon effort: you could hold this for 13.1 if you had to. Honest, not heroic.",
      },
      10: {
        title: "Tempo — 20 min",
        distance: 5,
        durationMin: 48,
        purpose: "Warm up 10 min, 20 min comfortably hard, 8 min easy.",
        tip: "Same loop or a flat path so pace stays honest.",
      },
      9: {
        title: "Intervals — 4 × 400m",
        distance: 4.5,
        durationMin: 42,
        purpose: "Warm up 10 min + 4 strides, then 4 × 400m at 5K effort with 200m jog recoveries. Cool down 8 min.",
        tip: "Even splits. If rep 4 is a death march, reps 1–2 were too fast.",
      },
      7: {
        title: "Race pace — 20 min",
        distance: 5,
        durationMin: 48,
        purpose: "Warm up 10 min, 20 min at goal half-marathon pace, 8 min easy. Optional 10K tune-up this weekend instead of the long run.",
        tip: "This is the pace you want on Congress Avenue. Practice breakfast before it.",
      },
      6: {
        title: "Intervals — 6 × 400m",
        distance: 5,
        durationMin: 48,
        purpose: "Warm up 10 min + strides, 6 × 400m at 5K–10K effort, 200m jog. Cool down 8 min.",
        tip: "Track or a measured path. Jog the recoveries — do not stand.",
      },
      5: {
        title: "Tempo — 25 min",
        distance: 5.5,
        durationMin: 52,
        purpose: "Warm up 10 min, 25 min at comfortably hard / half effort, 8 min easy.",
        tip: "Longest continuous quality of the block. Settle in; do not surge.",
      },
    };
    return specs[weeksToRace] ?? null;
  }

  if (phase === "peak") {
    return {
      title: "Race pace — 12 min",
      distance: 4,
      durationMin: 40,
      purpose: "Warm up 10 min, 12 min at goal half pace, 8 min easy. Peak week — the long run on Saturday is the main event.",
      tip: "Keep it controlled. Fitness is already in the bank.",
    };
  }

  if (phase === "taper" && weeksToRace === 2) {
    return {
      title: "Race pace — 10 min",
      distance: 3.5,
      durationMin: 35,
      purpose: "Warm up 10 min, 10 min at goal half pace, 8 min easy. Volume is down; a little sharpness stays.",
      tip: "You will feel antsy or sluggish. Both are normal in a taper.",
    };
  }

  if (phase === "taper" && weeksToRace === 1) {
    return {
      title: "Strides — 4 × 1 min",
      distance: 3,
      durationMin: 30,
      purpose: "Easy 15 min, then 4 × 1 min brisk with full recoveries, easy home. Stay loose for Sunday.",
      tip: "Quick but relaxed. Not a sprint, not a workout.",
    };
  }

  return null;
}

function tueEasyDistance(phase: Phase, long: number): number {
  switch (phase) {
    case "base":
      return clamp(round25(long * 0.85), 1.5, 3);
    case "build":
      return clamp(round25(long * 0.55), 2.5, 4);
    case "specific":
      return 4;
    case "peak":
      return 3;
    case "taper":
      return 3;
    case "race":
      return 3;
  }
}

function thuDistance(phase: Phase, long: number, weeksToRace: number): number {
  if (phase === "race") return 0;
  if (phase === "taper") return weeksToRace === 2 ? 3 : 2;
  if (phase === "peak") return 3;
  if (phase === "specific") return 4;
  if (phase === "build") return clamp(round25(long * 0.5), 2.5, 4);
  return clamp(round25(long * 0.75), 1.5, 2.75);
}

function sunDistance(phase: Phase): number | null {
  if (phase === "build") return 2.5;
  if (phase === "specific") return 3;
  if (phase === "peak") return 2;
  return null;
}

function austinTip(date: string, type: WorkoutType, phase: Phase, long: number, weeksToRace: number): string | null {
  const month = monthOf(date);

  if (type === "race") {
    return "Waves start at 7:00 AM on Congress. Be in the corral by 6:55. Nothing new today — same breakfast, same shoes, same gels you practiced.";
  }
  if (phase === "race" && type === "shakeout") {
    return "Easy and short. You are not getting fitter this week, you are staying loose.";
  }
  if (type === "quality") {
    return "Easy days exist so this one can be honest. If you cannot talk in short phrases at tempo, you went out too hot.";
  }
  if (type === "long") {
    if (month === 8 || month === 9) {
      return "Austin in the heat: start before 7 AM, take the shaded stretch of the Ann and Roy Butler trail, and add 30–60 sec/mile. Effort matters, pace does not.";
    }
    if (weeksToRace >= 5 && weeksToRace <= 7) {
      return "Last 2–3 miles at goal half-marathon pace. Race rehearsal — breakfast, gel, and the pace you want on Congress.";
    }
    if (weeksToRace === 12) {
      return "Cutback week. Optional 5K tune-up instead of this long run if you want a fitness check.";
    }
    if (month === 10 || month === 11) {
      return "Cooler mornings finally. Use them to practice race-day breakfast and gel timing once the long run passes 75 minutes.";
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
  if (type === "easy" && (month === 8 || month === 9)) {
    return "Sunrise or it waits. Heat is a training load of its own in August and September.";
  }
  return null;
}

function purposeFor(type: WorkoutType, phase: Phase, long: number, cutback: boolean, override?: string): string {
  if (override) return override;
  switch (type) {
    case "race":
      return "Thirteen point one miles from downtown to the Capitol. Everything in this plan pointed here.";
    case "long":
      if (cutback) return "Cutback long run. Backing off this week is what lets next week's jump stick.";
      if (long >= 10) return "The confidence run. Time on feet teaches your legs the second half of the race.";
      return "Builds the aerobic base that carries the back half of a half marathon.";
    case "easy":
      return "Easy miles. Aerobic volume with almost no cost to recovery. Full sentences, or you are going too fast.";
    case "quality":
      return "The session that makes you faster. Warm up, work, cool down — the middle is supposed to feel hard.";
    case "walk_run":
      return "Walk/run intervals build durability while keeping impact low — this is how beginners avoid shin splints.";
    case "shakeout":
      return "Short and loose to keep the legs awake without spending anything.";
    case "cross":
      return "Optional cross-train. Aerobic work without the pounding.";
    case "rest":
      return "No run. Strength or core if it is on the calendar; otherwise this is when the adaptations actually happen.";
  }
}

function titleFor(type: WorkoutType, distance: number, weeksToRace: number, override?: string): string {
  if (override) return override;
  switch (type) {
    case "race":
      return "Austin Half Marathon — 13.1 mi";
    case "long":
      return `Long run — ${formatMi(distance)} mi`;
    case "easy":
      return `Easy run — ${formatMi(distance)} mi`;
    case "quality":
      return `Quality — ${formatMi(distance)} mi`;
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
 *
 * Weekly rhythm (assuming a Saturday long run):
 *   Mon strength A · Tue run (easy → quality) · Wed abs A ·
 *   Thu easy · Fri strength B + abs B · Sat long · Sun rest / easy
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
    const cutback = isCutbackWeek(weeksToRace);
    const quality = qualityFor(weeksToRace, phase, cutback);

    const assignments = new Map<number, DayAssign>();

    if (phase === "race") {
      assignments.set(2, { type: "easy", distance: 3, durationMin: null });
      assignments.set(4, { type: "shakeout", distance: 2, durationMin: null });
    } else {
      assignments.set(longRunDay, { type: "long", distance: long, durationMin: null });

      // Tuesday = day after Monday strength. If long run is Sunday, Tuesday is +2.
      const tue = 2;
      const thu = 4;
      const sun = 0;

      if (tue !== longRunDay) {
        if (quality) {
          assignments.set(tue, {
            type: "quality",
            distance: quality.distance,
            durationMin: quality.durationMin,
            title: quality.title,
            purpose: quality.purpose,
          });
        } else if (usesWalkRun(weeksToRace)) {
          const interval = walkRunInterval(weeksToRace);
          assignments.set(tue, { type: "walk_run", distance: round25(interval.totalMin / 15), durationMin: interval.totalMin });
        } else {
          assignments.set(tue, { type: "easy", distance: tueEasyDistance(phase, long), durationMin: null });
        }
      }

      if (thu !== longRunDay) {
        const dist = thuDistance(phase, long, weeksToRace);
        if (dist > 0) {
          if (usesWalkRun(weeksToRace)) {
            const interval = walkRunInterval(weeksToRace);
            assignments.set(thu, {
              type: "walk_run",
              distance: round25((interval.totalMin - 4) / 15),
              durationMin: interval.totalMin - 4,
            });
          } else {
            assignments.set(thu, { type: "easy", distance: dist, durationMin: null });
          }
        }
      }

      const sundayMi = sunDistance(phase);
      if (sundayMi && sun !== longRunDay) {
        assignments.set(sun, { type: "easy", distance: sundayMi, durationMin: null });
      }
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
      const durationMin = type === "walk_run" || type === "quality" ? (assigned?.durationMin ?? null) : type === "cross" ? 30 : null;

      const qualityTip = type === "quality" ? quality?.tip ?? null : null;

      seeds.push({
        date,
        week,
        weeksToRace,
        phase,
        type,
        title: titleFor(type, distance, weeksToRace, assigned?.title),
        distanceMi: distance,
        durationMin,
        purpose: purposeFor(type, phase, long, cutback, assigned?.purpose),
        tip: qualityTip ?? austinTip(date, type, phase, long, weeksToRace),
      });
    }
  }

  return seeds;
}

export function plannedMiles(seeds: Pick<WorkoutSeed, "distanceMi">[]): number {
  return round25(seeds.reduce((total, seed) => total + seed.distanceMi, 0));
}

export { phaseFor } from "./types";

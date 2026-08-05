import { addDays, startOfWeek } from "@/lib/date";
import type { Snapshot } from "./snapshot";
import type { SuggestionDraft } from "./types";

/**
 * Deterministic guardrails. These run on every sync, cost nothing, and work
 * without an API key — the language model layer adds nuance on top of them but
 * is never the only thing watching. Each rule is deliberately conservative:
 * when the numbers are ambiguous, say nothing.
 */

const RHR_JUMP = 5;
const HRV_DROP_PCT = 15;
const SHORT_SLEEP_MIN = 6 * 60;

type Rule = (snapshot: Snapshot) => SuggestionDraft | null;

const nextWeekStart = (snapshot: Snapshot) => addDays(startOfWeek(snapshot.today), 7);

/** Recovery markers moving the wrong way at the same time. */
const strain: Rule = (snapshot) => {
  const { restingHrBaseline, restingHrRecent, hrvBaseline, hrvRecent } = snapshot.totals;
  const rhrUp =
    restingHrBaseline !== null && restingHrRecent !== null && restingHrRecent - restingHrBaseline >= RHR_JUMP;
  const hrvDown =
    hrvBaseline !== null &&
    hrvRecent !== null &&
    hrvBaseline > 0 &&
    ((hrvBaseline - hrvRecent) / hrvBaseline) * 100 >= HRV_DROP_PCT;

  if (!rhrUp && !hrvDown) return null;

  const weekStart = nextWeekStart(snapshot);
  const parts: string[] = [];
  if (rhrUp) {
    parts.push(
      `resting heart rate is averaging ${restingHrRecent} against a two-week normal of ${restingHrBaseline}`,
    );
  }
  if (hrvDown) parts.push(`HRV is down to ${hrvRecent} ms from ${hrvBaseline} ms`);

  return {
    kind: "recovery-strain",
    title: rhrUp && hrvDown ? "Your body is asking for a lighter week" : "Recovery markers are drifting",
    rationale: `Over the last few days ${parts.join(" and ")}. That usually means the load is landing faster than you are absorbing it. Backing next week off to 80% keeps the block intact — the fitness is built by the weeks you recover from, not the ones you survive.`,
    confidence: rhrUp && hrvDown ? "high" : "medium",
    changes: [{ op: "scale_week", weekStart, pct: 80 }],
    fingerprint: `recovery-strain:${weekStart}`,
  };
};

/** Sleep debt: keep the running, drop the lifting. */
const sleepDebt: Rule = (snapshot) => {
  const nights = snapshot.days.slice(-5).map((day) => day.asleepMin).filter((v): v is number => v !== null);
  if (nights.length < 3) return null;
  const short = nights.filter((minutes) => minutes < SHORT_SLEEP_MIN).length;
  if (short < 3) return null;

  const target = snapshot.ahead.find((day) => day.strength === "full");
  const hours = Math.round((nights.reduce((a, b) => a + b, 0) / nights.length / 60) * 10) / 10;

  return {
    kind: "sleep-debt",
    title: "Three short nights — protect the running first",
    rationale: `You have averaged ${hours} hours over the last ${nights.length} nights, with ${short} of them under six. Sleep is where the adaptation happens, so the honest move is to keep the runs and let the lifting go this round rather than spreading yourself thinner.${target ? "" : " Nothing to drop this week, so treat it as a note: run by effort, not pace."}`,
    confidence: "medium",
    changes: target ? [{ op: "skip_strength", date: target.date }] : [],
    fingerprint: `sleep-debt:${snapshot.today}`,
  };
};

/** Missed runs: repeat the week rather than climb on a shaky base. */
const missedRuns: Rule = (snapshot) => {
  const recent = snapshot.days.slice(-7);
  const skipped = recent.filter((day) => day.status === "skipped");
  if (skipped.length < 2) return null;

  const weekStart = nextWeekStart(snapshot);
  const reasons = [...new Set(skipped.map((day) => day.skipReason).filter(Boolean))].join(", ");

  return {
    kind: "missed-runs",
    title: `${skipped.length} runs missed this week — hold the line instead of climbing`,
    rationale: `${skipped.length} of the last seven days went unrun${reasons ? ` (${reasons})` : ""}. Progressing on top of a week that did not happen is how beginners get hurt. Holding next week repeats this prescription instead of adding to it, and nothing is lost — the block was built with room for exactly this.`,
    confidence: "high",
    changes: [{ op: "hold_week", weekStart }],
    fingerprint: `missed-runs:${weekStart}`,
  };
};

/** Too big a jump from what actually happened to what is planned. */
const bigJump: Rule = (snapshot) => {
  const { doneMi7 } = snapshot.totals;
  const planned = snapshot.nextWeek.totalMi;
  if (doneMi7 < 3 || planned <= 0) return null;
  const ratio = planned / doneMi7;
  if (ratio < 1.35) return null;

  const pct = Math.max(60, Math.min(110, Math.round(((doneMi7 * 1.15) / planned) * 100)));

  return {
    kind: "mileage-jump",
    title: `Next week is a ${Math.round((ratio - 1) * 100)}% jump on what you actually ran`,
    rationale: `You covered ${doneMi7} miles this week and the plan asks for ${planned} next week. Ten to fifteen percent is the size of jump legs tend to accept. Scaling to ${pct}% lands you near ${Math.round(planned * (pct / 100) * 10) / 10} miles, which still moves you forward.`,
    confidence: "medium",
    changes: [{ op: "scale_week", weekStart: snapshot.nextWeek.weekStart, pct }],
    fingerprint: `mileage-jump:${snapshot.nextWeek.weekStart}`,
  };
};

/** Under-eating during real training, which is how runners lose muscle and races. */
const underFuelled: Rule = (snapshot) => {
  const adherence = snapshot.totals.kcalAdherencePct;
  if (adherence === null || adherence >= 88) return null;
  if (snapshot.days.filter((day) => day.kcalIn !== null).length < 5) return null;

  return {
    kind: "under-fuelled",
    title: `Eating ${100 - Math.round(adherence)}% under target while the mileage climbs`,
    rationale: `Logged intake has averaged ${Math.round(adherence)}% of target. A deficit is part of the abs goal, but an accidental deficit on top of a deliberate one costs muscle and turns easy runs heavy. Adding 200 kcal back to the daily number keeps the cut intentional rather than incidental.`,
    confidence: "medium",
    changes: [{ op: "set_calorie_delta", kcal: 200 }],
    fingerprint: `under-fuelled:${snapshot.today}`,
  };
};

/** Protein is the one macro that protects abs while a deficit runs. */
const lowProtein: Rule = (snapshot) => {
  const adherence = snapshot.totals.proteinAdherencePct;
  if (!snapshot.abs.enabled || adherence === null || adherence >= 85) return null;
  if (snapshot.days.filter((day) => day.proteinIn !== null).length < 5) return null;

  return {
    kind: "low-protein",
    title: "Protein is short for a body-fat goal",
    rationale: `Protein has landed at ${Math.round(adherence)}% of target across the week. In a deficit that is the difference between losing fat and losing the muscle you are trying to reveal. Raising the floor to 2 g per kg makes the target explicit, and the meal plan will rebuild around it.`,
    confidence: "high",
    changes: [{ op: "set_protein_floor", gPerKg: 2 }],
    fingerprint: `low-protein:${snapshot.today}`,
  };
};

/** Strength sessions being skipped: make the ask smaller instead of louder. */
const strengthSlipping: Rule = (snapshot) => {
  const { strengthPlanned14, strengthDone14 } = snapshot.totals;
  if (strengthPlanned14 < 4) return null;
  if (strengthDone14 / strengthPlanned14 >= 0.5) return null;
  if (snapshot.runner.strengthDays <= 1) return null;

  return {
    kind: "strength-slipping",
    title: `Only ${strengthDone14} of ${strengthPlanned14} strength sessions happened`,
    rationale: `Two lifting days is the right dose on paper and clearly the wrong dose in your actual week. One session you never miss beats two you resent — and the core circuits, which are what the abs goal really needs, stay on the calendar either way.`,
    confidence: "medium",
    changes: [{ op: "set_strength_days", days: 1 }],
    fingerprint: `strength-slipping:${snapshot.today}`,
  };
};

/** The abs goal versus the runway, stated plainly. */
const absRunway: Rule = (snapshot) => {
  if (!snapshot.abs.enabled) return null;
  if (snapshot.abs.verdict !== "after-race") return null;
  if (snapshot.abs.bodyFatPct === null || snapshot.abs.kgToLose === null) return null;
  if (snapshot.race.daysAway < 42) return null;

  const realistic = Math.round((snapshot.abs.bodyFatPct - 2) * 10) / 10;
  if (realistic <= snapshot.abs.targetPct) return null;

  return {
    kind: "abs-runway",
    title: "The abs target does not fit the runway",
    rationale: `You are around ${snapshot.abs.bodyFatPct}% body fat aiming at ${snapshot.abs.targetPct}%, and the deficit that peak weeks allow will not cover the gap before race day. Two options, both honest: keep the target and accept it arrives after Austin, or reset to ${realistic}% now, hit it, and go lower after the race. Cutting harder while the long runs grow is the one choice that costs you the race.`,
    confidence: "medium",
    changes: [{ op: "set_target_body_fat", pct: realistic }],
    fingerprint: `abs-runway:${startOfWeek(snapshot.today)}`,
  };
};

/** Long runs failing on their scheduled day is a calendar problem, not a fitness one. */
const longRunDay: Rule = (snapshot) => {
  const longs = snapshot.days.filter((day) => day.type === "long");
  const missed = longs.filter((day) => day.status === "skipped");
  if (longs.length < 2 || missed.length < 2) return null;

  const alternative = snapshot.runner.longRunDay === 6 ? 0 : 6;
  return {
    kind: "long-run-day",
    title: "The long run keeps falling off its day",
    rationale: `Both of the last long runs were missed on ${snapshot.runner.longRunDay === 6 ? "Saturday" : "Sunday"}. The long run is the one session that actually has to happen, so it should sit on the day your week protects. Moving it changes nothing about the training and everything about whether it gets done.`,
    confidence: "medium",
    changes: [{ op: "move_long_run", weekStart: nextWeekStart(snapshot), dow: alternative }],
    fingerprint: `long-run-day:${nextWeekStart(snapshot)}`,
  };
};

const RULES: Rule[] = [
  strain,
  missedRuns,
  bigJump,
  sleepDebt,
  lowProtein,
  underFuelled,
  strengthSlipping,
  longRunDay,
  absRunway,
];

/** At most three at a time — a wall of advice is the same as no advice. */
export function runRules(snapshot: Snapshot): SuggestionDraft[] {
  const drafts: SuggestionDraft[] = [];
  for (const rule of RULES) {
    const draft = rule(snapshot);
    if (draft) drafts.push(draft);
    if (drafts.length === 3) break;
  }
  return drafts;
}

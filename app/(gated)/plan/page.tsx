import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatRange, formatShort, startOfWeek, todayISO, weekdayShort } from "@/lib/date";
import { formatMiles } from "@/lib/format";
import { PHASE_BLURB, PHASE_LABEL, type Phase } from "@/lib/plan/types";
import { getAllWorkouts, getAllWorkoutLogs, getProfile } from "@/lib/store";
import { strengthBetween } from "@/lib/strength/plan";
import type { StrengthSession, Workout } from "@/drizzle/schema";

export const dynamic = "force-dynamic";

function dayLabel(day: Workout, strength?: StrengthSession): string {
  if (day.type !== "rest") return day.title;
  if (!strength) return "Rest";
  if (strength.focus === "core") return strength.title;
  if (strength.focus === "mobility") return strength.title;
  return strength.title;
}

interface WeekGroup {
  weekStart: string;
  week: number;
  phase: Phase;
  days: Workout[];
  plannedMi: number;
}

export default async function PlanPage() {
  const profile = await getProfile();
  const workouts = await getAllWorkouts();
  const logs = await getAllWorkoutLogs();
  const loggedByDate = new Map(logs.map((log) => [log.date, log]));
  const strengthRows =
    workouts.length > 0
      ? await strengthBetween(workouts[0].date, workouts[workouts.length - 1].date)
      : [];
  const strengthByDate = new Map(strengthRows.map((session) => [session.date, session]));
  const today = todayISO();
  const thisWeek = startOfWeek(today);

  const groups = new Map<string, WeekGroup>();
  for (const workout of workouts) {
    const weekStart = startOfWeek(workout.date);
    const group = groups.get(weekStart) ?? {
      weekStart,
      week: workout.week,
      phase: workout.phase as Phase,
      days: [],
      plannedMi: 0,
    };
    group.days.push(workout);
    group.plannedMi += workout.distanceMi;
    group.phase = workout.phase as Phase;
    groups.set(weekStart, group);
  }

  const weeks = [...groups.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const past = weeks.filter((week) => week.weekStart < thisWeek);
  const upcoming = weeks.filter((week) => week.weekStart >= thisWeek);

  const renderWeek = (week: WeekGroup, index: number, list: WeekGroup[]) => {
    const showPhase = index === 0 || list[index - 1].phase !== week.phase;

    return (
      <div className="week" key={week.weekStart}>
        {showPhase ? (
          <>
            <p className="sec-label" style={{ marginTop: "1.5rem" }}>
              {PHASE_LABEL[week.phase]}
            </p>
            <p className="sec-intro small">{PHASE_BLURB[week.phase]}</p>
          </>
        ) : null}

        <div className="week-head">
          <h3 className="week-title">
            Week <em>{week.week}</em>
            {week.weekStart === thisWeek ? " · now" : ""}
          </h3>
          <p className="week-meta">
            {formatRange(week.weekStart, week.days[week.days.length - 1].date)} ·{" "}
            {formatMiles(Math.round(week.plannedMi * 10) / 10)} mi
          </p>
        </div>

        {week.days.map((day) => {
          const logged = loggedByDate.get(day.date);
          const strength = strengthByDate.get(day.date);
          const classes = ["day"];
          if (day.date === today) classes.push("day--today");
          if (day.type === "rest" && !strength) classes.push("day--rest");
          if (day.type === "quality") classes.push("day--quality");

          return (
            <Link className={classes.join(" ")} href={`/day/${day.date}`} key={day.date}>
              <span className="day-date">
                {weekdayShort(day.date)} {formatShort(day.date).split(" ")[1]}
              </span>
              <span className="day-name">{dayLabel(day, strength)}</span>
              <span className="day-dist">
                {day.type === "rest"
                  ? strength
                    ? `${strength.minutes} min`
                    : ""
                  : logged
                    ? `${formatMiles(logged.distanceMi)} mi`
                    : `${formatMiles(day.distanceMi)} mi`}
              </span>
              <span className="day-flag">
                {day.status === "done" || strength?.status === "done"
                  ? "✓"
                  : day.status === "skipped"
                    ? "skipped"
                    : ""}
              </span>
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <Shell wide>
      <section className="sec">
        <p className="sec-label">II · The plan</p>
        <h2 className="sec-title">
          Twenty-eight weeks to <em>Congress Avenue</em>
        </h2>
        <p className="sec-intro">
          {weeks.length} weeks: base, build, specific, peak, taper. Runs, strength, and abs on a
          fixed weekly grid, built backward from {profile.raceName}. Tap any day to log it.
        </p>
      </section>

      {past.length > 0 ? (
        <details style={{ marginBottom: "2rem" }}>
          <summary className="sec-label" style={{ cursor: "pointer" }}>
            {past.length} {past.length === 1 ? "week" : "weeks"} behind you
          </summary>
          <div style={{ marginTop: "1rem" }}>{past.map(renderWeek)}</div>
        </details>
      ) : null}

      {upcoming.map(renderWeek)}

      <Nav />
    </Shell>
  );
}

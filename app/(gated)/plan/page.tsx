import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { Icon, type IconName } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Ring } from "@/components/Ring";
import { Shell } from "@/components/Shell";
import { formatRange, formatShort, startOfWeek, todayISO, weekdayShort } from "@/lib/date";
import { formatMiles } from "@/lib/format";
import { pendingCount } from "@/lib/coach/store";
import { PHASE_LABEL, TYPE_LABEL, type Phase, type WorkoutType } from "@/lib/plan/types";
import { getAllWorkoutLogs, getAllWorkouts } from "@/lib/store";
import { parseBlocks } from "@/lib/strength/exercises";
import { strengthBetween } from "@/lib/strength/plan";
import type { StrengthSession, Workout } from "@/drizzle/schema";

export const dynamic = "force-dynamic";

const TYPE_ICON: Record<WorkoutType, IconName> = {
  rest: "rest",
  walk_run: "run",
  easy: "run",
  quality: "pulse",
  long: "run",
  cross: "cross",
  shakeout: "run",
  race: "flag",
};

const FOCUS_LABEL: Record<string, string> = {
  full: "Strength",
  core: "Abs",
  mobility: "Mobility",
};

interface WeekGroup {
  weekStart: string;
  week: number;
  phase: Phase;
  days: Workout[];
  plannedMi: number;
  loggedMi: number;
}

function dayTitle(day: Workout, strength?: StrengthSession): string {
  if (day.type !== "rest") return day.title;
  return strength ? strength.title : "Rest";
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string; d?: string }>;
}) {
  const { w, d } = await searchParams;
  const today = todayISO();
  const thisWeek = startOfWeek(today);

  const [workouts, logs, pending] = await Promise.all([
    getAllWorkouts(),
    getAllWorkoutLogs(),
    pendingCount(),
  ]);
  const loggedByDate = new Map(logs.map((log) => [log.date, log]));

  const groups = new Map<string, WeekGroup>();
  for (const workout of workouts) {
    const key = startOfWeek(workout.date);
    const group = groups.get(key) ?? {
      weekStart: key,
      week: workout.week,
      phase: workout.phase as Phase,
      days: [],
      plannedMi: 0,
      loggedMi: 0,
    };
    group.days.push(workout);
    group.plannedMi += workout.distanceMi;
    group.loggedMi += loggedByDate.get(workout.date)?.distanceMi ?? 0;
    group.phase = workout.phase as Phase;
    groups.set(key, group);
  }

  const weeks = [...groups.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  if (weeks.length === 0) {
    return (
      <>
        <Shell>
          <AppBar title="Plan" pending={pending} />
          <section className="block">
            <div className="card">
              <div className="empty">
                <span className="empty__icon">
                  <Icon name="calendar" size={20} />
                </span>
                <p className="card__title">No plan yet</p>
                <p className="small sub">Set a race date and the block builds itself.</p>
                <Link className="btn btn--primary btn--sm" href="/settings">
                  Open settings
                </Link>
              </div>
            </div>
          </section>
        </Shell>
        <Nav pending={pending} />
      </>
    );
  }

  const peak = weeks.reduce((max, week) => Math.max(max, week.plannedMi), 1);
  const requested = w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? startOfWeek(w) : thisWeek;
  const found = weeks.findIndex((week) => week.weekStart === requested);
  const index = found >= 0 ? found : 0;
  const active = weeks[index];

  const strengthRows = await strengthBetween(
    active.days[0].date,
    active.days[active.days.length - 1].date,
  );
  const strengthByDate = new Map(strengthRows.map((session) => [session.date, session]));

  const datesInWeek = new Set(active.days.map((day) => day.date));
  const selectedDate =
    d && /^\d{4}-\d{2}-\d{2}$/.test(d) && datesInWeek.has(d)
      ? d
      : datesInWeek.has(today)
        ? today
        : (active.days[0]?.date ?? today);

  const selectedDay = active.days.find((day) => day.date === selectedDate);
  const selectedStrength = strengthByDate.get(selectedDate);
  const selectedLog = loggedByDate.get(selectedDate);
  const selectedType = (selectedDay?.type ?? "rest") as WorkoutType;
  const selectedBlocks = selectedStrength ? parseBlocks(selectedStrength.blocks) : [];
  const selectedExerciseCount = selectedBlocks.reduce(
    (sum, block) => sum + block.exercises.length,
    0,
  );

  const previous = weeks[index - 1];
  const next = weeks[index + 1];
  const donePct = active.plannedMi > 0 ? (active.loggedMi / active.plannedMi) * 100 : 0;
  const lastWeek = weeks[weeks.length - 1];
  const dayHref =
    selectedDate === today
      ? "/"
      : `/day/${selectedDate}?from=plan&week=${active.weekStart}`;

  return (
    <>
      <Shell>
        <AppBar title="Plan" subtitle={`${weeks.length} weeks to race day`} pending={pending} />

        <div className="chiprow" style={{ marginTop: "0.25rem" }}>
          {weeks.map((week) => {
            const isActive = week.weekStart === active.weekStart;
            const isNow = week.weekStart === thisWeek;
            return (
              <Link
                key={week.weekStart}
                className={`chip${isActive ? " chip--accent" : isNow ? " chip--on" : ""}`}
                href={`/plan?w=${week.weekStart}`}
                aria-current={isActive ? "page" : undefined}
                prefetch
              >
                W{week.week}
              </Link>
            );
          })}
        </div>

        <section className="block block--tight">
          <div className="card card--pad-lg">
            <div className="card__head">
              <div>
                <div className="btnrow" style={{ gap: "0.35rem" }}>
                  <span className="pill pill--accent">{PHASE_LABEL[active.phase]}</span>
                  {active.weekStart === thisWeek ? (
                    <span className="pill pill--good">This week</span>
                  ) : null}
                </div>
                <h2 className="card__title" style={{ marginTop: "0.5rem" }}>
                  Week {active.week}
                </h2>
                <p className="card__sub">
                  {formatRange(active.weekStart, active.days[active.days.length - 1].date)}
                </p>
              </div>
              <Ring
                pct={donePct}
                tone={donePct >= 92 ? "good" : "accent"}
                size={72}
                thickness={7}
                value={formatMiles(Math.round(active.plannedMi * 10) / 10)}
                caption="miles"
                label={`${formatMiles(active.loggedMi)} of ${formatMiles(active.plannedMi)} miles logged`}
              />
            </div>

            <hr className="card__divide" />

            <div className="rows">
              {active.days.map((day) => {
                const logged = loggedByDate.get(day.date);
                const strength = strengthByDate.get(day.date);
                const type = day.type as WorkoutType;
                const isDone = day.status === "done" || strength?.status === "done";
                const isToday = day.date === today;
                const isSelected = day.date === selectedDate;

                return (
                  <Link
                    className={`row${isToday ? " row--now" : ""}${isSelected ? " row--selected" : ""}`}
                    href={`/plan?w=${active.weekStart}&d=${day.date}`}
                    key={day.date}
                    prefetch
                    aria-current={isSelected ? "true" : undefined}
                  >
                    <span className="row__date">{weekdayShort(day.date)}</span>
                    <span
                      className={`row__lead${isDone ? " row__lead--good" : isSelected || isToday ? " row__lead--accent" : ""}`}
                    >
                      <Icon
                        name={day.type === "rest" && strength ? "strength" : TYPE_ICON[type]}
                        size={17}
                      />
                    </span>
                    <span className="row__body">
                      <span className="row__title">{dayTitle(day, strength)}</span>
                      <span className="row__sub">
                        {TYPE_LABEL[type]}
                        {day.status === "skipped" ? " · skipped" : ""}
                      </span>
                    </span>
                    <span className="row__meta">
                      {day.type === "rest"
                        ? strength
                          ? `${strength.minutes}m`
                          : "—"
                        : logged
                          ? `${formatMiles(logged.distanceMi)} mi`
                          : `${formatMiles(day.distanceMi)} mi`}
                    </span>
                  </Link>
                );
              })}
            </div>

            <hr className="card__divide" />

            <div className="btnrow btnrow--split">
              {previous ? (
                <Link className="btn btn--ghost btn--sm" href={`/plan?w=${previous.weekStart}`}>
                  <Icon name="back" size={15} />
                  Week {previous.week}
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link className="btn btn--ghost btn--sm" href={`/plan?w=${next.weekStart}`}>
                  Week {next.week}
                  <Icon name="chevron" size={15} />
                </Link>
              ) : (
                <span />
              )}
            </div>
          </div>
        </section>

        {selectedDay ? (
          <section className="block block--tight">
            <div className="card">
              <div className="row-between" style={{ marginBottom: "0.35rem" }}>
                <div>
                  <p className="label">
                    {weekdayShort(selectedDate)} {formatShort(selectedDate)}
                    {selectedDate === today ? " · today" : ""}
                  </p>
                  <p className="tile__value" style={{ marginTop: "0.25rem" }}>
                    {dayTitle(selectedDay, selectedStrength)}
                  </p>
                </div>
                <Link className="btn btn--ghost btn--sm" href={dayHref} prefetch={false}>
                  Open day
                  <Icon name="chevron" size={15} />
                </Link>
              </div>

              <div className="btnrow" style={{ gap: "0.35rem", marginBottom: "0.75rem" }}>
                <span
                  className={`pill${selectedDay.status === "done" ? " pill--good" : selectedDay.status === "skipped" ? " pill--warn" : " pill--accent"}`}
                >
                  {TYPE_LABEL[selectedType]}
                </span>
                {selectedDay.status === "done" ? (
                  <span className="pill pill--good">Done</span>
                ) : null}
                {selectedDay.status === "skipped" ? (
                  <span className="pill pill--warn">Skipped</span>
                ) : null}
                {selectedStrength ? (
                  <span className="pill">
                    {FOCUS_LABEL[selectedStrength.focus] ?? "Strength"} · {selectedStrength.minutes}
                    m
                  </span>
                ) : null}
              </div>

              {(selectedDay.distanceMi > 0 ||
                selectedDay.durationMin ||
                selectedLog ||
                selectedExerciseCount > 0) && (
                <div className="stats" style={{ marginBottom: "0.75rem" }}>
                  {selectedDay.distanceMi > 0 || selectedLog ? (
                    <div>
                      <p className="stat__value">
                        {formatMiles(selectedLog?.distanceMi ?? selectedDay.distanceMi)}
                      </p>
                      <p className="stat__label">{selectedLog ? "Logged mi" : "Target mi"}</p>
                    </div>
                  ) : null}
                  {selectedDay.durationMin ? (
                    <div>
                      <p className="stat__value">{selectedDay.durationMin}</p>
                      <p className="stat__label">Minutes</p>
                    </div>
                  ) : null}
                  {selectedExerciseCount > 0 ? (
                    <div>
                      <p className="stat__value">{selectedExerciseCount}</p>
                      <p className="stat__label">Moves</p>
                    </div>
                  ) : null}
                </div>
              )}

              {selectedDay.purpose ? (
                <p className="small sub" style={{ marginBottom: "0.5rem" }}>
                  {selectedDay.purpose}
                </p>
              ) : null}
              {selectedDay.tip ? (
                <p className="small muted" style={{ marginBottom: "0.75rem" }}>
                  {selectedDay.tip}
                </p>
              ) : null}

              {selectedStrength && selectedBlocks.length > 0 ? (
                <>
                  <hr className="card__divide" />
                  <p className="label" style={{ marginBottom: "0.35rem" }}>
                    {selectedStrength.title}
                  </p>
                  <div className="rows">
                    {selectedBlocks.flatMap((block) =>
                      block.exercises.map((exercise) => (
                        <div className="row" key={exercise.id}>
                          <span className="row__body">
                            <span className="row__title">{exercise.name}</span>
                            <span className="row__sub row__sub--wrap">
                              {block.name}
                              {exercise.cue ? ` · ${exercise.cue}` : ""}
                            </span>
                          </span>
                          <span className="row__meta">{exercise.prescription}</span>
                        </div>
                      )),
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">The whole block</h2>
            <span className="label">Planned miles</span>
          </div>
          <div className="card">
            <div className="cols">
              {weeks.map((week) => {
                const height = Math.max(4, Math.round((week.plannedMi / peak) * 100));
                const isNow = week.weekStart === thisWeek;
                const future = week.weekStart > thisWeek;
                return (
                  <Link
                    className="col"
                    key={week.weekStart}
                    href={`/plan?w=${week.weekStart}`}
                    title={`Week ${week.week} · ${formatMiles(week.plannedMi)} mi · ${PHASE_LABEL[week.phase]}`}
                  >
                    <span
                      className={`col__bar${isNow ? " col__bar--now" : future ? " col__bar--future" : ""}`}
                      style={{ height: `${height}%` }}
                    />
                    <span className="col__tick">{week.week}</span>
                  </Link>
                );
              })}
            </div>
            <p className="card__sub" style={{ marginTop: "0.5rem" }}>
              Peak {formatMiles(Math.round(peak * 10) / 10)} mi · race{" "}
              {formatShort(lastWeek.days[lastWeek.days.length - 1].date)}
            </p>
          </div>
        </section>
      </Shell>
      <Nav pending={pending} />
    </>
  );
}

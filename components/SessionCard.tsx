import { annotateWorkout, completeRestDay, completeWorkout, reopenDay, skipDay } from "@/app/actions";
import { Icon, type IconName } from "@/components/Icon";
import { formatDuration, formatMiles, formatPace } from "@/lib/format";
import { TYPE_LABEL, isRun, type WorkoutType } from "@/lib/plan/types";
import type { Workout, WorkoutLog } from "@/drizzle/schema";

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

const FEELINGS = ["strong", "steady", "flat", "rough"];

function logCaption(log: WorkoutLog, runDay: boolean, done: boolean): string | null {
  if (done && runDay && log.source !== "healthkit") return null;
  if (log.source === "healthkit") {
    return runDay ? "From Apple Watch" : "From Apple Watch · outside the plan";
  }
  if (!runDay) return "Logged · outside the plan";
  return "Logged";
}

function hasSubjective(log: WorkoutLog): boolean {
  return Boolean(log.feel || log.rpe || (log.notes && log.notes.trim()));
}

function FeelEffortNotesFields({
  feelDefault,
  rpeDefault,
  notesDefault,
}: {
  feelDefault?: string | null;
  rpeDefault?: number | null;
  notesDefault?: string | null;
}) {
  const feel = feelDefault && FEELINGS.includes(feelDefault) ? feelDefault : "steady";
  return (
    <>
      <div>
        <p className="field__label">Felt</p>
        <div className="chiprow">
          {FEELINGS.map((name) => (
            <label className="chip" key={name}>
              <input type="radio" name="feel" value={name} defaultChecked={name === feel} />
              {name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="field__label">Effort</p>
        <div className="chiprow">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <label className="chip" key={n}>
              <input type="radio" name="rpe" value={n} defaultChecked={rpeDefault === n} />
              {n}
            </label>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field__label">Notes</span>
        <input
          name="notes"
          placeholder="Shoes, weather, how it went"
          defaultValue={notesDefault ?? ""}
        />
      </label>
    </>
  );
}

export function SessionCard({
  workout,
  log,
  hasStrength,
}: {
  workout: Workout;
  log: WorkoutLog | undefined;
  hasStrength: boolean;
}) {
  const type = workout.type as WorkoutType;
  const runDay = isRun(type);
  const date = workout.date;
  const done = workout.status === "done";
  const skipped = workout.status === "skipped";
  const hasLog = Boolean(log && (log.distanceMi > 0 || (log.durationSec ?? 0) > 0));
  const fromWatch = Boolean(hasLog && log?.source === "healthkit");
  const caption = log && hasLog ? logCaption(log, runDay, done) : null;
  const needsFeel = fromWatch && runDay && !skipped;
  const openFeelFold = needsFeel && !hasSubjective(log!);

  return (
    <div className="card card--pad-lg">
      <div className="card__head">
        <div style={{ minWidth: 0 }}>
          <div className="btnrow" style={{ gap: "0.35rem" }}>
            <span
              className={`pill${done ? " pill--good" : skipped ? " pill--warn" : " pill--accent"}`}
            >
              {TYPE_LABEL[type]}
            </span>
            {done ? <span className="pill pill--good">Done</span> : null}
            {skipped ? <span className="pill pill--warn">Skipped</span> : null}
            {!done && !skipped && hasLog ? (
              <span className="pill pill--good">{fromWatch ? "From Watch" : "Workout logged"}</span>
            ) : null}
          </div>
          <h2 className="card__title" style={{ marginTop: "0.5rem" }}>
            {type === "race" ? "Austin Half Marathon" : workout.title}
          </h2>
        </div>
        <span
          className={`row__lead${done || hasLog ? " row__lead--good" : " row__lead--accent"}`}
        >
          <Icon name={hasLog && !runDay ? "run" : TYPE_ICON[type]} size={19} />
        </span>
      </div>

      {hasLog && log ? (
        <>
          <hr className="card__divide" />
          {caption ? (
            <p className="label" style={{ marginBottom: "0.45rem" }}>
              {caption}
            </p>
          ) : null}
          <div className="stats">
            <div>
              <p className="stat__value">{formatMiles(log.distanceMi)}</p>
              <p className="stat__label">Miles</p>
            </div>
            <div>
              <p className="stat__value">{formatDuration(log.durationSec)}</p>
              <p className="stat__label">Time</p>
            </div>
            <div>
              <p className="stat__value">{formatPace(log.durationSec, log.distanceMi)}</p>
              <p className="stat__label">Pace</p>
            </div>
            {log.feel ? (
              <div>
                <p className="stat__value" style={{ textTransform: "capitalize" }}>
                  {log.feel}
                </p>
                <p className="stat__label">Felt</p>
              </div>
            ) : null}
            {log.rpe ? (
              <div>
                <p className="stat__value">{log.rpe}</p>
                <p className="stat__label">Effort</p>
              </div>
            ) : null}
          </div>
          {log.notes ? <p className="card__sub">{log.notes}</p> : null}
        </>
      ) : null}

      {!done && !skipped && !hasLog && (workout.distanceMi > 0 || workout.durationMin) ? (
        <>
          <hr className="card__divide" />
          <div className="stats">
            {workout.distanceMi > 0 ? (
              <div>
                <p className="stat__value">{formatMiles(workout.distanceMi)}</p>
                <p className="stat__label">Target miles</p>
              </div>
            ) : null}
            {workout.durationMin ? (
              <div>
                <p className="stat__value">{workout.durationMin}</p>
                <p className="stat__label">Minutes</p>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {skipped && workout.skipReason ? (
        <p className="card__sub">Reason: {workout.skipReason}</p>
      ) : null}

      {workout.purpose || workout.tip ? (
        <details className="fold" style={{ marginTop: "0.5rem" }}>
          <summary>Why this session</summary>
          <div className="fold__body">
            <p className="small sub">{workout.purpose}</p>
            {workout.tip ? (
              <p className="small muted" style={{ marginTop: "0.5rem" }}>
                {workout.tip}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      {/* Watch-synced run: miles/time already in — only Felt / effort / notes */}
      {needsFeel ? (
        <>
          <hr className="card__divide" />
          <details className="fold fold--cta" defaultOpen={openFeelFold}>
            <summary>
              <Icon name="check" size={17} strokeWidth={2.2} />
              {hasSubjective(log!) ? "Edit how it felt" : "How did it feel?"}
            </summary>
            <div className="fold__body">
              <form action={annotateWorkout} className="stack">
                <input type="hidden" name="date" value={date} />
                <FeelEffortNotesFields
                  feelDefault={log?.feel}
                  rpeDefault={log?.rpe}
                  notesDefault={log?.notes}
                />
                <button className="btn btn--primary btn--block" type="submit">
                  {hasSubjective(log!) ? "Update" : "Save"}
                </button>
              </form>
              {!done ? (
                <form action={skipDay} style={{ marginTop: "0.75rem" }}>
                  <input type="hidden" name="date" value={date} />
                  <div className="inline-field">
                    <input name="reason" placeholder="Or skip — what got in the way?" />
                    <button className="btn btn--quiet btn--sm nowrap" type="submit">
                      Skip
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </details>
        </>
      ) : null}

      {/* Manual log when nothing came from the Watch yet */}
      {!done && !skipped && runDay && !fromWatch ? (
        <>
          <hr className="card__divide" />
          <details className="fold fold--cta">
            <summary>
              <Icon name="check" size={17} strokeWidth={2.2} />
              Log this run
            </summary>
            <div className="fold__body">
              <form action={completeWorkout} className="stack">
                <input type="hidden" name="date" value={date} />
                <div className="grid3">
                  <label className="field">
                    <span className="field__label">Miles</span>
                    <input
                      name="distanceMi"
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      defaultValue={log?.distanceMi || workout.distanceMi || ""}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Min</span>
                    <input
                      name="minutes"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      placeholder={
                        log?.durationSec
                          ? String(Math.floor(log.durationSec / 60))
                          : workout.durationMin
                            ? String(workout.durationMin)
                            : "0"
                      }
                      defaultValue={
                        log?.durationSec ? String(Math.floor(log.durationSec / 60)) : undefined
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Sec</span>
                    <input
                      name="seconds"
                      type="number"
                      min="0"
                      max="59"
                      inputMode="numeric"
                      placeholder="00"
                      defaultValue={
                        log?.durationSec ? String(log.durationSec % 60) : undefined
                      }
                    />
                  </label>
                </div>

                <FeelEffortNotesFields />

                <button className="btn btn--primary btn--block" type="submit">
                  Save run
                </button>
              </form>

              <form action={skipDay} style={{ marginTop: "0.75rem" }}>
                <input type="hidden" name="date" value={date} />
                <div className="inline-field">
                  <input name="reason" placeholder="Or skip — what got in the way?" />
                  <button className="btn btn--quiet btn--sm nowrap" type="submit">
                    Skip
                  </button>
                </div>
              </form>
            </div>
          </details>
        </>
      ) : null}

      {!done && !skipped && !runDay ? (
        <form action={completeRestDay} style={{ marginTop: "1rem" }}>
          <input type="hidden" name="date" value={date} />
          <button className="btn btn--ghost btn--block" type="submit">
            <Icon name="check" size={17} strokeWidth={2.2} />
            {hasStrength ? "No run today — honored" : "Rest honored"}
          </button>
        </form>
      ) : null}

      {done || skipped ? (
        <form action={reopenDay} style={{ marginTop: "0.875rem" }}>
          <input type="hidden" name="date" value={date} />
          <button className="btn btn--quiet btn--sm" type="submit">
            Reopen day
          </button>
        </form>
      ) : null}
    </div>
  );
}

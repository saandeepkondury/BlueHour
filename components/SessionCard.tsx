import Link from "next/link";
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

      <label className="field">
        <span className="field__label">Effort</span>
        <input
          name="rpe"
          type="number"
          min="1"
          max="10"
          inputMode="numeric"
          placeholder="1–10"
          defaultValue={rpeDefault ?? ""}
        />
      </label>

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

function LogMeta({ log }: { log: WorkoutLog }) {
  const parts: string[] = [];
  if (log.feel) parts.push(log.feel);
  if (log.rpe) parts.push(`Effort ${log.rpe}`);
  if (parts.length === 0 && !log.notes) return null;

  return (
    <div style={{ marginTop: "0.55rem" }}>
      {parts.length > 0 ? (
        <p className="card__sub" style={{ textTransform: "capitalize", marginTop: 0 }}>
          {parts.join(" · ")}
        </p>
      ) : null}
      {log.notes ? (
        <p className="small muted" style={{ marginTop: parts.length ? "0.2rem" : 0 }}>
          {log.notes}
        </p>
      ) : null}
    </div>
  );
}

function LogStats({ log }: { log: WorkoutLog }) {
  return (
    <div className="stats stats--quad">
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
      <div>
        <p className="stat__value">{log.activeKcal != null ? String(log.activeKcal) : "—"}</p>
        <p className="stat__label">Cal</p>
      </div>
    </div>
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

  const showWatchFeel = fromWatch && runDay && !done && !skipped;
  const showManualLog = !fromWatch && runDay && !done && !skipped;
  const showTargets =
    !done && !skipped && !hasLog && (workout.distanceMi > 0 || Boolean(workout.durationMin));

  const sourceLine = hasLog
    ? fromWatch
      ? runDay
        ? "From Apple Watch"
        : "From Apple Watch · outside the plan"
      : runDay
        ? null
        : "Logged · outside the plan"
    : null;

  const pillTone = done ? "pill--good" : skipped ? "pill--warn" : "pill--accent";

  return (
    <div className="card card--pad-lg">
      <Link
        href="/runs"
        className="cardlink"
        style={{ display: "block", color: "inherit", textDecoration: "none" }}
        aria-label="Open run history"
      >
        <div className="card__head">
          <div style={{ minWidth: 0 }}>
            <span className={`pill ${pillTone}`}>{TYPE_LABEL[type]}</span>
            <h2 className="card__title" style={{ marginTop: "0.45rem" }}>
              {type === "race" ? "Austin Half Marathon" : workout.title}
            </h2>
            {sourceLine ? <p className="card__sub">{sourceLine}</p> : null}
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span
              className={`row__lead${done || hasLog ? " row__lead--good" : " row__lead--accent"}`}
            >
              <Icon name={hasLog && !runDay ? "run" : TYPE_ICON[type]} size={19} />
            </span>
            <Icon name="chevron" size={15} />
          </span>
        </div>

        {hasLog && log ? (
          <>
            <hr className="card__divide" />
            <LogStats log={log} />
            <LogMeta log={log} />
          </>
        ) : null}

        {showTargets ? (
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
      </Link>

      {!done && (workout.purpose || workout.tip) ? (
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

      {showWatchFeel ? (
        <>
          <hr className="card__divide" />
          <form action={annotateWorkout} className="stack">
            <input type="hidden" name="date" value={date} />
            <p className="label">How did it feel?</p>
            <FeelEffortNotesFields
              feelDefault={log?.feel}
              rpeDefault={log?.rpe}
              notesDefault={log?.notes}
            />
            <button className="btn btn--primary btn--block" type="submit">
              Save
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
        </>
      ) : null}

      {showManualLog ? (
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

                <FeelEffortNotesFields
                  feelDefault={log?.feel}
                  rpeDefault={log?.rpe}
                  notesDefault={log?.notes}
                />

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
        <form action={reopenDay} style={{ marginTop: "0.75rem" }}>
          <input type="hidden" name="date" value={date} />
          <button className="btn btn--quiet btn--sm" type="submit">
            Reopen day
          </button>
        </form>
      ) : null}
    </div>
  );
}

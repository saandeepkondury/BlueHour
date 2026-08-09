import Link from "next/link";
import { annotateWorkout, completeRestDay, completeWorkout, reopenDay, skipDay } from "@/app/actions";
import { Icon, type IconName } from "@/components/Icon";
import { WatchSyncControl } from "@/components/WatchSyncControl";
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

function RecordedStats({ log }: { log: WorkoutLog }) {
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

function GoalStrip({ workout }: { workout: Workout }) {
  const type = workout.type as WorkoutType;

  if (type === "rest") {
    return (
      <div className="session-goal">
        <p className="label">Today&apos;s plan</p>
        <p className="session-goal__value">Rest</p>
        <p className="card__sub" style={{ marginTop: "0.25rem" }}>
          No run on the calendar. Honor the day — or do strength if it&apos;s scheduled.
        </p>
      </div>
    );
  }

  if (type === "cross") {
    return (
      <div className="session-goal">
        <p className="label">Today&apos;s plan</p>
        <p className="session-goal__value">Cross-train</p>
        {workout.durationMin ? (
          <p className="card__sub" style={{ marginTop: "0.25rem" }}>
            About {workout.durationMin} min · keep it easy on the legs
          </p>
        ) : null}
      </div>
    );
  }

  const bits: string[] = [];
  if (workout.distanceMi > 0) bits.push(`${formatMiles(workout.distanceMi)} mi`);
  if (workout.durationMin) bits.push(`${workout.durationMin} min`);

  return (
    <div className="session-goal">
      <p className="label">Today&apos;s goal</p>
      <p className="session-goal__value">
        {bits.length > 0 ? bits.join(" · ") : TYPE_LABEL[type]}
      </p>
    </div>
  );
}

function ProgressLine({
  workout,
  log,
}: {
  workout: Workout;
  log: WorkoutLog;
}) {
  if (workout.distanceMi <= 0 || log.distanceMi <= 0) return null;
  const pct = Math.min(999, Math.round((log.distanceMi / workout.distanceMi) * 100));
  return (
    <p className="small muted" style={{ marginTop: "0.45rem" }}>
      {formatMiles(log.distanceMi)} of {formatMiles(workout.distanceMi)} mi goal · {pct}%
    </p>
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
  const open = !done && !skipped;

  const hasLog = Boolean(log && (log.distanceMi > 0 || (log.durationSec ?? 0) > 0));
  const fromWatch = Boolean(hasLog && log?.source === "healthkit");
  const fromManual = Boolean(hasLog && log && log.source !== "healthkit");

  const waitingForWatch = runDay && open && !hasLog;
  const showFeelForm = fromWatch && runDay && open;
  const showFeelFold = fromWatch && runDay && done && !(log?.feel || log?.rpe || log?.notes);
  const showRestHonor = open && !runDay;

  const pillTone = done ? "pill--good" : skipped ? "pill--warn" : "pill--accent";
  const statusPill = done ? "Done" : skipped ? "Skipped" : null;

  const heading =
    type === "race"
      ? "Austin Half Marathon"
      : type === "rest"
        ? "Rest day"
        : workout.title;

  return (
    <div className="card card--pad-lg">
      <div className="card__head">
        <div style={{ minWidth: 0 }}>
          <div className="btnrow" style={{ gap: "0.35rem" }}>
            <span className={`pill ${pillTone}`}>{TYPE_LABEL[type]}</span>
            {statusPill ? (
              <span className={`pill ${done ? "pill--good" : "pill--warn"}`}>{statusPill}</span>
            ) : null}
          </div>
          <h2 className="card__title" style={{ marginTop: "0.45rem" }}>
            {heading}
          </h2>
        </div>
        <Link
          href="/runs"
          className="cardlink"
          style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "inherit" }}
          aria-label="Open run history"
        >
          <span
            className={`row__lead${done || fromWatch ? " row__lead--good" : " row__lead--accent"}`}
          >
            <Icon name={fromWatch ? "watch" : TYPE_ICON[type]} size={19} />
          </span>
          <Icon name="chevron" size={15} />
        </Link>
      </div>

      <hr className="card__divide" />
      <GoalStrip workout={workout} />

      {fromWatch && log ? (
        <>
          <hr className="card__divide" />
          <div className="session-recorded">
            <div className="row-between" style={{ marginBottom: "0.55rem" }}>
              <p className="label" style={{ margin: 0 }}>
                From Apple Watch
              </p>
              {log.avgHr ? (
                <p className="small muted" style={{ margin: 0 }}>
                  Avg HR {log.avgHr}
                  {log.maxHr ? ` · max ${log.maxHr}` : ""}
                </p>
              ) : null}
            </div>
            <RecordedStats log={log} />
            {runDay ? <ProgressLine workout={workout} log={log} /> : null}
            {!runDay ? (
              <p className="card__sub" style={{ marginTop: "0.45rem" }}>
                Recorded · outside the plan
              </p>
            ) : null}
            <LogMeta log={log} />
          </div>
        </>
      ) : null}

      {fromManual && log && !fromWatch ? (
        <>
          <hr className="card__divide" />
          <div className="session-recorded">
            <p className="label" style={{ marginBottom: "0.55rem" }}>
              Logged by hand
            </p>
            <RecordedStats log={log} />
            {runDay ? <ProgressLine workout={workout} log={log} /> : null}
            <LogMeta log={log} />
            <div style={{ marginTop: "0.75rem" }}>
              <p className="small muted" style={{ marginBottom: "0.5rem" }}>
                Prefer the Watch numbers? Sync to replace this log.
              </p>
              <WatchSyncControl label="Replace with Apple Health" />
            </div>
          </div>
        </>
      ) : null}

      {waitingForWatch ? (
        <>
          <hr className="card__divide" />
          <div className="banner" style={{ marginBottom: "0.75rem" }}>
            <span className="row__lead row__lead--accent">
              <Icon name="watch" size={18} />
            </span>
            <span className="banner__body">
              <span className="banner__title">Waiting on Apple Watch</span>
              <span className="banner__sub">
                Start Outdoor Walk or Run on the Watch. Miles, time, pace, and calories land here
                automatically after sync.
              </span>
            </span>
          </div>
          <WatchSyncControl label="Pull from Apple Health" />
        </>
      ) : null}

      {skipped && workout.skipReason ? (
        <p className="card__sub" style={{ marginTop: "0.75rem" }}>
          Reason: {workout.skipReason}
        </p>
      ) : null}

      {open && (workout.purpose || workout.tip) && type !== "rest" ? (
        <details className="fold" style={{ marginTop: "0.75rem" }}>
          <summary>Why this session</summary>
          <div className="fold__body">
            {workout.purpose ? <p className="small sub">{workout.purpose}</p> : null}
            {workout.tip ? (
              <p className="small muted" style={{ marginTop: workout.purpose ? "0.5rem" : 0 }}>
                {workout.tip}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      {showFeelForm && log ? (
        <>
          <hr className="card__divide" />
          <form action={annotateWorkout} className="stack">
            <input type="hidden" name="date" value={date} />
            <p className="label">How did it feel?</p>
            <FeelEffortNotesFields
              feelDefault={log.feel}
              rpeDefault={log.rpe}
              notesDefault={log.notes}
            />
            <button className="btn btn--primary btn--block" type="submit">
              Save &amp; close day
            </button>
          </form>
        </>
      ) : null}

      {showFeelFold && log ? (
        <details className="fold" style={{ marginTop: "0.75rem" }}>
          <summary>How did it feel?</summary>
          <div className="fold__body">
            <form action={annotateWorkout} className="stack">
              <input type="hidden" name="date" value={date} />
              <FeelEffortNotesFields
                feelDefault={log.feel}
                rpeDefault={log.rpe}
                notesDefault={log.notes}
              />
              <button className="btn btn--ghost btn--block" type="submit">
                Save notes
              </button>
            </form>
          </div>
        </details>
      ) : null}

      {waitingForWatch ? (
        <form action={skipDay} style={{ marginTop: "0.75rem" }}>
          <input type="hidden" name="date" value={date} />
          <div className="inline-field">
            <input name="reason" placeholder="Skip — what got in the way?" />
            <button className="btn btn--quiet btn--sm nowrap" type="submit">
              Skip
            </button>
          </div>
        </form>
      ) : null}

      {waitingForWatch ? (
        <details className="fold" style={{ marginTop: "0.75rem" }}>
          <summary>No Watch data? Log by hand</summary>
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
                    defaultValue={workout.distanceMi || ""}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Min</span>
                  <input
                    name="minutes"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    placeholder={workout.durationMin ? String(workout.durationMin) : "0"}
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
                  />
                </label>
              </div>
              <FeelEffortNotesFields />
              <button className="btn btn--ghost btn--block" type="submit">
                Save run
              </button>
            </form>
          </div>
        </details>
      ) : null}

      {showRestHonor ? (
        <form action={completeRestDay} style={{ marginTop: "1rem" }}>
          <input type="hidden" name="date" value={date} />
          <button className="btn btn--ghost btn--block" type="submit">
            <Icon name="check" size={17} strokeWidth={2.2} />
            {hasStrength ? "No run today — honored" : "Rest honored"}
          </button>
        </form>
      ) : null}

      {showFeelForm ? (
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

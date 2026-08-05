import {
  finishStrength,
  reopenStrengthSession,
  skipStrengthSession,
  toggleStrengthExercise,
} from "@/app/actions";
import { Check } from "@/components/Check";
import { Icon } from "@/components/Icon";
import { Ring } from "@/components/Ring";
import { parseBlocks } from "@/lib/strength/exercises";
import type { StrengthLog, StrengthSession } from "@/drizzle/schema";

const FOCUS_LABEL: Record<string, string> = {
  full: "Strength",
  core: "Abs",
  mobility: "Mobility",
};

export function StrengthCard({
  session,
  done,
  log,
}: {
  session: StrengthSession;
  done: Set<string>;
  log: StrengthLog | null;
}) {
  const blocks = parseBlocks(session.blocks);
  const total = blocks.reduce((sum, block) => sum + block.exercises.length, 0);
  const ticked = blocks.reduce(
    (sum, block) => sum + block.exercises.filter((exercise) => done.has(exercise.id)).length,
    0,
  );
  const pct = total > 0 ? (ticked / total) * 100 : 0;
  const open = session.status === "planned";

  return (
    <div className="card card--pad-lg">
      <div className="card__head">
        <div style={{ minWidth: 0 }}>
          <div className="btnrow" style={{ gap: "0.35rem" }}>
            <span className="pill pill--accent">{FOCUS_LABEL[session.focus] ?? "Strength"}</span>
            <span className="pill">{session.minutes} min</span>
            {session.status === "done" ? <span className="pill pill--good">Done</span> : null}
            {session.status === "skipped" ? <span className="pill pill--warn">Skipped</span> : null}
          </div>
          <h3 className="card__title" style={{ marginTop: "0.5rem" }}>
            {session.title}
          </h3>
        </div>
        {open && total > 0 ? (
          <Ring
            pct={pct}
            tone={pct >= 100 ? "good" : "accent"}
            size={60}
            thickness={6}
            value={`${ticked}/${total}`}
            label={`${ticked} of ${total} exercises done`}
          />
        ) : (
          <span className="row__lead row__lead--good">
            <Icon name="strength" size={19} />
          </span>
        )}
      </div>

      {open ? (
        <>
          <hr className="card__divide" />
          {blocks.map((block) => (
            <div key={block.name} style={{ marginBottom: "0.5rem" }}>
              <p className="label" style={{ marginBottom: "0.15rem" }}>
                {block.name}
              </p>
              <div className="rows">
                {block.exercises.map((exercise) => {
                  const checked = done.has(exercise.id);
                  return (
                    <div className={checked ? "row row--done" : "row"} key={exercise.id}>
                      <Check
                        action={toggleStrengthExercise}
                        on={checked}
                        flag="done"
                        label={exercise.name}
                        fields={{ date: session.date, exerciseId: exercise.id }}
                      />
                      <div className="row__body">
                        <span className="row__title">{exercise.name}</span>
                        <span className="row__sub">{exercise.cue}</span>
                      </div>
                      <span className="row__meta">{exercise.prescription}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <hr className="card__divide" />
          <details className="fold fold--cta">
            <summary>
              <Icon name="check" size={17} strokeWidth={2.2} />
              {ticked > 0 ? `Finish — ${ticked} of ${total} ticked` : "Finish session"}
            </summary>
            <div className="fold__body">
              <form action={finishStrength} className="stack">
                <input type="hidden" name="date" value={session.date} />
                <div className="grid2">
                  <label className="field">
                    <span className="field__label">Minutes</span>
                    <input
                      name="minutes"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      placeholder={String(session.minutes)}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Effort 1–10</span>
                    <input name="rpe" type="number" min="1" max="10" inputMode="numeric" />
                  </label>
                </div>
                <label className="field">
                  <span className="field__label">Loads and notes</span>
                  <input name="notes" placeholder="Weights, what to bump next time" />
                </label>
                <button className="btn btn--primary btn--block" type="submit">
                  Save session
                </button>
              </form>

              <form action={skipStrengthSession} style={{ marginTop: "0.75rem" }}>
                <input type="hidden" name="date" value={session.date} />
                <div className="inline-field">
                  <input name="reason" placeholder="Or skip — legs cooked, no time" />
                  <button className="btn btn--quiet btn--sm nowrap" type="submit">
                    Skip
                  </button>
                </div>
              </form>
            </div>
          </details>
        </>
      ) : (
        <>
          {log && (log.minutes || log.rpe) ? (
            <>
              <hr className="card__divide" />
              <div className="stats">
                {log.minutes ? (
                  <div>
                    <p className="stat__value">{log.minutes}</p>
                    <p className="stat__label">Minutes</p>
                  </div>
                ) : null}
                {log.rpe ? (
                  <div>
                    <p className="stat__value">{log.rpe}</p>
                    <p className="stat__label">Effort</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
          {log?.notes ? <p className="card__sub">{log.notes}</p> : null}
          {session.status === "skipped" && session.skipReason ? (
            <p className="card__sub">Reason: {session.skipReason}</p>
          ) : null}
          <form action={reopenStrengthSession} style={{ marginTop: "0.875rem" }}>
            <input type="hidden" name="date" value={session.date} />
            <button className="btn btn--quiet btn--sm" type="submit">
              Reopen
            </button>
          </form>
        </>
      )}
    </div>
  );
}

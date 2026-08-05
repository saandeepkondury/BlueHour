import {
  finishStrength,
  reopenStrengthSession,
  skipStrengthSession,
  toggleStrengthExercise,
} from "@/app/actions";
import { CheckButton } from "@/components/CheckButton";
import { parseBlocks } from "@/lib/strength/exercises";
import type { StrengthLog, StrengthSession } from "@/drizzle/schema";

const FOCUS_LABEL: Record<string, string> = {
  full: "Strength",
  core: "Core",
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

  return (
    <article className="plaque">
      <p className="plaque-kicker">
        {FOCUS_LABEL[session.focus] ?? "Strength"} · {session.minutes} min
        {session.status === "done" ? " · done" : session.status === "skipped" ? " · skipped" : ""}
      </p>
      <h3 className="plaque-title">{session.title}</h3>
      <p className="plaque-note">{session.purpose}</p>

      {session.status === "planned" ? (
        <>
          {blocks.map((block) => (
            <div className="block" key={block.name}>
              <p className="plaque-kicker">{block.name}</p>
              <ul className="check-list">
                {block.exercises.map((exercise) => {
                  const checked = done.has(exercise.id);
                  return (
                    <li
                      className={checked ? "check-item check-item--done" : "check-item"}
                      key={exercise.id}
                    >
                      <CheckButton
                        action={toggleStrengthExercise}
                        checked={checked}
                        label={exercise.name}
                        fields={{
                          date: session.date,
                          exerciseId: exercise.id,
                          done: checked ? "0" : "1",
                        }}
                      />
                      <div className="check-body">
                        <p className="block-prescription">{exercise.prescription}</p>
                        <p className="block-name">{exercise.name}</p>
                        <p className="block-cue">{exercise.cue}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <form action={finishStrength} style={{ marginTop: "1.3rem" }}>
            <input type="hidden" name="date" value={session.date} />
            <div className="field-row">
              <label className="field">
                <span className="field-label">Minutes</span>
                <input name="minutes" type="number" min="0" inputMode="numeric" placeholder={String(session.minutes)} />
              </label>
              <label className="field">
                <span className="field-label">Effort 1–10</span>
                <input name="rpe" type="number" min="1" max="10" inputMode="numeric" />
              </label>
            </div>
            <label className="field">
              <span className="field-label">Loads and notes</span>
              <textarea name="notes" placeholder="Weights used, what felt strong, what to bump next time." />
            </label>
            <button className="btn btn--full" type="submit">
              {ticked > 0 ? `Log session — ${ticked} of ${total} ticked` : "Log session"}
            </button>
          </form>

          <details style={{ marginTop: "1rem" }}>
            <summary className="plaque-kicker" style={{ cursor: "pointer" }}>
              Not today
            </summary>
            <form action={skipStrengthSession} style={{ marginTop: "0.8rem" }}>
              <input type="hidden" name="date" value={session.date} />
              <label className="field">
                <span className="field-label">Why</span>
                <input name="reason" placeholder="Legs cooked, no time, travelling" />
              </label>
              <button className="btn btn--ghost btn--small" type="submit">
                Skip the lift, keep the run
              </button>
            </form>
          </details>
        </>
      ) : (
        <>
          {log ? (
            <div className="metric-row">
              {log.minutes ? (
                <div className="metric">
                  <p className="metric-value">{log.minutes}</p>
                  <p className="metric-label">Minutes</p>
                </div>
              ) : null}
              {log.rpe ? (
                <div className="metric">
                  <p className="metric-value">{log.rpe}</p>
                  <p className="metric-label">Effort</p>
                </div>
              ) : null}
            </div>
          ) : null}
          {log?.notes ? <p className="plaque-tip">{log.notes}</p> : null}
          {session.status === "skipped" ? (
            <p className="plaque-note">
              Skipped{session.skipReason ? ` — ${session.skipReason}` : ""}. Nothing carries over.
            </p>
          ) : null}
          <form action={reopenStrengthSession} className="btn-row">
            <input type="hidden" name="date" value={session.date} />
            <button className="btn btn--ghost btn--small" type="submit">
              Reopen
            </button>
          </form>
        </>
      )}
    </article>
  );
}

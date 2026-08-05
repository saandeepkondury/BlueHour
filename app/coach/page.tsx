import Link from "next/link";
import { applySuggestionAction, askCoach, clearFuelOverrides, dismissSuggestionAction } from "@/app/actions";
import { Nav } from "@/components/Nav";
import { formatShort, todayISO } from "@/lib/date";
import { changesOf, decidedSuggestions, pendingSuggestions } from "@/lib/coach/store";
import { describeChange } from "@/lib/coach/types";
import { fuelOverrides, openaiConfig } from "@/lib/settings";
import { getProfile } from "@/lib/store";
import type { CoachSuggestion } from "@/drizzle/schema";

export const dynamic = "force-dynamic";

const ORIGIN_LABEL: Record<string, string> = {
  rules: "Guardrail",
  openai: "Coach",
};

function Suggestion({ row, pending }: { row: CoachSuggestion; pending: boolean }) {
  const changes = changesOf(row);
  const className = pending
    ? "plaque suggestion"
    : row.status === "applied"
      ? "plaque plaque--flat suggestion suggestion--applied"
      : "plaque plaque--flat suggestion suggestion--dismissed";

  return (
    <article className={className}>
      <p className="plaque-kicker">
        {ORIGIN_LABEL[row.origin] ?? "Coach"} · {formatShort(row.date)} · {row.confidence} confidence
        {pending ? "" : ` · ${row.status}`}
      </p>
      <h3 className="plaque-title" style={{ fontSize: "1.35rem" }}>
        {row.title}
      </h3>
      <p className="plaque-note">{row.rationale}</p>

      {changes.length > 0 ? (
        <>
          <p className="plaque-kicker" style={{ marginTop: "1rem" }}>
            {pending ? "If you apply this" : "What it changed"}
          </p>
          <ul className="change-list">
            {changes.map((change, index) => (
              <li key={`${change.op}-${index}`}>{describeChange(change)}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="tiny muted" style={{ marginTop: "0.8rem" }}>
          Advice only — nothing to change in the plan.
        </p>
      )}

      {pending ? (
        <div className="btn-row">
          {changes.length > 0 ? (
            <form action={applySuggestionAction}>
              <input type="hidden" name="id" value={row.id} />
              <button className="btn btn--accent btn--small" type="submit">
                Apply
              </button>
            </form>
          ) : null}
          <form action={dismissSuggestionAction}>
            <input type="hidden" name="id" value={row.id} />
            <button className="btn btn--ghost btn--small" type="submit">
              {changes.length > 0 ? "No thanks" : "Got it"}
            </button>
          </form>
        </div>
      ) : null}
    </article>
  );
}

export default async function CoachPage() {
  const current = await getProfile();
  const [pending, history, config, overrides] = await Promise.all([
    pendingSuggestions(),
    decidedSuggestions(12),
    openaiConfig(),
    fuelOverrides(),
  ]);

  const decided = history.filter((row) => row.status !== "pending");
  const hasOverrides = overrides.calorieDelta !== 0 || overrides.proteinFloor !== null;

  return (
    <>
      <main className="shell">
        <section className="sec">
          <p className="sec-label">Coach</p>
          <h1 className="sec-title">
            Reads everything, decides <em>nothing</em>
          </h1>
          <p className="sec-intro">
            Sleep, resting heart rate, HRV, every run, every logged meal, the strength sessions, and
            the body-fat trend go in. What comes back are proposals with the reasoning attached.
            Nothing touches your plan until you press Apply.
          </p>

          <form action={askCoach} className="btn-row">
            <button className="btn" type="submit" disabled={!config.key || current.aiEnabled !== 1}>
              Ask the coach now
            </button>
          </form>

          {!config.key ? (
            <p className="plaque plaque--quiet" style={{ marginTop: "1rem" }}>
              <span className="plaque-note">
                No OpenAI key yet, so only the built-in guardrails are running — those work without
                one. <Link href="/settings">Add a key in Settings</Link> to get the reading layer on
                top.
              </span>
            </p>
          ) : current.aiEnabled !== 1 ? (
            <p className="tiny muted" style={{ marginTop: "0.8rem" }}>
              The model is switched off in Settings. Guardrails still run.
            </p>
          ) : (
            <p className="tiny muted" style={{ marginTop: "0.8rem" }}>
              Using {config.model}
              {config.fromEnv ? ", key from the environment" : ", key stored in this app"}. Runs when
              you ask and after each Watch sync.
            </p>
          )}
        </section>

        {hasOverrides ? (
          <section className="sec">
            <p className="sec-label">Active adjustments</p>
            <article className="plaque plaque--flat">
              <ul className="change-list">
                {overrides.calorieDelta !== 0 ? (
                  <li>
                    {overrides.calorieDelta > 0 ? "+" : ""}
                    {overrides.calorieDelta} kcal on the daily target
                  </li>
                ) : null}
                {overrides.proteinFloor !== null ? (
                  <li>Protein floor at {overrides.proteinFloor} g per kg</li>
                ) : null}
              </ul>
              <form action={clearFuelOverrides} className="btn-row">
                <button className="btn btn--ghost btn--small" type="submit">
                  Clear adjustments
                </button>
              </form>
            </article>
          </section>
        ) : null}

        <section className="sec">
          <p className="sec-label">Waiting on you</p>
          {pending.length === 0 ? (
            <article className="plaque plaque--quiet">
              <p className="plaque-note">
                Nothing to decide. The guardrails are quiet, which is the good outcome — keep
                logging and they will speak up when something drifts.
              </p>
            </article>
          ) : (
            pending.map((row) => <Suggestion key={row.id} row={row} pending />)
          )}
        </section>

        {decided.length > 0 ? (
          <section className="sec">
            <p className="sec-label">Already decided</p>
            <h2 className="sec-title">
              What you <em>chose</em>
            </h2>
            {decided.map((row) => (
              <Suggestion key={row.id} row={row} pending={false} />
            ))}
          </section>
        ) : null}

        <p className="disclaimer">
          Training and nutrition guidance for a healthy adult, generated from the data you supply.
          Not medical advice. Pain that changes how you run, or anything that persists, is a
          conversation for a doctor or a physio — not for this app. Data as of {formatShort(todayISO())}.
        </p>
      </main>
      <Nav pending={pending.length} />
    </>
  );
}

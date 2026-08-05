import Link from "next/link";
import {
  applySuggestionAction,
  askCoach,
  clearFuelOverrides,
  dismissSuggestionAction,
} from "@/app/actions";
import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatShort } from "@/lib/date";
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

function Suggestion({ row, open }: { row: CoachSuggestion; open: boolean }) {
  const changes = changesOf(row);

  return (
    <div className={open ? "card card--pad-lg" : "card card--sunk"}>
      <div className="card__head">
        <div>
          <div className="btnrow" style={{ gap: "0.35rem" }}>
            <span className={open ? "pill pill--accent" : "pill"}>
              {ORIGIN_LABEL[row.origin] ?? "Coach"}
            </span>
            <span className="pill">{formatShort(row.date)}</span>
            {!open ? <span className="pill">{row.status}</span> : null}
          </div>
          <h3 className="card__title" style={{ marginTop: "0.5rem" }}>
            {row.title}
          </h3>
        </div>
        {open ? (
          <span className="row__lead row__lead--accent">
            <Icon name="coach" size={18} />
          </span>
        ) : null}
      </div>

      {changes.length > 0 ? (
        <>
          <hr className="card__divide" />
          <div className="rows">
            {changes.map((change, index) => (
              <div className="row" key={`${change.op}-${index}`} style={{ minHeight: "2.25rem" }}>
                <span className="row__body">
                  <span className="row__sub row__sub--wrap" style={{ color: "var(--ink)" }}>
                    {describeChange(change)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <details className="fold" style={{ marginTop: "0.5rem" }}>
        <summary>Why</summary>
        <div className="fold__body">
          <p className="small sub">{row.rationale}</p>
        </div>
      </details>

      {open ? (
        <div className="btnrow btnrow--split" style={{ marginTop: "0.75rem" }}>
          {changes.length > 0 ? (
            <form action={applySuggestionAction} style={{ flex: 1 }}>
              <input type="hidden" name="id" value={row.id} />
              <button className="btn btn--primary btn--sm btn--block" type="submit">
                Apply
              </button>
            </form>
          ) : null}
          <form action={dismissSuggestionAction} style={{ flex: 1 }}>
            <input type="hidden" name="id" value={row.id} />
            <button className="btn btn--quiet btn--sm btn--block" type="submit">
              {changes.length > 0 ? "No thanks" : "Got it"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
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
  const modelReady = Boolean(config.key) && current.aiEnabled === 1;

  return (
    <>
      <Shell>
        <AppBar title="Coach" subtitle="Proposes, never decides" pending={pending.length} />

        <section className="block block--tight">
          <div className="card">
            <div className="row-between">
              <div>
                <p className="label">Waiting on you</p>
                <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                  {pending.length}
                  <small>{pending.length === 1 ? "suggestion" : "suggestions"}</small>
                </p>
              </div>
              <form action={askCoach}>
                <button className="btn btn--primary btn--sm" type="submit" disabled={!modelReady}>
                  <Icon name="coach" size={16} />
                  Ask now
                </button>
              </form>
            </div>

            {!config.key ? (
              <p className="card__sub" style={{ marginTop: "0.75rem" }}>
                Guardrails are running. <Link href="/settings">Add an OpenAI key</Link> for the
                reading layer on top.
              </p>
            ) : current.aiEnabled !== 1 ? (
              <p className="card__sub" style={{ marginTop: "0.75rem" }}>
                Model is off in <Link href="/settings">Settings</Link>. Guardrails still run.
              </p>
            ) : (
              <p className="card__sub" style={{ marginTop: "0.75rem" }}>
                Using {config.model}.
              </p>
            )}
          </div>
        </section>

        {hasOverrides ? (
          <section className="block">
            <div className="block__head">
              <h2 className="block__title">Active adjustments</h2>
            </div>
            <div className="card card--accent">
              <div className="rows">
                {overrides.calorieDelta !== 0 ? (
                  <div className="row" style={{ minHeight: "2.25rem" }}>
                    <span className="row__body">
                      <span className="row__title">
                        {overrides.calorieDelta > 0 ? "+" : ""}
                        {overrides.calorieDelta} kcal daily
                      </span>
                    </span>
                  </div>
                ) : null}
                {overrides.proteinFloor !== null ? (
                  <div className="row" style={{ minHeight: "2.25rem" }}>
                    <span className="row__body">
                      <span className="row__title">
                        Protein floor {overrides.proteinFloor} g/kg
                      </span>
                    </span>
                  </div>
                ) : null}
              </div>
              <form action={clearFuelOverrides} style={{ marginTop: "0.75rem" }}>
                <button className="btn btn--quiet btn--sm" type="submit">
                  Clear
                </button>
              </form>
            </div>
          </section>
        ) : null}

        <section className="block">
          <div className="stack">
            {pending.length === 0 ? (
              <div className="card">
                <div className="empty">
                  <span className="empty__icon">
                    <Icon name="check" size={20} />
                  </span>
                  <p className="card__title">Nothing to decide</p>
                  <p className="small sub">Quiet guardrails are the good outcome. Keep logging.</p>
                </div>
              </div>
            ) : (
              pending.map((row) => <Suggestion key={row.id} row={row} open />)
            )}
          </div>
        </section>

        {decided.length > 0 ? (
          <section className="block">
            <div className="block__head">
              <h2 className="block__title">Already decided</h2>
              <span className="label">{decided.length}</span>
            </div>
            <div className="stack">
              {decided.map((row) => (
                <Suggestion key={row.id} row={row} open={false} />
              ))}
            </div>
          </section>
        ) : null}

        <p className="fineprint">
          Guidance generated from the data you supply, for a healthy adult. Not medical advice. Pain
          that changes how you run is a conversation for a doctor.
        </p>
      </Shell>
      <Nav pending={pending.length} />
    </>
  );
}

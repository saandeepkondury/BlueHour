import Link from "next/link";
import {
  applySuggestionAction,
  clearFuelOverrides,
  deleteSuggestionAction,
  dismissSuggestionAction,
} from "@/app/actions";
import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatShort, isoInTimeZone } from "@/lib/date";
import {
  changesOf,
  decidedSuggestions,
  expireOldSuggestions,
  pendingSuggestions,
  refreshCoach,
} from "@/lib/coach/store";
import { describeChange } from "@/lib/coach/types";
import { fuelOverrides, openaiConfig } from "@/lib/settings";
import { getProfile } from "@/lib/store";
import type { CoachSuggestion } from "@/drizzle/schema";

export const dynamic = "force-dynamic";

const ORIGIN_LABEL: Record<string, string> = {
  rules: "Guardrail",
  openai: "Daily review",
};

const STATUS_LABEL: Record<string, string> = {
  applied: "Applied",
  dismissed: "Passed",
  expired: "Expired",
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
            {!open ? <span className="pill">{STATUS_LABEL[row.status] ?? row.status}</span> : null}
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
        <div className="btnrow" style={{ marginTop: "0.75rem", flexWrap: "wrap" }}>
          {changes.length > 0 ? (
            <form action={applySuggestionAction} style={{ flex: "1 1 7rem" }}>
              <input type="hidden" name="id" value={row.id} />
              <button className="btn btn--primary btn--sm btn--block" type="submit">
                Apply
              </button>
            </form>
          ) : null}
          <form action={dismissSuggestionAction} style={{ flex: "1 1 7rem" }}>
            <input type="hidden" name="id" value={row.id} />
            <button className="btn btn--quiet btn--sm btn--block" type="submit">
              {changes.length > 0 ? "No thanks" : "Got it"}
            </button>
          </form>
          <form action={deleteSuggestionAction} style={{ flex: "1 1 7rem" }}>
            <input type="hidden" name="id" value={row.id} />
            <button className="btn btn--danger btn--sm btn--block" type="submit">
              Delete
            </button>
          </form>
        </div>
      ) : (
        <form action={deleteSuggestionAction} style={{ marginTop: "0.65rem" }}>
          <input type="hidden" name="id" value={row.id} />
          <button className="btn btn--danger btn--sm" type="submit">
            Delete
          </button>
        </form>
      )}
    </div>
  );
}

export default async function CoachPage() {
  const current = await getProfile();
  await expireOldSuggestions();
  const run = await refreshCoach(current);

  const [pending, decided, config, overrides] = await Promise.all([
    pendingSuggestions(),
    decidedSuggestions(24),
    openaiConfig(),
    fuelOverrides(),
  ]);

  const hasOverrides = overrides.calorieDelta !== 0 || overrides.proteinFloor !== null;
  const lastRunDay = run.lastRunAt ? formatShort(isoInTimeZone(new Date(run.lastRunAt))) : null;

  return (
    <>
      <Shell>
        <AppBar title="Coach" subtitle="Daily review · never auto-applies" pending={pending.length} />

        <section className="block block--tight">
          <div className="card">
            <div>
              <p className="label">Waiting on you</p>
              <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                {pending.length}
                <small>{pending.length === 1 ? "suggestion" : "suggestions"}</small>
              </p>
            </div>

            {!config.key ? (
              <p className="card__sub" style={{ marginTop: "0.75rem" }}>
                Daily review watches what you actually complete — meals eaten vs skipped, workouts,
                sleep, strength, fuel, grocery — and proposes small adjustments toward Feb 14.{" "}
                <Link href="/settings">Add an OpenAI key</Link> for a once-a-day synthesis on top of
                the guardrails. Nothing applies itself.
              </p>
            ) : current.aiEnabled !== 1 ? (
              <p className="card__sub" style={{ marginTop: "0.75rem" }}>
                Daily model review is off in <Link href="/settings">Settings</Link>. Guardrails still
                run from your logs.
              </p>
            ) : (
              <p className="card__sub" style={{ marginTop: "0.75rem" }}>
                {run.askedModel
                  ? `Today’s review just ran on ${config.model}.`
                  : lastRunDay
                    ? `Last daily review ${lastRunDay} · ${config.model}.`
                    : `Daily review is armed on ${config.model}. It runs once a day from this screen or the morning brief.`}{" "}
                It learns from what you complete vs skip — never from typed questions — and never
                auto-applies.
              </p>
            )}

            {run.error ? (
              <p className="card__sub" style={{ marginTop: "0.5rem", color: "var(--gold)" }}>
                {run.error}
              </p>
            ) : null}
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
                      <span className="row__title">Protein floor {overrides.proteinFloor} g/kg</span>
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
                  <p className="small sub">
                    Quiet is good. Review runs once a day from your logs — meals, workouts, sleep,
                    strength, fuel, grocery — and only speaks when the data does.
                  </p>
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

import Link from "next/link";
import { rotateIngestToken, saveHealthEntry } from "@/app/actions";
import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { todayISO } from "@/lib/date";
import { lastSync } from "@/lib/health/read";
import { getSetting, KEYS } from "@/lib/settings";
import { pendingCount } from "@/lib/coach/store";

export const dynamic = "force-dynamic";

const SHORTCUT_STEPS = [
  "Find Sleep Samples today → Calculate Statistics → Sum of Duration",
  "Find Resting Heart Rate, HRV, Steps and Body Mass — today, limit 1 each",
  "Find Workouts where Start Date is today",
  "Text — paste the body below, dragging each magic variable in",
  "Get Contents of URL — POST, Request Body: File, header Authorization: Bearer YOUR-KEY",
  "Automation tab → Time of Day 7:00 AM → Run Immediately",
];

function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export default async function WatchPage() {
  const [stored, sync, pending] = await Promise.all([
    getSetting(KEYS.ingestToken),
    lastSync(),
    pendingCount(),
  ]);

  const envKey = (process.env.HEALTH_INGEST_SECRET ?? "").trim().length > 0;
  const key = stored ?? (envKey ? "(set in the environment)" : null);
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://your-app.vercel.app";
  const endpoint = `${base}/api/health/ingest`;

  const sample = `{
  "device": "iPhone",
  "date": "${todayISO()}",
  "asleepMin": 421,
  "restingHr": 52,
  "hrvMs": 68,
  "steps": 8240,
  "activeKcal": 610,
  "weightLb": 176.4,
  "waistIn": 33.5,
  "workouts": [
    {
      "activityType": "running",
      "startAt": "${todayISO()}T12:05:00Z",
      "endAt": "${todayISO()}T12:47:00Z",
      "durationSec": 2520,
      "distanceMi": 3.4,
      "avgHr": 148,
      "maxHr": 168,
      "activeKcal": 410
    }
  ]
}`;

  return (
    <>
      <Shell>
        <AppBar title="Apple Health" subtitle="Watch sync" back="/settings" pending={pending} />

        <section className="block block--tight">
          <div className={sync ? "card card--good" : "card"}>
            <div className="row">
              <span className={`row__lead${sync ? " row__lead--good" : " row__lead--accent"}`}>
                <Icon name="watch" size={18} />
              </span>
              <div className="row__body">
                <span className="row__title">{sync ? "Syncing" : "Not connected"}</span>
                <span className="row__sub">
                  {sync
                    ? `Last ${relativeTime(sync.at)}${sync.device ? ` from ${sync.device}` : ""}`
                    : "Two steps, once, forever"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Manual entry sits first: it is what you actually reach for at 7am. */}
        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Log this morning</h2>
            <span className="label">By hand</span>
          </div>
          <div className="card">
            <form action={saveHealthEntry} className="stack">
              <input type="hidden" name="date" value={todayISO()} />
              <div className="grid3">
                <label className="field">
                  <span className="field__label">Slept hr</span>
                  <input
                    name="sleepHours"
                    type="number"
                    step="any"
                    min="0"
                    max="16"
                    inputMode="decimal"
                  />
                </label>
                <label className="field">
                  <span className="field__label">Rest HR</span>
                  <input name="restingHr" type="number" min="30" max="120" inputMode="numeric" />
                </label>
                <label className="field">
                  <span className="field__label">HRV ms</span>
                  <input name="hrvMs" type="number" min="5" max="250" inputMode="numeric" />
                </label>
              </div>
              <button className="btn btn--primary btn--block" type="submit">
                Save
              </button>
            </form>
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Step 1 · Sync key</h2>
          </div>
          <div className="card stack">
            {key ? <pre>{key}</pre> : <p className="small muted">No key yet.</p>}
            <form action={rotateIngestToken}>
              <button className="btn btn--ghost btn--sm" type="submit">
                {stored ? "Rotate key" : "Generate key"}
              </button>
            </form>
            {envKey ? (
              <p className="small muted">
                A key is also set through <code>HEALTH_INGEST_SECRET</code>. Both work.
              </p>
            ) : null}
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Step 2 · The Shortcut</h2>
            <span className="label">Six actions</span>
          </div>
          <div className="card">
            <p className="small sub">
              Apple Health has no web API, so an iPhone Shortcut carries the data across. No Xcode,
              no seven-day expiry.
            </p>

            <hr className="card__divide" />

            <div className="rows">
              {SHORTCUT_STEPS.map((step, index) => (
                <div className="row" key={step}>
                  <span className="row__lead">
                    <span className="strong">{index + 1}</span>
                  </span>
                  <span className="row__body">
                    <span className="row__sub row__sub--wrap" style={{ color: "var(--ink)" }}>
                      {step}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <hr className="card__divide" />

            <p className="field__label">Endpoint</p>
            <pre>{endpoint}</pre>

            <details className="fold" style={{ marginTop: "0.75rem" }}>
              <summary>Request body and test command</summary>
              <div className="fold__body">
                <pre>{sample}</pre>
                <p className="small muted" style={{ marginTop: "0.5rem" }}>
                  Every field is optional except the date. <code>weightLb</code> or{" "}
                  <code>weightKg</code>, <code>waistIn</code> or <code>waistCm</code> — both work.
                  Posting the same day twice updates it.
                </p>
                <pre style={{ marginTop: "0.5rem" }}>{`curl -X POST ${endpoint} \\
  -H "Authorization: Bearer YOUR-KEY" \\
  -H "content-type: application/json" \\
  -d '{"date":"${todayISO()}","asleepMin":430,"restingHr":54}'`}</pre>
              </div>
            </details>
          </div>
        </section>

        <p className="fineprint">
          Health data stays in your own database. It is sent nowhere except, if you enable the coach,
          to OpenAI as a fourteen-day summary — <Link href="/settings">switch that off</Link> and the
          guardrails keep working.
        </p>
      </Shell>
      <Nav pending={pending} />
    </>
  );
}

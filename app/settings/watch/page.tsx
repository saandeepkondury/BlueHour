import Link from "next/link";
import { rotateIngestToken, saveHealthEntry } from "@/app/actions";
import { Nav } from "@/components/Nav";
import { todayISO } from "@/lib/date";
import { lastSync } from "@/lib/health/read";
import { getSetting, KEYS } from "@/lib/settings";
import { pendingCount } from "@/lib/coach/store";

export const dynamic = "force-dynamic";

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
      <main className="shell">
        <section className="sec">
          <p className="sec-label">Apple Watch</p>
          <h1 className="sec-title">
            Your Watch, talking to <em>Blue Hour</em>
          </h1>
          <p className="sec-intro">
            Apple Health has no web API, so nothing on the open web can read your Watch directly.
            The free way across is a Shortcut on your iPhone: it reads Health, posts the numbers
            here, and runs itself every morning. No Xcode, no developer account, no seven-day
            expiry.
          </p>

          <article className="plaque">
            <p className="plaque-kicker">What lands here</p>
            <p className="plaque-note">
              Sleep, resting heart rate, HRV, steps, active calories, weight, and every run — with
              distance, duration, and heart rate. An imported run closes out that day&apos;s planned
              session on its own, so the only thing left to do is eat and sleep.
            </p>
            {sync ? (
              <p className="plaque-tip">
                Last sync {relativeTime(sync.at)}
                {sync.device ? ` from ${sync.device}` : ""}.
              </p>
            ) : (
              <p className="plaque-tip">Nothing has synced yet.</p>
            )}
          </article>
        </section>

        <section className="sec">
          <p className="sec-label">Step one</p>
          <h2 className="sec-title">
            Mint a <em>sync key</em>
          </h2>
          <p className="sec-intro">
            The endpoint refuses anything without this key, so health data cannot be posted or read
            by anyone else. Rotating it invalidates the old one immediately.
          </p>
          <article className="plaque">
            {key ? (
              <>
                <p className="field-label">Key</p>
                <pre>{key}</pre>
              </>
            ) : (
              <p className="plaque-note">No key yet.</p>
            )}
            <form action={rotateIngestToken} className="btn-row">
              <button className="btn" type="submit">
                {stored ? "Rotate key" : "Generate key"}
              </button>
            </form>
            {envKey ? (
              <p className="plaque-tip">
                A key is also set through <code>HEALTH_INGEST_SECRET</code>. Both work.
              </p>
            ) : null}
          </article>
        </section>

        <section className="sec">
          <p className="sec-label">Step two</p>
          <h2 className="sec-title">
            Build the <em>Shortcut</em>
          </h2>
          <p className="sec-intro">
            On your iPhone, open Shortcuts and make a new one. Six actions, once, forever.
          </p>
          <article className="plaque">
            <ol className="recipe-lines">
              <li>
                <strong>Find Sleep Samples</strong> — where Start Date is today, sort by Start Date.
                Then <strong>Calculate Statistics</strong> → Sum of Duration.
              </li>
              <li>
                <strong>Find Resting Heart Rate Samples</strong> — today, limit 1, and the same for{" "}
                <strong>Heart Rate Variability</strong>, <strong>Steps</strong>, and{" "}
                <strong>Body Mass</strong>.
              </li>
              <li>
                <strong>Find Workouts</strong> — where Start Date is today.
              </li>
              <li>
                <strong>Text</strong> — paste the body below, dragging each magic variable into
                place.
              </li>
              <li>
                <strong>Get Contents of URL</strong> — POST to the endpoint, Request Body: File, and
                the Text action as the file. Add a header <code>Authorization</code> with value{" "}
                <code>Bearer YOUR-KEY</code>.
              </li>
              <li>
                <strong>Automation</strong> tab → new Personal Automation → Time of Day, 7:00 AM,
                Run Immediately. Point it at this Shortcut.
              </li>
            </ol>

            <p className="field-label" style={{ marginTop: "1.2rem" }}>
              Endpoint
            </p>
            <pre>{endpoint}</pre>

            <p className="field-label" style={{ marginTop: "1rem" }}>
              Request body
            </p>
            <pre>{sample}</pre>

            <p className="plaque-tip">
              Every field is optional except the date — send what Health gives you and leave the
              rest out. Imperial or metric both work: <code>weightLb</code> or{" "}
              <code>weightKg</code>, <code>waistIn</code> or <code>waistCm</code>. Posting the same
              day twice just updates it.
            </p>
          </article>
        </section>

        <section className="sec">
          <p className="sec-label">Test it</p>
          <article className="plaque plaque--flat">
            <p className="plaque-note">
              From this Mac, with the app running, a single line proves the whole path works:
            </p>
            <pre>{`curl -X POST ${endpoint} \\
  -H "Authorization: Bearer YOUR-KEY" \\
  -H "content-type: application/json" \\
  -d '{"date":"${todayISO()}","asleepMin":430,"restingHr":54}'`}</pre>
            <p className="plaque-tip">
              A <code>200</code> with <code>daysWritten</code> means Today already knows. Then check{" "}
              <Link href="/">the Today screen</Link>.
            </p>
          </article>
        </section>

        <section className="sec">
          <p className="sec-label">By hand</p>
          <h2 className="sec-title">
            When the sync did not <em>run</em>
          </h2>
          <article className="plaque">
            <form action={saveHealthEntry}>
              <input type="hidden" name="date" value={todayISO()} />
              <div className="field-row">
                <label className="field">
                  <span className="field-label">Slept (hours)</span>
                  <input name="sleepHours" type="number" step="any" min="0" max="16" inputMode="decimal" />
                </label>
                <label className="field">
                  <span className="field-label">Resting HR</span>
                  <input name="restingHr" type="number" min="30" max="120" inputMode="numeric" />
                </label>
                <label className="field">
                  <span className="field-label">HRV (ms)</span>
                  <input name="hrvMs" type="number" min="5" max="250" inputMode="numeric" />
                </label>
              </div>
              <button className="btn" type="submit">
                Save this morning
              </button>
            </form>
          </article>
        </section>

        <p className="disclaimer">
          Health data stays in your own database and is sent nowhere except, if you enable the coach,
          to OpenAI as a summary of the last fourteen days. You can turn that off in{" "}
          <Link href="/settings">Settings</Link> and the guardrails keep working.
        </p>
      </main>
      <Nav pending={pending} />
    </>
  );
}

import Link from "next/link";
import { saveCoachSettings, saveGoals, saveProfile, sendTestBrief } from "@/app/actions";
import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { PushToggle } from "@/components/PushToggle";
import { Shell } from "@/components/Shell";
import { pendingCount } from "@/lib/coach/store";
import { todayISO } from "@/lib/date";
import { cmToIn, hourLabel, kgToLb } from "@/lib/format";
import { buildBrief } from "@/lib/notify/brief";
import { getProfile } from "@/lib/store";
import { openaiConfig } from "@/lib/settings";
import { targetBodyFatFor } from "@/lib/strength/abs";

export const dynamic = "force-dynamic";

const LONG_RUN_DAYS = [
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

const GOALS = [
  { value: "finish", label: "Finish strong" },
  { value: "sub2", label: "Sub 2:00" },
  { value: "sub145", label: "Sub 1:45" },
  { value: "sub130", label: "Sub 1:30" },
];

const DIETS = [
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
];

export default async function SettingsPage() {
  const profile = await getProfile();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const [coach, pending, brief] = await Promise.all([
    openaiConfig(),
    pendingCount(),
    buildBrief(todayISO(), appUrl),
  ]);
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <>
      <Shell>
        <AppBar title="Settings" back="/more" pending={pending} />

        <form action={saveProfile}>
          <section className="block block--tight">
            <div className="block__head">
              <h2 className="block__title">The race</h2>
            </div>
            <div className="card stack">
              <label className="field">
                <span className="field__label">Race</span>
                <input name="raceName" defaultValue={profile.raceName} />
              </label>
              <div className="grid2">
                <label className="field">
                  <span className="field__label">Race date</span>
                  <input name="raceDate" type="date" defaultValue={profile.raceDate} />
                </label>
                <label className="field">
                  <span className="field__label">Started</span>
                  <input name="startDate" type="date" defaultValue={profile.startDate} />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span className="field__label">Long run day</span>
                  <select name="longRunDay" defaultValue={String(profile.longRunDay)}>
                    {LONG_RUN_DAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Goal</span>
                  <select name="goal" defaultValue={profile.goal}>
                    {GOALS.map((goal) => (
                      <option key={goal.value} value={goal.value}>
                        {goal.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="small muted">
                Changing the date or long-run day rebuilds the plan from today forward. Anything
                already logged stays.
              </p>
            </div>
          </section>

          <section className="block">
            <div className="block__head">
              <h2 className="block__title">You</h2>
              <span className="label">Drives calorie targets</span>
            </div>
            <div className="card stack">
              <div className="grid2">
                <label className="field">
                  <span className="field__label">Height in</span>
                  <input
                    name="heightIn"
                    type="number"
                    min="40"
                    max="90"
                    inputMode="numeric"
                    defaultValue={cmToIn(profile.heightCm) ?? ""}
                    placeholder="70"
                  />
                </label>
                <label className="field">
                  <span className="field__label">Weight lb</span>
                  <input
                    name="weightLb"
                    type="number"
                    min="70"
                    max="500"
                    inputMode="numeric"
                    defaultValue={kgToLb(profile.weightKg) ?? ""}
                    placeholder="170"
                  />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span className="field__label">Age</span>
                  <input
                    name="age"
                    type="number"
                    min="14"
                    max="99"
                    inputMode="numeric"
                    defaultValue={profile.age ?? ""}
                    placeholder="32"
                  />
                </label>
                <label className="field">
                  <span className="field__label">Sex</span>
                  <select name="sex" defaultValue={profile.sex ?? "unspecified"}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="unspecified">Rather not say</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className="block">
            <div className="block__head">
              <h2 className="block__title">Eating</h2>
            </div>
            <div className="card stack">
              <label className="field">
                <span className="field__label">Diet</span>
                <select name="dietPref" defaultValue={profile.dietPref}>
                  {DIETS.map((diet) => (
                    <option key={diet.value} value={diet.value}>
                      {diet.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Avoid</span>
                <input
                  name="allergies"
                  defaultValue={profile.allergies}
                  placeholder="dairy, nuts, shellfish"
                />
              </label>
              <p className="small muted">
                Recognized: dairy, gluten, nuts, egg, soy, fish, shellfish.
              </p>
            </div>
          </section>

          <section className="block">
            <div className="block__head">
              <h2 className="block__title">Morning reminder</h2>
            </div>
            <div className="card">
              <div className="grid2">
                <label className="field">
                  <span className="field__label">Hour</span>
                  <select name="reminderHour" defaultValue={String(profile.reminderHour)}>
                    {Array.from({ length: 24 }, (_, hour) => (
                      <option key={hour} value={hour}>
                        {hourLabel(hour)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Send</span>
                  <select
                    name="remindersEnabled"
                    defaultValue={profile.remindersEnabled ? "1" : "0"}
                  >
                    <option value="1">Every morning</option>
                    <option value="0">Paused</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <div style={{ paddingTop: "1rem" }}>
            <button className="btn btn--primary btn--block" type="submit">
              Save
            </button>
          </div>
        </form>

        <form action={saveGoals}>
          <section className="block">
            <div className="block__head">
              <h2 className="block__title">Abs &amp; lifting</h2>
              <Link className="block__link" href="/core">
                See the math
              </Link>
            </div>
            <div className="card stack">
              <label className="field">
                <span className="field__label">Chase visible abs</span>
                <select name="absGoal" defaultValue={profile.absGoal ? "1" : "0"}>
                  <option value="1">Yes, alongside the race</option>
                  <option value="0">No, performance only</option>
                </select>
              </label>
              <div className="grid2">
                <label className="field">
                  <span className="field__label">Body-fat target %</span>
                  <input
                    name="targetBodyFatPct"
                    type="number"
                    step="any"
                    min="8"
                    max="30"
                    inputMode="decimal"
                    defaultValue={profile.targetBodyFatPct ?? ""}
                    placeholder={String(targetBodyFatFor(profile))}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Lifting days</span>
                  <select name="strengthDays" defaultValue={String(profile.strengthDays)}>
                    <option value="0">None</option>
                    <option value="1">One</option>
                    <option value="2">Two</option>
                    <option value="3">Three</option>
                  </select>
                </label>
              </div>
              <label className="field">
                <span className="field__label">Let the model read my data</span>
                <select name="aiEnabled" defaultValue={profile.aiEnabled ? "1" : "0"}>
                  <option value="1">Yes, once a day from my logs</option>
                  <option value="0">No, guardrails only</option>
                </select>
              </label>
              <details className="fold">
                <summary>How this works</summary>
                <div className="fold__body">
                  <p className="small sub">
                    A deficit is periodized around training — real in base and build, almost nothing
                    at peak, none in the taper — and the protein floor rises so what you lose is fat.
                    Core circuits stay on the calendar either way. The model reads your day once,
                    conservatively: what you completed versus skipped, meals you actually eat,
                    sleep, and past yes/no decisions. It never auto-applies. With it off, built-in
                    rules still watch sleep, resting heart rate, missed runs and protein, and nothing
                    leaves your database.
                  </p>
                </div>
              </details>
              <button className="btn btn--primary btn--block" type="submit">
                Save goals
              </button>
            </div>
          </section>
        </form>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Notifications</h2>
          </div>
          <div className="card stack">
            <PushToggle vapidKey={vapidKey} />
            <p className="small muted">
              On the iPhone app, morning briefs and water pings (every two hours, 8am–10pm Austin)
              are native local notifications — turn them on when iOS asks, then use{" "}
              <strong>Send a test notification</strong> in the app&apos;s gear sheet. Web push below
              is only for the home-screen PWA. Pause morning reminders above to stop both.
            </p>
            <hr className="card__divide" />
            {brief ? (
              <details className="fold">
                <summary>Preview the morning brief</summary>
                <div className="fold__body">
                  <p className="row__title">{brief.subject}</p>
                  <p className="small sub" style={{ whiteSpace: "pre-line", marginTop: "0.35rem" }}>
                    {brief.text}
                  </p>
                </div>
              </details>
            ) : (
              <p className="small muted">
                Nothing scheduled today, so there is no brief to preview.
              </p>
            )}
            <form action={sendTestBrief}>
              <button className="btn btn--quiet btn--sm" type="submit">
                <Icon name="bell" size={15} />
                Send a test
              </button>
            </form>
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Connections</h2>
          </div>
          <div className="card" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <div className="rows">
              <Link className="row" href="/settings/watch">
                <span className="row__lead">
                  <Icon name="watch" size={17} />
                </span>
                <span className="row__body">
                  <span className="row__title">Apple Health sync</span>
                  <span className="row__sub">Sleep, HRV, heart rate, runs</span>
                </span>
                <Icon name="chevron" size={16} />
              </Link>
            </div>
          </div>
        </section>

        <form action={saveCoachSettings}>
          <section className="block">
            <div className="block__head">
              <h2 className="block__title">OpenAI key</h2>
              <span className="label">
                {coach.fromEnv ? "From env" : coach.key ? "Stored" : "None"}
              </span>
            </div>
            <div className="card stack">
              <label className="field">
                <span className="field__label">Key</span>
                <input
                  name="openaiKey"
                  type="password"
                  autoComplete="off"
                  placeholder={
                    coach.fromEnv
                      ? "Set in the environment — leave blank"
                      : coach.key
                        ? "Stored. Paste a new one to replace it."
                        : "sk-..."
                  }
                />
              </label>
              <div className="grid2">
                <label className="field">
                  <span className="field__label">Model</span>
                  <input name="openaiModel" defaultValue={coach.model} placeholder="gpt-4.1-mini" />
                </label>
                <label className="field">
                  <span className="field__label">Stored key</span>
                  <select name="clearKey" defaultValue="0">
                    <option value="0">Keep it</option>
                    <option value="1">Delete it</option>
                  </select>
                </label>
              </div>
              <p className="small muted">
                Once a day the model sees a fourteen-day summary: planned versus completed running,
                rest, sleep, heart rate, meals eaten or ignored, grocery checks, strength, body-fat
                trend, and which suggestions you already decided. No names, no email, no chat
                prompt.
              </p>
              <button className="btn btn--ghost btn--block" type="submit">
                Save coach settings
              </button>
            </div>
          </section>
        </form>

        <p className="fineprint">
          General information for a healthy adult, not medical advice. Sharp pain, dizziness, or
          anything that lingers is a doctor conversation.
        </p>
      </Shell>
      <Nav pending={pending} />
    </>
  );
}

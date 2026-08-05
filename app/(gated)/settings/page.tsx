import Link from "next/link";
import { saveCoachSettings, saveGoals, saveProfile, sendTestBrief } from "@/app/actions";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { PushToggle } from "@/components/PushToggle";
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
  { value: "finish", label: "Finish strong and healthy" },
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
    <Shell>
      <section className="sec">
        <p className="sec-label">Settings</p>
        <h2 className="sec-title">
          Make it <em>yours</em>
        </h2>
        <p className="sec-intro">
          Body stats drive your calorie and protein targets. Changing the race date or long-run day
          rebuilds the plan from today forward, keeping everything you have already logged.
        </p>
      </section>

      <form action={saveProfile}>
        <fieldset>
          <legend>The race</legend>
          <label className="field">
            <span className="field-label">Race</span>
            <input name="raceName" defaultValue={profile.raceName} />
          </label>
          <div className="field-row">
            <label className="field">
              <span className="field-label">Race date</span>
              <input name="raceDate" type="date" defaultValue={profile.raceDate} />
            </label>
            <label className="field">
              <span className="field-label">Training started</span>
              <input name="startDate" type="date" defaultValue={profile.startDate} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span className="field-label">Long run day</span>
              <select name="longRunDay" defaultValue={String(profile.longRunDay)}>
                {LONG_RUN_DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Goal</span>
              <select name="goal" defaultValue={profile.goal}>
                {GOALS.map((goal) => (
                  <option key={goal.value} value={goal.value}>
                    {goal.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="field-hint">
            The plan stays effort-based until you have a real base. Pick a time goal later and the
            sessions can sharpen.
          </p>
        </fieldset>

        <fieldset>
          <legend>You</legend>
          <div className="field-row">
            <label className="field">
              <span className="field-label">Height (in)</span>
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
              <span className="field-label">Weight (lb)</span>
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
            <label className="field">
              <span className="field-label">Age</span>
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
              <span className="field-label">Sex</span>
              <select name="sex" defaultValue={profile.sex ?? "unspecified"}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="unspecified">Rather not say</option>
              </select>
            </label>
          </div>
          <p className="field-hint">
            Used only to estimate energy needs. Rough numbers are fine — you can refine them anytime.
          </p>
        </fieldset>

        <fieldset>
          <legend>Eating</legend>
          <label className="field">
            <span className="field-label">Diet</span>
            <select name="dietPref" defaultValue={profile.dietPref}>
              {DIETS.map((diet) => (
                <option key={diet.value} value={diet.value}>
                  {diet.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Avoid</span>
            <input
              name="allergies"
              defaultValue={profile.allergies}
              placeholder="dairy, nuts, shellfish"
            />
          </label>
          <p className="field-hint">
            Recognized: dairy, gluten, nuts, egg, soy, fish, shellfish. Anything listed is filtered
            out of meal plans.
          </p>
        </fieldset>

        <fieldset>
          <legend>Daily notification</legend>
          <label className="field">
            <span className="field-label">Hour (Austin time)</span>
            <select name="reminderHour" defaultValue={String(profile.reminderHour)}>
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Send reminders</span>
            <select name="remindersEnabled" defaultValue={profile.remindersEnabled ? "1" : "0"}>
              <option value="1">Yes, every morning</option>
              <option value="0">Pause them</option>
            </select>
          </label>
          <p className="field-hint">
            A push notification on this device — not email. Turn push on below, and on iPhone add
            Blue Hour to the home screen first.
          </p>
        </fieldset>

        <button className="btn btn--full" type="submit">
          Save
        </button>
      </form>

      <section className="sec">
        <p className="sec-label">Second goal</p>
        <h2 className="sec-title">
          Strength and <em>visible abs</em>
        </h2>
        <p className="sec-intro">
          Turning this on periodizes a calorie deficit around your training — real in base and build
          weeks, almost nothing at peak, none in the taper — and raises the protein floor so what you
          lose is fat. The <Link href="/core">Core screen</Link> shows the math.
        </p>
        <form action={saveGoals}>
          <fieldset>
            <legend>Abs &amp; lifting</legend>
            <label className="field">
              <span className="field-label">Chase visible abs</span>
              <select name="absGoal" defaultValue={profile.absGoal ? "1" : "0"}>
                <option value="1">Yes, alongside the race</option>
                <option value="0">No, eat for performance only</option>
              </select>
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field-label">Body-fat target %</span>
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
                <span className="field-label">Lifting days a week</span>
                <select name="strengthDays" defaultValue={String(profile.strengthDays)}>
                  <option value="0">None</option>
                  <option value="1">One</option>
                  <option value="2">Two</option>
                  <option value="3">Three</option>
                </select>
              </label>
            </div>
            <p className="field-hint">
              Core circuits stay on the calendar regardless. Lifting is scheduled two clear days
              after the long run, never the day before it. Changing this rebuilds the strength
              schedule from today forward.
            </p>
          </fieldset>

          <fieldset>
            <legend>Coach</legend>
            <label className="field">
              <span className="field-label">Let the model read my data</span>
              <select name="aiEnabled" defaultValue={profile.aiEnabled ? "1" : "0"}>
                <option value="1">Yes, when I ask</option>
                <option value="0">No, guardrails only</option>
              </select>
            </label>
            <p className="field-hint">
              With this off, the built-in rules still watch sleep, resting heart rate, missed runs,
              and protein — nothing leaves your database.
            </p>
          </fieldset>

          <button className="btn btn--full" type="submit">
            Save goals
          </button>
        </form>
      </section>

      <section className="sec">
        <p className="sec-label">OpenAI</p>
        <form action={saveCoachSettings}>
          <fieldset>
            <legend>API key</legend>
            <label className="field">
              <span className="field-label">Key</span>
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
            <label className="field">
              <span className="field-label">Model</span>
              <input name="openaiModel" defaultValue={coach.model} placeholder="gpt-4.1-mini" />
            </label>
            <p className="field-hint">
              A summary of the last fourteen days is sent when you ask for advice: planned versus
              actual running, sleep, heart rate, nutrition totals, strength, and the body-fat trend.
              No names, no email. Clearing the field below removes the stored key.
            </p>
            <label className="field">
              <span className="field-label">Remove the stored key</span>
              <select name="clearKey" defaultValue="0">
                <option value="0">Keep it</option>
                <option value="1">Delete it</option>
              </select>
            </label>
          </fieldset>
          <button className="btn btn--full" type="submit">
            Save coach settings
          </button>
        </form>
      </section>

      <section className="sec">
        <p className="sec-label">Apple Watch</p>
        <article className="plaque plaque--flat">
          <p className="plaque-note">
            Sleep, heart rate, HRV, and workouts come in through one iPhone Shortcut — free, and
            without Xcode.
          </p>
          <div className="btn-row">
            <Link className="btn btn--ghost btn--small" href="/settings/watch">
              Set up the sync
            </Link>
          </div>
        </article>
      </section>

      <section className="sec">
        <p className="sec-label">The morning brief</p>
        <article className="plaque plaque--flat">
          {brief ? (
            <>
              <p className="plaque-kicker">{brief.subject}</p>
              <p className="plaque-note" style={{ whiteSpace: "pre-line" }}>
                {brief.text}
              </p>
            </>
          ) : (
            <p className="plaque-note">Nothing is scheduled today, so there is no brief to preview.</p>
          )}
          <form action={sendTestBrief}>
            <button className="btn btn--ghost btn--small" type="submit">
              Send a test notification
            </button>
          </form>
          <p className="tiny muted">Sends today&apos;s brief as a push on devices that have opted in.</p>
        </article>
      </section>

      <section className="sec">
        <p className="sec-label">Push notifications</p>
        <article className="plaque">
          <p className="plaque-note">
            This is how the daily reminder arrives. Enable it on each phone or laptop you want to
            hear from in the morning.
          </p>
          <div style={{ marginTop: "1rem" }}>
            <PushToggle vapidKey={vapidKey} />
          </div>
        </article>
      </section>

      <p className="disclaimer">
        Training and fueling guidance here is general information for a healthy adult, not medical
        advice. Sharp pain, dizziness, or anything that lingers is a doctor conversation, not a
        push-through.
      </p>

      <Nav pending={pending} />
    </Shell>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { finishOnboarding } from "@/app/actions";
import { BrandLockup } from "@/components/Brand";
import { sessionUserId } from "@/lib/auth/session";
import { daysBetween, todayISO } from "@/lib/date";
import { getProfile, isOnboarded, parseExperience, suggestedRaceDate } from "@/lib/store";

export const metadata = { title: "Set up · Blue Hour" };
export const dynamic = "force-dynamic";

const EXPERIENCES = [
  {
    value: "beginner",
    label: "Beginner",
    hint: "Walk/run openers, then continuous miles",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    hint: "Comfortable with easy continuous runs",
  },
  {
    value: "advanced",
    label: "Advanced",
    hint: "Ready for full volume from week one",
  },
] as const;

const GOALS = [
  { value: "finish", label: "Finish strong" },
  { value: "sub2", label: "Sub 2:00" },
  { value: "sub145", label: "Sub 1:45" },
  { value: "sub130", label: "Sub 1:30" },
] as const;

const LONG_RUN_DAYS = [
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
] as const;

export default async function OnboardPage() {
  if (!(await sessionUserId())) redirect("/signin");

  const current = await getProfile();
  if (isOnboarded(current)) redirect("/");

  const raceDate = current.raceDate || suggestedRaceDate();
  const weeks =
    Math.max(1, Math.round(daysBetween(todayISO(), raceDate) / 7)) || 28;
  const experience = parseExperience(current.experience);

  return (
    <main className="unlock unlock--onboard">
      <BrandLockup />
      <div className="unlock__lede stack" style={{ gap: "0.35rem" }}>
        <p className="small muted">Before the block opens</p>
        <p className="card__title" style={{ margin: 0 }}>
          Set the race. We build the weeks from there.
        </p>
      </div>

      <form action={finishOnboarding} className="onboard-form">
        <section className="onboard-section stack">
          <label className="field">
            <span className="field__label">Race</span>
            <input
              name="raceName"
              defaultValue={current.raceName}
              placeholder="Which half marathon?"
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Race date</span>
            <input name="raceDate" type="date" defaultValue={raceDate} required />
          </label>
          <p className="small muted" style={{ margin: 0, textAlign: "left" }}>
            About {weeks} weeks from today back to the start line. Logged days stay if you change this later.
          </p>
        </section>

        <section className="onboard-section stack">
          <p className="field__label" style={{ textAlign: "left" }}>
            Experience
          </p>
          <div className="chiprow chiprow--wrap">
            {EXPERIENCES.map((option) => (
              <label className="chip" key={option.value} title={option.hint}>
                <input
                  type="radio"
                  name="experience"
                  value={option.value}
                  defaultChecked={option.value === experience}
                />
                {option.label}
              </label>
            ))}
          </div>
          <p className="small muted" style={{ margin: 0, textAlign: "left" }}>
            Beginners open with walk/run. Advanced starts on continuous easy miles.
          </p>
        </section>

        <section className="onboard-section stack">
          <div className="grid2">
            <label className="field">
              <span className="field__label">Goal</span>
              <select name="goal" defaultValue={current.goal || "finish"}>
                {GOALS.map((goal) => (
                  <option key={goal.value} value={goal.value}>
                    {goal.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Long run</span>
              <select name="longRunDay" defaultValue={String(current.longRunDay ?? 6)}>
                {LONG_RUN_DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <button className="btn btn--primary btn--block" type="submit">
          Build my {weeks}-week plan
        </button>
      </form>

      <p className="small muted" style={{ margin: 0 }}>
        <Link href="/account">Account and sign out</Link>
      </p>
    </main>
  );
}

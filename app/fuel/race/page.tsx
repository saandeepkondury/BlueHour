import { daysBetween, formatLong, todayISO } from "@/lib/date";
import { RACE_PLAYBOOK } from "@/lib/nutrition/supplements";
import { getProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function RaceNutritionPage() {
  const profile = await getProfile();
  const days = daysBetween(todayISO(), profile.raceDate);

  return (
    <>
      <section className="sec" style={{ paddingTop: 0 }}>
        <p className="sec-intro">
          {days > 0
            ? `${days} days out. Read this now, practice it on your long runs, and it will feel automatic on ${formatLong(profile.raceDate)}.`
            : `Race day: ${formatLong(profile.raceDate)}.`}
        </p>
      </section>

      {RACE_PLAYBOOK.map((step, index) => (
        <article className="plaque plaque--tilt" key={step.title}>
          <p className="plaque-kicker">
            {String(index + 1).padStart(2, "0")} · {step.when}
          </p>
          <h3 className="plaque-title" style={{ fontSize: "1.35rem" }}>
            {step.title}
          </h3>
          <p className="plaque-note">{step.detail}</p>
        </article>
      ))}

      <article className="plaque plaque--quiet" style={{ marginTop: "2rem" }}>
        <p className="plaque-kicker">The one rule</p>
        <p className="plaque-note">
          Nothing new on race day. Not the shoes, not the breakfast, not the gel flavor, not the
          caffeine. Everything gets tested on a long run first.
        </p>
      </article>
    </>
  );
}

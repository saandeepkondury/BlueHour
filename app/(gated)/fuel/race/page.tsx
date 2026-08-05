import { Icon } from "@/components/Icon";
import { daysBetween, formatShort, todayISO } from "@/lib/date";
import { RACE_PLAYBOOK } from "@/lib/nutrition/supplements";
import { getProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function RaceNutritionPage() {
  const profile = await getProfile();
  const days = daysBetween(todayISO(), profile.raceDate);

  return (
    <>
      <section className="block block--tight">
        <div className="card">
          <div className="row-between">
            <div>
              <p className="label">
                <Icon name="flag" size={13} />
                Race day
              </p>
              <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                {days > 0 ? days : 0}
                <small>{days === 1 ? "day out" : "days out"}</small>
              </p>
            </div>
            <span className="pill pill--accent">{formatShort(profile.raceDate)}</span>
          </div>
          <p className="card__sub" style={{ marginTop: "0.5rem" }}>
            Nothing new on race day. Practice every step of this on a long run first.
          </p>
        </div>
      </section>

      <section className="block block--tight">
        <div className="stack">
          {RACE_PLAYBOOK.map((step, index) => (
            <div className="card" key={step.title}>
              <div className="row">
                <span className="row__lead row__lead--accent">
                  <span className="strong">{index + 1}</span>
                </span>
                <div className="row__body">
                  <span className="row__title">{step.title}</span>
                  <span className="row__sub">{step.when}</span>
                </div>
              </div>
              <details className="fold">
                <summary>How</summary>
                <div className="fold__body">
                  <p className="small sub">{step.detail}</p>
                </div>
              </details>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

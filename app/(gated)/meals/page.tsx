import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatShort, todayISO, weekdayShort } from "@/lib/date";
import { pendingCount } from "@/lib/habits/store";
import { getMealHistory } from "@/lib/meals/store";

export const dynamic = "force-dynamic";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default async function MealsPage() {
  const today = todayISO();
  const [pending, history] = await Promise.all([pendingCount(), getMealHistory()]);

  const total = (pick: (row: (typeof history)[number]) => number) =>
    history.reduce((sum, row) => sum + pick(row), 0);
  const totalMeals = total((row) => row.meals);
  const home = total((row) => row.home);
  const healthy = total((row) => row.healthy);
  const cheat = total((row) => row.cheat);
  const starred = total((row) => row.starred);
  const homePct = totalMeals === 0 ? 0 : Math.round((home / totalMeals) * 100);

  return (
    <>
      <Shell>
        <AppBar title="Meals" back="/more" pending={pending} />

        <section className="block block--tight">
          <div className="stack">
            <div className="card">
              <p className="tile__label">
                <Icon name="camera" size={14} />
                Meals logged
              </p>
              <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                {totalMeals}
                <small>{totalMeals === 1 ? "meal" : "meals"}</small>
              </p>
              <p className="card__sub" style={{ marginTop: "0.35rem" }}>
                {history.length === 0 ? "Nothing logged yet" : `Across ${plural(history.length, "day")}`}
              </p>
            </div>

            {totalMeals > 0 ? (
              <div className="bento bento--3">
                <div className="tile">
                  <p className="tile__label">Home cooked</p>
                  <p className="tile__value">
                    {homePct}
                    <small>%</small>
                  </p>
                </div>
                <div className="tile">
                  <p className="tile__label">Healthy</p>
                  <p className="tile__value">
                    {healthy}
                    <small>/ {cheat} cheat</small>
                  </p>
                </div>
                <div className="tile">
                  <p className="tile__label">Starred</p>
                  <p className="tile__value">{starred}</p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">History</h2>
            <span className="label">Newest first</span>
          </div>
          <div className="card">
            {history.length === 0 ? (
              <div className="empty">
                <span className="empty__icon">
                  <Icon name="camera" size={20} />
                </span>
                <p className="small sub">Snap a photo of each meal on Fuel and every day shows up here.</p>
                <Link className="btn btn--ghost btn--sm" href="/fuel">
                  Open Fuel
                </Link>
              </div>
            ) : (
              <div className="rows">
                {history.map((row) => {
                  const href = row.date === today ? "/fuel" : `/fuel?d=${row.date}`;
                  const parts = [plural(row.meals, "meal")];
                  if (row.home > 0) parts.push(`${row.home} home`);
                  if (row.prepped > 0) parts.push(`${row.prepped} prepped`);
                  if (row.out > 0) parts.push(`${row.out} out`);
                  if (row.cheat > 0) parts.push(plural(row.cheat, "cheat"));
                  return (
                    <Link className="row" href={href} key={row.date}>
                      <span className="row__date">{weekdayShort(row.date)}</span>
                      <span className="row__body">
                        <span className="row__title">
                          {row.date === today ? "Today" : formatShort(row.date)}
                          {row.starred > 0 ? " ★" : ""}
                        </span>
                        <span className="row__sub">{parts.join(" · ")}</span>
                      </span>
                      {row.photos.length > 0 ? (
                        <span className="meal-strip" aria-hidden="true">
                          {row.photos.map((photo) => (
                            <img key={photo} src={photo} alt="" loading="lazy" />
                          ))}
                        </span>
                      ) : null}
                      <Icon name="chevron" size={14} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </Shell>
      <Nav pending={pending} />
    </>
  );
}

import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatShort, todayISO, weekdayShort } from "@/lib/date";
import { pendingCount } from "@/lib/coach/store";
import { getMealHistory } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function MealsPage() {
  const today = todayISO();
  const [pending, history] = await Promise.all([pendingCount(), getMealHistory()]);

  const totalMeals = history.reduce((sum, row) => sum + row.meals + row.extras, 0);
  const totalKcal = history.reduce((sum, row) => sum + row.calories, 0);
  const totalProtein = history.reduce((sum, row) => sum + row.protein, 0);

  return (
    <>
      <Shell>
        <AppBar title="Meals" back="/" pending={pending} />

        <section className="block block--tight">
          <div className="stack">
            <div className="card">
              <p className="tile__label">
                <Icon name="fuel" size={14} />
                Meals logged
              </p>
              <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                {totalMeals}
                <small>{totalMeals === 1 ? "meal" : "meals"}</small>
              </p>
              <p className="card__sub" style={{ marginTop: "0.35rem" }}>
                {history.length === 0
                  ? "Nothing logged yet"
                  : `${history.length} day${history.length === 1 ? "" : "s"}`}
              </p>
            </div>

            <div className="bento bento--3">
              <div className="tile">
                <p className="tile__label">Days</p>
                <p className="tile__value">{history.length}</p>
              </div>
              <div className="tile">
                <p className="tile__label">Calories</p>
                <p className="tile__value">
                  {history.length === 0 ? "—" : totalKcal}
                  {history.length > 0 ? <small>kcal</small> : null}
                </p>
              </div>
              <div className="tile">
                <p className="tile__label">Protein</p>
                <p className="tile__value">
                  {history.length === 0 ? "—" : totalProtein}
                  {history.length > 0 ? <small>g</small> : null}
                </p>
              </div>
            </div>
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
                  <Icon name="fuel" size={20} />
                </span>
                <p className="small sub">
                  Mark meals eaten on Today or log extras, and every day shows up here.
                </p>
                <Link className="btn btn--ghost btn--sm" href="/fuel">
                  Open Fuel
                </Link>
              </div>
            ) : (
              <div className="rows">
                {history.map((row) => {
                  const href = row.date === today ? "/" : `/day/${row.date}`;
                  const parts: string[] = [];
                  if (row.meals > 0) {
                    parts.push(`${row.meals} meal${row.meals === 1 ? "" : "s"}`);
                  }
                  if (row.extras > 0) {
                    parts.push(`${row.extras} extra${row.extras === 1 ? "" : "s"}`);
                  }
                  return (
                    <Link className="row" href={href} key={row.date}>
                      <span className="row__date">{weekdayShort(row.date)}</span>
                      <span className="row__lead row__lead--accent">
                        <Icon name="fuel" size={17} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">
                          {row.date === today ? "Today" : formatShort(row.date)}
                        </span>
                        <span className="row__sub">
                          {parts.join(" · ")} · {row.calories} kcal · {row.protein}g protein
                        </span>
                      </span>
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

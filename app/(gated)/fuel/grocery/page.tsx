import Link from "next/link";
import { clearGrocery, toggleGroceryItem } from "@/app/actions";
import { Check } from "@/components/Check";
import { Icon } from "@/components/Icon";
import { Ring } from "@/components/Ring";
import { addDays, formatRange, startOfWeek, todayISO } from "@/lib/date";
import { buildGroceryList, formatQty } from "@/lib/nutrition/grocery";
import { ensureWeekMeals, getGroceryChecks, weekRecipeIds } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function GroceryPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekStart =
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? startOfWeek(week) : startOfWeek(todayISO());

  await ensureWeekMeals(weekStart);
  const recipeIds = await weekRecipeIds(weekStart);
  const aisles = buildGroceryList(recipeIds);
  const checked = await getGroceryChecks(weekStart);

  const total = aisles.reduce((sum, aisle) => sum + aisle.items.length, 0);
  const done = aisles.reduce(
    (sum, aisle) => sum + aisle.items.filter((item) => checked.has(item.key)).length,
    0,
  );
  const pct = total > 0 ? (done / total) * 100 : 0;

  return (
    <>
      <section className="block block--tight">
        <div className="card">
          <div className="row-between">
            <div>
              <p className="label">{formatRange(weekStart, addDays(weekStart, 6))}</p>
              <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                {done}
                <small>/ {total} picked up</small>
              </p>
            </div>
            <Ring
              pct={pct}
              tone={pct >= 100 ? "good" : "accent"}
              size={64}
              thickness={6}
              value={`${Math.round(pct)}%`}
              label={`${done} of ${total} items`}
            />
          </div>
          <div className="btnrow btnrow--split" style={{ marginTop: "0.875rem" }}>
            <Link
              className="btn btn--ghost btn--sm"
              href={`/fuel/grocery?week=${addDays(weekStart, -7)}`}
            >
              <Icon name="back" size={15} />
              Last
            </Link>
            <Link
              className="btn btn--ghost btn--sm"
              href={`/fuel/grocery?week=${addDays(weekStart, 7)}`}
            >
              Next
              <Icon name="chevron" size={15} />
            </Link>
          </div>
        </div>
      </section>

      {total === 0 ? (
        <section className="block block--tight">
          <div className="card">
            <div className="empty">
              <span className="empty__icon">
                <Icon name="cart" size={20} />
              </span>
              <p className="card__title">Nothing to buy yet</p>
              <p className="small sub">Open the week and the list builds itself.</p>
              <Link className="btn btn--primary btn--sm" href="/fuel">
                Open the week
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="block block--tight">
        <div className="stack">
          {aisles.map((aisle) => (
            <div className="card" key={aisle.aisle}>
              <p className="label" style={{ marginBottom: "0.15rem" }}>
                {aisle.label}
              </p>
              <div className="rows">
                {aisle.items.map((item) => {
                  const isChecked = checked.has(item.key);
                  return (
                    <div className={isChecked ? "row row--done" : "row"} key={item.key}>
                      <Check
                        action={toggleGroceryItem}
                        on={isChecked}
                        flag="checked"
                        label={item.item}
                        fields={{ weekStart, itemKey: item.key }}
                      />
                      <div className="row__body">
                        <span className="row__title">{item.item}</span>
                      </div>
                      <span className="row__meta">{formatQty(item)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {done > 0 ? (
          <form action={clearGrocery} style={{ marginTop: "1rem" }}>
            <input type="hidden" name="weekStart" value={weekStart} />
            <button className="btn btn--quiet btn--sm btn--block" type="submit">
              Uncheck everything
            </button>
          </form>
        ) : null}
      </section>
    </>
  );
}

import Link from "next/link";
import { clearGrocery, toggleGroceryItem } from "@/app/actions";
import { CheckButton } from "@/components/CheckButton";
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

  return (
    <>
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="split">
          <p className="week-meta">{formatRange(weekStart, addDays(weekStart, 6))}</p>
          <div className="btn-row" style={{ marginTop: 0 }}>
            <Link
              className="btn btn--ghost btn--small"
              href={`/fuel/grocery?week=${addDays(weekStart, -7)}`}
            >
              ← Last
            </Link>
            <Link
              className="btn btn--ghost btn--small"
              href={`/fuel/grocery?week=${addDays(weekStart, 7)}`}
            >
              Next →
            </Link>
          </div>
        </div>
        <p className="sec-intro small" style={{ marginTop: "0.8rem" }}>
          {done} of {total} picked up. Everything here comes from the meals planned this week.
        </p>
      </section>

      <article className="plaque">
        {aisles.map((aisle) => (
          <div className="aisle" key={aisle.aisle}>
            <p className="aisle-name">{aisle.label}</p>
            <ul className="check-list">
              {aisle.items.map((item) => {
                const isChecked = checked.has(item.key);
                return (
                  <li
                    className={isChecked ? "check-item check-item--done" : "check-item"}
                    key={item.key}
                  >
                    <CheckButton
                      action={toggleGroceryItem}
                      checked={isChecked}
                      label={item.item}
                      fields={{
                        weekStart,
                        itemKey: item.key,
                        checked: isChecked ? "0" : "1",
                      }}
                    />
                    <div className="check-body">
                      <p className="check-name" style={{ fontSize: "1.05rem" }}>
                        {item.item}
                      </p>
                      <p className="check-macros">{formatQty(item)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {total === 0 ? (
          <p className="muted">No meals planned for this week yet. Open the week to build it.</p>
        ) : null}
      </article>

      {done > 0 ? (
        <form action={clearGrocery} style={{ marginTop: "1.5rem" }}>
          <input type="hidden" name="weekStart" value={weekStart} />
          <button className="btn btn--ghost btn--small" type="submit">
            Uncheck everything
          </button>
        </form>
      ) : null}
    </>
  );
}

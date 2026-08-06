import Link from "next/link";
import {
  clearGrocery,
  markGroceryBought,
  toggleGroceryItem,
  togglePantryItem,
} from "@/app/actions";
import { Icon } from "@/components/Icon";
import { Ring } from "@/components/Ring";
import { addDays, formatRange, startOfWeek, todayISO } from "@/lib/date";
import { buildGroceryListDetailed, formatQty } from "@/lib/nutrition/grocery";
import {
  ensureWeekMeals,
  getGroceryChecks,
  getPantryHaveKeys,
  weekRecipeIds,
} from "@/lib/store";

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
  const [recipeIds, onBuyList, pantry] = await Promise.all([
    weekRecipeIds(weekStart),
    getGroceryChecks(weekStart),
    getPantryHaveKeys(),
  ]);
  const aisles = buildGroceryListDetailed(recipeIds);
  const allItems = aisles.flatMap((aisle) => aisle.items);

  const atHome = allItems.filter((item) => pantry.has(item.key));
  const missing = allItems.filter((item) => !pantry.has(item.key));
  const shopping = missing.filter((item) => onBuyList.has(item.key));
  const needDecide = missing.filter((item) => !onBuyList.has(item.key));

  const total = allItems.length;
  const covered = atHome.length;
  const pct = total > 0 ? (covered / total) * 100 : 0;

  return (
    <>
      <section className="block block--tight">
        <div className="card">
          <div className="row-between">
            <div>
              <p className="label">{formatRange(weekStart, addDays(weekStart, 6))}</p>
              <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                {covered}
                <small>/ {total} at home</small>
              </p>
            </div>
            <Ring
              pct={pct}
              tone={pct >= 100 ? "good" : "accent"}
              size={64}
              thickness={6}
              value={`${Math.round(pct)}%`}
              label={`${covered} of ${total} covered`}
            />
          </div>
          <p className="small sub" style={{ marginTop: "0.75rem" }}>
            Mark what you already have. Add missing items to this week&apos;s shopping list, then
            check them off at the store.
          </p>
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
              <p className="small sub">Add recipes to your week on Fuel and the list builds itself.</p>
              <Link className="btn btn--primary btn--sm" href="/fuel">
                Open Fuel
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {shopping.length > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="label" style={{ marginBottom: "0.15rem" }}>
              Shopping list · {shopping.length}
            </p>
            <p className="small sub" style={{ marginBottom: "0.5rem" }}>
              At the store — tap Got it to stock your pantry.
            </p>
            <div className="rows">
              {shopping.map((item) => (
                <div className="row" key={`buy-${item.key}`}>
                  <div className="row__body">
                    <span className="row__title">{item.item}</span>
                    <span className="row__sub">
                      {formatQty(item)} · {item.dishes.join(" · ")}
                    </span>
                    <div className="btnrow" style={{ marginTop: "0.35rem", gap: "0.35rem" }}>
                      <form action={markGroceryBought}>
                        <input type="hidden" name="weekStart" value={weekStart} />
                        <input type="hidden" name="itemKey" value={item.key} />
                        <button className="btn btn--primary btn--sm" type="submit">
                          Got it
                        </button>
                      </form>
                      <form action={toggleGroceryItem}>
                        <input type="hidden" name="weekStart" value={weekStart} />
                        <input type="hidden" name="itemKey" value={item.key} />
                        <input type="hidden" name="checked" value="0" />
                        <button className="btn btn--quiet btn--sm" type="submit">
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {needDecide.length > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="label" style={{ marginBottom: "0.15rem" }}>
              Missing · decide what to buy
            </p>
            <p className="small sub" style={{ marginBottom: "0.5rem" }}>
              Not at home. Add to the shopping list or mark as already stocked.
            </p>
            <div className="rows">
              {needDecide.map((item) => (
                <div className="row" key={`need-${item.key}`}>
                  <div className="row__body">
                    <span className="row__title">{item.item}</span>
                    <span className="row__sub">
                      {formatQty(item)} · for {item.dishes.join(", ")}
                    </span>
                    <div className="btnrow" style={{ marginTop: "0.35rem", gap: "0.35rem" }}>
                      <form action={toggleGroceryItem}>
                        <input type="hidden" name="weekStart" value={weekStart} />
                        <input type="hidden" name="itemKey" value={item.key} />
                        <input type="hidden" name="checked" value="1" />
                        <button className="btn btn--primary btn--sm" type="submit">
                          Buy
                        </button>
                      </form>
                      <form action={togglePantryItem}>
                        <input type="hidden" name="itemKey" value={item.key} />
                        <input type="hidden" name="have" value="1" />
                        <button className="btn btn--ghost btn--sm" type="submit">
                          Have at home
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {atHome.length > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="label" style={{ marginBottom: "0.15rem" }}>
              At home · {atHome.length}
            </p>
            <div className="rows">
              {atHome.map((item) => (
                <div className="row row--done" key={`home-${item.key}`}>
                  <div className="row__body">
                    <span className="row__title">{item.item}</span>
                    <span className="row__sub">{item.dishes.join(" · ")}</span>
                    <form action={togglePantryItem} style={{ marginTop: "0.25rem" }}>
                      <input type="hidden" name="itemKey" value={item.key} />
                      <input type="hidden" name="have" value="0" />
                      <button className="btn btn--quiet btn--sm" type="submit">
                        Mark missing
                      </button>
                    </form>
                  </div>
                  <span className="row__meta">{formatQty(item)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {onBuyList.size > 0 ? (
        <form action={clearGrocery} style={{ margin: "0 1rem 1.5rem" }}>
          <input type="hidden" name="weekStart" value={weekStart} />
          <button className="btn btn--quiet btn--sm btn--block" type="submit">
            Clear shopping list
          </button>
        </form>
      ) : null}
    </>
  );
}

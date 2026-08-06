import Link from "next/link";
import { markGroceryBought, toggleGroceryItem, togglePantryItem } from "@/app/actions";
import { GroceryLineRow } from "@/components/GroceryLineRow";
import { Icon } from "@/components/Icon";
import { Ring } from "@/components/Ring";
import { addDays, formatRange, startOfWeek, todayISO } from "@/lib/date";
import {
  buildGroceryListDetailed,
  mergeGroceryWithBuyList,
} from "@/lib/nutrition/grocery";
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
  const weekItems = buildGroceryListDetailed(recipeIds).flatMap((aisle) => aisle.items);
  const allItems = mergeGroceryWithBuyList(weekItems, onBuyList);

  const atHome = allItems.filter((item) => pantry.has(item.key));
  const missing = allItems.filter(
    (item) => !pantry.has(item.key) && !onBuyList.has(item.key),
  );
  const shopping = allItems.filter(
    (item) => onBuyList.has(item.key) && !pantry.has(item.key),
  );

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
              <p className="card__title">Nothing to shop for</p>
              <p className="small sub">Pick meals on the Week tab and ingredients show up here.</p>
              <Link className="btn btn--primary btn--sm" href="/fuel">
                Open Week
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
              At the store — mark Bought when it&apos;s in the cart.
            </p>
            <div className="grocery-lines">
              {shopping.map((item) => (
                <GroceryLineRow
                  key={`shop-${item.key}`}
                  item={item}
                  action={
                    <form action={markGroceryBought}>
                      <input type="hidden" name="weekStart" value={weekStart} />
                      <input type="hidden" name="itemKey" value={item.key} />
                      <button className="btn btn--primary btn--sm nowrap" type="submit">
                        Bought
                      </button>
                    </form>
                  }
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {missing.length > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="label" style={{ marginBottom: "0.15rem" }}>
              Missing at home · {missing.length}
            </p>
            <p className="small sub" style={{ marginBottom: "0.5rem" }}>
              Add what you need to the shopping list.
            </p>
            <div className="grocery-lines">
              {missing.map((item) => (
                <GroceryLineRow
                  key={`miss-${item.key}`}
                  item={item}
                  action={
                    <form action={toggleGroceryItem}>
                      <input type="hidden" name="weekStart" value={weekStart} />
                      <input type="hidden" name="itemKey" value={item.key} />
                      <input type="hidden" name="checked" value="1" />
                      <button className="btn btn--ghost btn--sm nowrap" type="submit">
                        Add
                      </button>
                    </form>
                  }
                />
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
            <div className="grocery-lines">
              {atHome.map((item) => (
                <GroceryLineRow
                  key={`home-${item.key}`}
                  item={item}
                  action={
                    <form action={togglePantryItem}>
                      <input type="hidden" name="itemKey" value={item.key} />
                      <input type="hidden" name="have" value="0" />
                      <button
                        className="btn btn--quiet btn--sm nowrap"
                        type="submit"
                        aria-label={`Mark ${item.item} as missing`}
                      >
                        Missing
                      </button>
                    </form>
                  }
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {shopping.length === 0 && missing.length === 0 && atHome.length > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="small sub">You have everything for this week&apos;s meals.</p>
          </div>
        </section>
      ) : null}
    </>
  );
}

import type { ReactNode } from "react";
import { markGroceryBought, toggleGroceryItem, togglePantryItem } from "@/app/actions";
import { GroceryLineRow } from "@/components/GroceryLineRow";
import { Icon } from "@/components/Icon";
import { Ring } from "@/components/Ring";
import {
  buildPantryInventory,
  groupGroceryByAisle,
  normalizeGroceryKey,
  type GroceryLine,
} from "@/lib/nutrition/grocery";
import { getGroceryChecks, getPantryHaveKeys } from "@/lib/store";

export const dynamic = "force-dynamic";

function AisleSections({
  items,
  keyPrefix,
  action,
}: {
  items: GroceryLine[];
  keyPrefix: string;
  action: (item: GroceryLine) => ReactNode;
}) {
  const groups = groupGroceryByAisle(items);
  return (
    <div className="grocery-aisles">
      {groups.map((group) => (
        <div className="grocery-aisle" key={`${keyPrefix}-${group.aisle}`}>
          <p className="label grocery-aisle__label">{group.label}</p>
          <div className="grocery-lines">
            {group.items.map((item) => (
              <GroceryLineRow
                key={`${keyPrefix}-${item.key}`}
                item={item}
                showQty={false}
                showDishes={false}
                status={
                  item.dishes.length > 0
                    ? item.dishes.length === 1
                      ? `Used in ${item.dishes[0]}`
                      : `Used in ${item.dishes.length} recipes`
                    : undefined
                }
                action={action(item)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function GroceryPage() {
  const [onBuyList, pantry] = await Promise.all([getGroceryChecks(), getPantryHaveKeys()]);
  const inventory = buildPantryInventory();
  const pantryKeys = new Set([...pantry].map(normalizeGroceryKey));
  const buyKeys = new Set([...onBuyList].map(normalizeGroceryKey));

  const atHome = inventory.filter((item) => pantryKeys.has(item.key));
  const shopping = inventory.filter(
    (item) => buyKeys.has(item.key) && !pantryKeys.has(item.key),
  );
  const missing = inventory.filter(
    (item) => !pantryKeys.has(item.key) && !buyKeys.has(item.key),
  );

  const total = inventory.length;
  const covered = atHome.length;
  const pct = total > 0 ? (covered / total) * 100 : 0;

  return (
    <>
      <section className="block block--tight">
        <div className="card">
          <div className="row-between">
            <div>
              <p className="label">Pantry</p>
              <p className="tile__value" style={{ marginTop: "0.3rem" }}>
                {covered}
                <small>/ {total} at home</small>
              </p>
              <p className="small sub" style={{ marginTop: "0.35rem" }}>
                One list — mark what you have. It stays until you change it.
              </p>
            </div>
            <Ring
              pct={pct}
              tone={pct >= 100 ? "good" : "accent"}
              size={64}
              thickness={6}
              value={`${Math.round(pct)}%`}
              label={`${covered} of ${total} at home`}
            />
          </div>
        </div>
      </section>

      {shopping.length > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="label" style={{ marginBottom: "0.15rem" }}>
              Shopping · {shopping.length}
            </p>
            <p className="small sub" style={{ marginBottom: "0.5rem" }}>
              At the store — mark Bought when it&apos;s in the cart.
            </p>
            <AisleSections
              items={shopping}
              keyPrefix="shop"
              action={(item) => (
                <form action={markGroceryBought}>
                  <input type="hidden" name="itemKey" value={item.key} />
                  <button className="btn btn--primary btn--sm nowrap" type="submit">
                    Bought
                  </button>
                </form>
              )}
            />
          </div>
        </section>
      ) : null}

      {missing.length > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="label" style={{ marginBottom: "0.15rem" }}>
              Not at home · {missing.length}
            </p>
            <p className="small sub" style={{ marginBottom: "0.5rem" }}>
              Add to shopping, or mark Have if it&apos;s already in the kitchen.
            </p>
            <AisleSections
              items={missing}
              keyPrefix="miss"
              action={(item) => (
                <div className="btnrow" style={{ gap: "0.35rem" }}>
                  <form action={togglePantryItem}>
                    <input type="hidden" name="itemKey" value={item.key} />
                    <input type="hidden" name="have" value="1" />
                    <button className="btn btn--quiet btn--sm nowrap" type="submit">
                      Have
                    </button>
                  </form>
                  <form action={toggleGroceryItem}>
                    <input type="hidden" name="itemKey" value={item.key} />
                    <input type="hidden" name="checked" value="1" />
                    <button className="btn btn--ghost btn--sm nowrap" type="submit">
                      Add
                    </button>
                  </form>
                </div>
              )}
            />
          </div>
        </section>
      ) : null}

      {atHome.length > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="label" style={{ marginBottom: "0.15rem" }}>
              At home · {atHome.length}
            </p>
            <AisleSections
              items={atHome}
              keyPrefix="home"
              action={(item) => (
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
              )}
            />
          </div>
        </section>
      ) : null}

      {total === 0 ? (
        <section className="block block--tight">
          <div className="card">
            <div className="empty">
              <span className="empty__icon">
                <Icon name="cart" size={20} />
              </span>
              <p className="card__title">No ingredients yet</p>
              <p className="small sub">Recipe ingredients will show up here as a pantry list.</p>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { markGroceryBought, toggleGroceryItem, togglePantryItem } from "@/app/actions";
import { GroceryLineRow } from "@/components/GroceryLineRow";
import { Icon } from "@/components/Icon";
import { Ring } from "@/components/Ring";
import {
  groupGroceryByAisle,
  type GroceryLine,
} from "@/lib/nutrition/grocery";

export type GroceryBucket = "shopping" | "missing" | "home";

export type GroceryInventoryItem = GroceryLine & {
  bucket: GroceryBucket;
};

function itemStatus(item: GroceryLine): string | undefined {
  if (item.dishes.length === 0) return undefined;
  return item.dishes.length === 1
    ? `Used in ${item.dishes[0]}`
    : `Used in ${item.dishes.length} recipes`;
}

function ItemActions({ item }: { item: GroceryInventoryItem }) {
  if (item.bucket === "shopping") {
    return (
      <form action={markGroceryBought}>
        <input type="hidden" name="itemKey" value={item.key} />
        <button className="btn btn--primary btn--sm nowrap" type="submit">
          Bought
        </button>
      </form>
    );
  }

  if (item.bucket === "missing") {
    return (
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
    );
  }

  return (
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
  );
}

function groupInventoryByAisle(
  items: GroceryInventoryItem[],
): { aisle: GroceryInventoryItem["aisle"]; label: string; items: GroceryInventoryItem[] }[] {
  return groupGroceryByAisle(items).map((group) => ({
    aisle: group.aisle,
    label: group.label,
    items: group.items as GroceryInventoryItem[],
  }));
}

function FoldableAisles({
  items,
  keyPrefix,
  forceOpen = false,
}: {
  items: GroceryInventoryItem[];
  keyPrefix: string;
  forceOpen?: boolean;
}) {
  const groups = groupInventoryByAisle(items);
  if (groups.length === 0) return null;

  return (
    <div className="grocery-aisles">
      {groups.map((group) => (
        <details
          className="grocery-fold"
          key={`${keyPrefix}-${group.aisle}`}
          open={forceOpen || groups.length === 1 ? true : undefined}
        >
          <summary className="grocery-fold__summary">
            <span>{group.label}</span>
            <span className="grocery-fold__count">{group.items.length}</span>
          </summary>
          <div className="grocery-lines">
            {group.items.map((item) => (
              <GroceryLineRow
                key={`${keyPrefix}-${item.key}`}
                item={item}
                showQty={false}
                showDishes={false}
                status={itemStatus(item)}
                action={<ItemActions item={item} />}
              />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

/**
 * Persistent pantry UI with search and foldable aisle sections.
 */
export function GroceryInventory({
  items,
  covered,
  total,
}: {
  items: GroceryInventoryItem[];
  covered: number;
  total: number;
}) {
  const [query, setQuery] = useState("");
  const pct = total > 0 ? (covered / total) * 100 : 0;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.item.toLowerCase().includes(needle) ||
        item.dishes.some((dish) => dish.toLowerCase().includes(needle)),
    );
  }, [items, query]);

  const shopping = filtered.filter((item) => item.bucket === "shopping");
  const missing = filtered.filter((item) => item.bucket === "missing");
  const atHome = filtered.filter((item) => item.bucket === "home");
  const searching = query.trim().length > 0;

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

          <label className="field grocery-search" style={{ marginTop: "0.875rem" }}>
            <span className="sr-only">Search pantry</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ingredients"
              autoComplete="off"
              enterKeyHint="search"
              inputMode="search"
            />
          </label>
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
            <FoldableAisles items={shopping} keyPrefix="shop" forceOpen={searching} />
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
            <FoldableAisles items={missing} keyPrefix="miss" forceOpen={searching} />
          </div>
        </section>
      ) : null}

      {atHome.length > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="label" style={{ marginBottom: "0.15rem" }}>
              At home · {atHome.length}
            </p>
            <FoldableAisles items={atHome} keyPrefix="home" forceOpen={searching} />
          </div>
        </section>
      ) : null}

      {filtered.length === 0 && total > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <div className="empty">
              <span className="empty__icon">
                <Icon name="cart" size={20} />
              </span>
              <p className="card__title">No matches</p>
              <p className="small sub">Try a different ingredient name.</p>
            </div>
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

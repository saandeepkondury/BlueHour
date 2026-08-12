import { markGroceryBought, toggleGroceryItem, togglePantryItem } from "@/app/actions";

export type GroceryBucket = "shopping" | "missing" | "home";

export const GROCERY_BUCKET_LABEL: Record<GroceryBucket, string> = {
  shopping: "Shopping",
  missing: "Not at home",
  home: "At home",
};

export function groceryBucketFor(atHome: boolean, onBuyList: boolean): GroceryBucket {
  if (atHome) return "home";
  if (onBuyList) return "shopping";
  return "missing";
}

/** Same Have / Add / Bought / Missing controls used on Grocery and recipe pages. */
export function GroceryItemActions({
  bucket,
  itemKey,
  itemName,
}: {
  bucket: GroceryBucket;
  itemKey: string;
  itemName: string;
}) {
  if (bucket === "shopping") {
    return (
      <form action={markGroceryBought}>
        <input type="hidden" name="itemKey" value={itemKey} />
        <button className="btn btn--primary btn--sm nowrap" type="submit">
          Bought
        </button>
      </form>
    );
  }

  if (bucket === "missing") {
    return (
      <div className="btnrow" style={{ gap: "0.35rem" }}>
        <form action={togglePantryItem}>
          <input type="hidden" name="itemKey" value={itemKey} />
          <input type="hidden" name="have" value="1" />
          <button className="btn btn--quiet btn--sm nowrap" type="submit">
            Have
          </button>
        </form>
        <form action={toggleGroceryItem}>
          <input type="hidden" name="itemKey" value={itemKey} />
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
      <input type="hidden" name="itemKey" value={itemKey} />
      <input type="hidden" name="have" value="0" />
      <button
        className="btn btn--quiet btn--sm nowrap"
        type="submit"
        aria-label={`Mark ${itemName} as missing`}
      >
        Missing
      </button>
    </form>
  );
}

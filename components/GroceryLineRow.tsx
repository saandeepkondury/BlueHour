import type { GroceryLine } from "@/lib/nutrition/grocery";
import { formatQty } from "@/lib/nutrition/grocery";

/** One grocery line: name, optional qty, and dishes that use it. */
export function GroceryLineRow({
  item,
  action,
  status,
  showQty = true,
  showDishes = true,
}: {
  item: GroceryLine;
  action: React.ReactNode;
  /** Optional status line (e.g. on a recipe page) instead of dish list. */
  status?: string;
  /** Shopping list hides amounts; recipe pages can keep them. */
  showQty?: boolean;
  /** Inventory list can hide the long “used in” dish dump. */
  showDishes?: boolean;
}) {
  return (
    <div className="grocery-line">
      <div className="grocery-line__main">
        <div className="grocery-line__top">
          <span className="grocery-line__name">{item.item}</span>
          {showQty ? <span className="grocery-line__qty">{formatQty(item)}</span> : null}
        </div>
        {status ? (
          <p className="grocery-line__for">{status}</p>
        ) : showDishes && item.dishes.length > 0 ? (
          <div className="grocery-line__dishes">
            <p className="grocery-line__for">
              {item.dishes.length === 1
                ? `Used in ${item.dishes[0]}`
                : `Used in ${item.dishes.length} recipes`}
            </p>
            {item.dishes.length > 1 ? (
              <ul className="grocery-line__list">
                {item.dishes.slice(0, 4).map((dish) => (
                  <li key={dish}>{dish}</li>
                ))}
                {item.dishes.length > 4 ? (
                  <li key="more">+{item.dishes.length - 4} more</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="grocery-line__action">{action}</div>
    </div>
  );
}

import type { GroceryLine } from "@/lib/nutrition/grocery";
import { formatQty } from "@/lib/nutrition/grocery";

/** One grocery line: name, optional qty, and every dish that needs it. */
export function GroceryLineRow({
  item,
  action,
  status,
  showQty = true,
}: {
  item: GroceryLine;
  action: React.ReactNode;
  /** Optional status line (e.g. on a recipe page) instead of dish list. */
  status?: string;
  /** Shopping list hides amounts; recipe pages can keep them. */
  showQty?: boolean;
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
        ) : item.dishes.length > 0 ? (
          <div className="grocery-line__dishes">
            <p className="grocery-line__for">
              {item.dishes.length === 1 ? "For" : `For ${item.dishes.length} meals`}
            </p>
            <ul className="grocery-line__list">
              {item.dishes.map((dish) => (
                <li key={dish}>{dish}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="grocery-line__action">{action}</div>
    </div>
  );
}

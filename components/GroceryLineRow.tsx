import type { GroceryLine } from "@/lib/nutrition/grocery";
import { formatQty } from "@/lib/nutrition/grocery";

/** One grocery line: name, qty, and every dish that needs it. */
export function GroceryLineRow({
  item,
  action,
}: {
  item: GroceryLine;
  action: React.ReactNode;
}) {
  return (
    <div className="grocery-line">
      <div className="grocery-line__main">
        <div className="grocery-line__top">
          <span className="grocery-line__name">{item.item}</span>
          <span className="grocery-line__qty">{formatQty(item)}</span>
        </div>
        {item.dishes.length > 0 ? (
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

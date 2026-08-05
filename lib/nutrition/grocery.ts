import { recipeById, type Aisle, type Ingredient } from "./recipes";

export interface GroceryItem {
  key: string;
  item: string;
  qty: number;
  unit: string;
  aisle: Aisle;
}

export interface GroceryAisle {
  aisle: Aisle;
  label: string;
  items: GroceryItem[];
}

const AISLE_ORDER: Aisle[] = ["produce", "protein", "dairy", "bakery", "pantry", "frozen", "fuel"];

const AISLE_LABEL: Record<Aisle, string> = {
  produce: "Produce",
  protein: "Meat & protein",
  dairy: "Dairy",
  bakery: "Bakery",
  pantry: "Pantry",
  frozen: "Frozen",
  fuel: "Run fuel",
};

function keyFor(ingredient: Ingredient): string {
  return `${ingredient.item.toLowerCase()}|${ingredient.unit.toLowerCase()}`;
}

/** Rolls a week of planned recipes into one shopping list, merged by item and unit. */
export function buildGroceryList(recipeIds: (string | null)[]): GroceryAisle[] {
  const merged = new Map<string, GroceryItem>();

  for (const id of recipeIds) {
    const recipe = recipeById(id);
    if (!recipe) continue;

    for (const ingredient of recipe.ingredients) {
      const key = keyFor(ingredient);
      const existing = merged.get(key);
      if (existing) {
        existing.qty += ingredient.qty;
      } else {
        merged.set(key, {
          key,
          item: ingredient.item,
          qty: ingredient.qty,
          unit: ingredient.unit,
          aisle: ingredient.aisle,
        });
      }
    }
  }

  const aisles: GroceryAisle[] = AISLE_ORDER.map((aisle) => ({
    aisle,
    label: AISLE_LABEL[aisle],
    items: [...merged.values()]
      .filter((item) => item.aisle === aisle)
      .map((item) => ({ ...item, qty: Math.round(item.qty * 100) / 100 }))
      .sort((a, b) => a.item.localeCompare(b.item)),
  }));

  return aisles.filter((aisle) => aisle.items.length > 0);
}

export function formatQty(item: GroceryItem): string {
  const qty = Number.isInteger(item.qty) ? String(item.qty) : item.qty.toFixed(2).replace(/0+$/, "");
  return `${qty} ${item.unit}`;
}

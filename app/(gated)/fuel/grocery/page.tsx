import {
  GroceryInventory,
  type GroceryInventoryItem,
} from "@/components/GroceryInventory";
import {
  buildPantryInventory,
  normalizeGroceryKey,
} from "@/lib/nutrition/grocery";
import { getGroceryChecks, getPantryHaveKeys } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function GroceryPage() {
  const [onBuyList, pantry] = await Promise.all([getGroceryChecks(), getPantryHaveKeys()]);
  const inventory = buildPantryInventory();
  const pantryKeys = new Set([...pantry].map(normalizeGroceryKey));
  const buyKeys = new Set([...onBuyList].map(normalizeGroceryKey));

  const items: GroceryInventoryItem[] = inventory.map((item) => {
    let bucket: GroceryInventoryItem["bucket"];
    if (pantryKeys.has(item.key)) bucket = "home";
    else if (buyKeys.has(item.key)) bucket = "shopping";
    else bucket = "missing";
    return { ...item, bucket };
  });

  const covered = items.filter((item) => item.bucket === "home").length;

  return (
    <GroceryInventory items={items} covered={covered} total={items.length} />
  );
}

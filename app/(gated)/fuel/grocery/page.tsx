import {
  GroceryInventory,
  type GroceryInventoryItem,
  type GroceryRecipeOption,
} from "@/components/GroceryInventory";
import { groceryBucketFor } from "@/components/GroceryItemControls";
import { userRecipeGroceryLines } from "@/lib/meals/store";
import {
  buildPantryInventory,
  ingredientKey,
  normalizeGroceryKey,
} from "@/lib/nutrition/grocery";
import { RECIPES } from "@/lib/nutrition/recipes";
import { getGroceryChecks, getPantryHaveKeys } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function GroceryPage() {
  const [onBuyList, pantry, userLines] = await Promise.all([
    getGroceryChecks(),
    getPantryHaveKeys(),
    userRecipeGroceryLines(),
  ]);
  const inventory = buildPantryInventory(userLines);
  const pantryKeys = new Set([...pantry].map(normalizeGroceryKey));
  const buyKeys = new Set([...onBuyList].map(normalizeGroceryKey));

  const items: GroceryInventoryItem[] = inventory.map((item) => ({
    ...item,
    bucket: groceryBucketFor(pantryKeys.has(item.key), buyKeys.has(item.key)),
  }));

  const userRecipes = new Map<number, GroceryRecipeOption>();
  for (const line of userLines) {
    const option = userRecipes.get(line.recipeId) ?? {
      id: `user:${line.recipeId}`,
      name: line.recipeName,
      ingredientKeys: [],
    };
    if (!option.ingredientKeys.includes(line.key)) option.ingredientKeys.push(line.key);
    userRecipes.set(line.recipeId, option);
  }

  const recipes: GroceryRecipeOption[] = [
    ...userRecipes.values(),
    ...RECIPES.map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      ingredientKeys: [
        ...new Set(recipe.ingredients.map((ingredient) => ingredientKey(ingredient))),
      ],
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const covered = items.filter((item) => item.bucket === "home").length;

  return (
    <GroceryInventory
      items={items}
      recipes={recipes}
      covered={covered}
      total={items.length}
    />
  );
}

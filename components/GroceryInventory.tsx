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

export type GroceryRecipeOption = {
  id: string;
  name: string;
  ingredientKeys: string[];
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

function BucketSections({
  items,
  forceOpen,
}: {
  items: GroceryInventoryItem[];
  forceOpen: boolean;
}) {
  const shopping = items.filter((item) => item.bucket === "shopping");
  const missing = items.filter((item) => item.bucket === "missing");
  const atHome = items.filter((item) => item.bucket === "home");

  return (
    <>
      {shopping.length > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="label" style={{ marginBottom: "0.15rem" }}>
              Shopping · {shopping.length}
            </p>
            <p className="small sub" style={{ marginBottom: "0.5rem" }}>
              At the store — mark Bought when it&apos;s in the cart.
            </p>
            <FoldableAisles items={shopping} keyPrefix="shop" forceOpen={forceOpen} />
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
            <FoldableAisles items={missing} keyPrefix="miss" forceOpen={forceOpen} />
          </div>
        </section>
      ) : null}

      {atHome.length > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="label" style={{ marginBottom: "0.15rem" }}>
              At home · {atHome.length}
            </p>
            <FoldableAisles items={atHome} keyPrefix="home" forceOpen={forceOpen} />
          </div>
        </section>
      ) : null}
    </>
  );
}

/**
 * Persistent pantry UI with ingredient search, recipe focus, and foldable aisles.
 */
export function GroceryInventory({
  items,
  recipes,
  covered,
  total,
}: {
  items: GroceryInventoryItem[];
  recipes: GroceryRecipeOption[];
  covered: number;
  total: number;
}) {
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [recipeQuery, setRecipeQuery] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const pct = total > 0 ? (covered / total) * 100 : 0;

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId],
  );

  const recipeMatches = useMemo(() => {
    if (selectedRecipe) return [];
    const needle = recipeQuery.trim().toLowerCase();
    if (needle.length < 1) return [];
    return recipes
      .filter((recipe) => recipe.name.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [recipes, recipeQuery, selectedRecipe]);

  const recipeFocusItems = useMemo(() => {
    if (!selectedRecipe) return [];
    const keys = new Set(selectedRecipe.ingredientKeys);
    return items.filter((item) => keys.has(item.key));
  }, [items, selectedRecipe]);

  const ingredientFiltered = useMemo(() => {
    const needle = ingredientQuery.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.item.toLowerCase().includes(needle) ||
        item.dishes.some((dish) => dish.toLowerCase().includes(needle)),
    );
  }, [items, ingredientQuery]);

  const focusingRecipe = selectedRecipe !== null;
  const searchingIngredients = ingredientQuery.trim().length > 0;
  const showFullInventory = !focusingRecipe;

  function clearRecipeFocus() {
    setSelectedRecipeId(null);
    setRecipeQuery("");
  }

  function pickRecipe(recipe: GroceryRecipeOption) {
    setSelectedRecipeId(recipe.id);
    setRecipeQuery(recipe.name);
    setIngredientQuery("");
  }

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

          <div className="grocery-searches">
            <label className="field grocery-search">
              <span className="sr-only">Search ingredients</span>
              <input
                type="search"
                value={ingredientQuery}
                onChange={(event) => {
                  setIngredientQuery(event.target.value);
                  if (event.target.value.trim()) clearRecipeFocus();
                }}
                placeholder="Search ingredients"
                autoComplete="off"
                enterKeyHint="search"
                inputMode="search"
                disabled={focusingRecipe}
              />
            </label>

            <label className="field grocery-search">
              <span className="sr-only">Search recipes</span>
              <input
                type="search"
                value={recipeQuery}
                onChange={(event) => {
                  setRecipeQuery(event.target.value);
                  setSelectedRecipeId(null);
                }}
                placeholder="Search recipes"
                autoComplete="off"
                enterKeyHint="search"
                inputMode="search"
              />
            </label>
          </div>

          {recipeMatches.length > 0 ? (
            <div className="grocery-recipe-hits" role="listbox" aria-label="Matching recipes">
              {recipeMatches.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  className="grocery-recipe-hit"
                  role="option"
                  onClick={() => pickRecipe(recipe)}
                >
                  <span className="grocery-recipe-hit__name">{recipe.name}</span>
                  <span className="grocery-recipe-hit__meta">
                    {recipe.ingredientKeys.length} ingredients
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {focusingRecipe && selectedRecipe ? (
        <>
          <section className="block block--tight">
            <div className="card">
              <div className="row-between" style={{ gap: "0.75rem" }}>
                <div style={{ minWidth: 0 }}>
                  <p className="label" style={{ marginBottom: "0.15rem" }}>
                    For this recipe
                  </p>
                  <p className="card__title" style={{ margin: 0 }}>
                    {selectedRecipe.name}
                  </p>
                  <p className="small sub" style={{ marginTop: "0.25rem" }}>
                    {recipeFocusItems.filter((item) => item.bucket === "home").length}/
                    {recipeFocusItems.length} at home · rest of pantry hidden
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm nowrap"
                  onClick={clearRecipeFocus}
                >
                  Clear
                </button>
              </div>
            </div>
          </section>
          <BucketSections items={recipeFocusItems} forceOpen />
          {recipeFocusItems.length === 0 ? (
            <section className="block block--tight">
              <div className="card">
                <p className="small muted">No pantry ingredients mapped for this recipe.</p>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {showFullInventory ? (
        <BucketSections items={ingredientFiltered} forceOpen={searchingIngredients} />
      ) : null}

      {showFullInventory && ingredientFiltered.length === 0 && total > 0 ? (
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

      {!focusingRecipe && recipeQuery.trim() && recipeMatches.length === 0 ? (
        <section className="block block--tight">
          <div className="card">
            <div className="empty">
              <span className="empty__icon">
                <Icon name="cart" size={20} />
              </span>
              <p className="card__title">No recipes found</p>
              <p className="small sub">Try another dish name.</p>
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

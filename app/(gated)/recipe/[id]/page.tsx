import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import {
  GroceryItemActions,
  GROCERY_BUCKET_LABEL,
  groceryBucketFor,
  type GroceryBucket,
} from "@/components/GroceryItemControls";
import { GroceryLineRow } from "@/components/GroceryLineRow";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { pendingCount } from "@/lib/habits/store";
import {
  groceryLinesForRecipe,
  recipeReadiness,
  type GroceryLine,
} from "@/lib/nutrition/grocery";
import { recipeById, SLOT_LABEL } from "@/lib/nutrition/recipes";
import { getGroceryChecks, getPantryHaveKeys } from "@/lib/store";

export const dynamic = "force-dynamic";

const BUCKET_ORDER: GroceryBucket[] = ["shopping", "missing", "home"];

function groupRecipeIngredients(
  lines: GroceryLine[],
  haveKeys: Set<string>,
  onBuyList: Set<string>,
): { bucket: GroceryBucket; label: string; items: GroceryLine[] }[] {
  const buckets: Record<GroceryBucket, GroceryLine[]> = {
    shopping: [],
    missing: [],
    home: [],
  };

  for (const item of lines) {
    const bucket = groceryBucketFor(haveKeys.has(item.key), onBuyList.has(item.key));
    buckets[bucket].push(item);
  }

  return BUCKET_ORDER.map((bucket) => ({
    bucket,
    label: GROCERY_BUCKET_LABEL[bucket],
    items: buckets[bucket],
  })).filter((group) => group.items.length > 0);
}

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = recipeById(id);
  if (!recipe) notFound();

  const back = "/fuel/recipes";
  const [haveKeys, onBuyList, pending] = await Promise.all([
    getPantryHaveKeys(),
    getGroceryChecks(),
    pendingCount(),
  ]);
  const ready = recipeReadiness(recipe, haveKeys);
  const ingredientGroups = groupRecipeIngredients(
    groceryLinesForRecipe(recipe),
    haveKeys,
    onBuyList,
  );

  return (
    <>
      <Shell>
        <AppBar title={recipe.name} subtitle={SLOT_LABEL[recipe.slot]} back={back} pending={pending} />

        <section className="block block--tight">
          <div className="stack">
            <div className="card">
              <div className="stats">
                <div>
                  <p className="stat__value">{recipe.calories}</p>
                  <p className="stat__label">kcal</p>
                </div>
                <div>
                  <p className="stat__value">{recipe.protein}</p>
                  <p className="stat__label">Protein</p>
                </div>
                <div>
                  <p className="stat__value">{recipe.carbs}</p>
                  <p className="stat__label">Carbs</p>
                </div>
                <div>
                  <p className="stat__value">{recipe.fat}</p>
                  <p className="stat__label">Fat</p>
                </div>
                <div>
                  <p className="stat__value">{recipe.minutes}</p>
                  <p className="stat__label">Min</p>
                </div>
              </div>
              {recipe.note ? (
                <>
                  <hr className="card__divide" />
                  <p className="small sub">{recipe.note}</p>
                </>
              ) : null}
              {ready.total > 0 ? (
                <>
                  <hr className="card__divide" />
                  <p className="small sub">
                    Mains {ready.have}/{ready.total} at home
                  </p>
                </>
              ) : null}
              <hr className="card__divide" />
              <Link className="btn btn--primary btn--block" href={`/fuel?log=catalog:${recipe.id}`}>
                <Icon name="camera" size={17} />
                Log this meal
              </Link>
            </div>

            <div className="card">
              <p className="label" style={{ marginBottom: "0.65rem" }}>
                Ingredients
              </p>
              {ingredientGroups.length === 0 ? (
                <p className="small muted">No ingredients listed.</p>
              ) : (
                <div className="stack" style={{ gap: "0.85rem" }}>
                  {ingredientGroups.map((group) => (
                    <div key={group.bucket}>
                      <p className="label" style={{ marginBottom: "0.15rem" }}>
                        {group.label} · {group.items.length}
                      </p>
                      <div className="grocery-lines">
                        {group.items.map((item) => (
                          <GroceryLineRow
                            key={item.key}
                            item={item}
                            showQty={false}
                            showDishes={false}
                            action={
                              <GroceryItemActions
                                bucket={group.bucket}
                                itemKey={item.key}
                                itemName={item.item}
                              />
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <p className="label" style={{ marginBottom: "0.15rem" }}>
                Method
              </p>
              <div className="rows">
                {recipe.steps.map((step, index) => (
                  <div className="row" key={step}>
                    <span className="row__lead">
                      <span className="strong">{index + 1}</span>
                    </span>
                    <span className="row__body">
                      <span className="row__sub row__sub--wrap" style={{ color: "var(--ink)" }}>
                        {step}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              {recipe.videoUrl ? (
                <a
                  className="btn btn--ghost btn--block"
                  style={{ marginTop: "0.75rem" }}
                  href={recipe.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch on Instagram
                </a>
              ) : null}
              {recipe.allergens.length > 0 ? (
                <>
                  <hr className="card__divide" />
                  <p className="small muted">Contains {recipe.allergens.join(", ")}.</p>
                </>
              ) : null}
            </div>

            <Link className="btn btn--ghost btn--block" href={back}>
              Back to recipes
            </Link>
          </div>
        </section>
      </Shell>
      <Nav pending={pending} />
    </>
  );
}

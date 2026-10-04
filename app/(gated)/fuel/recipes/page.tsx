import Link from "next/link";
import { renameIngredientLabel } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { RecipeBrowser } from "@/components/RecipeBrowser";
import { listIngredients, listUserRecipes } from "@/lib/meals/store";
import { buildBrowseCatalog } from "@/lib/nutrition/grocery";
import {
  candidatesFor,
  MEAL_SLOTS,
  parseAllergies,
  type Diet,
  type Slot,
} from "@/lib/nutrition/recipes";
import { getPantryHaveKeys, getProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

const ALL_SLOTS: Slot[] = [
  ...MEAL_SLOTS,
  "fuel_pre",
  "fuel_during",
  "fuel_post",
];

export default async function FuelRecipesPage() {
  const [profile, pantry, mine, ingredients] = await Promise.all([
    getProfile(),
    getPantryHaveKeys(),
    listUserRecipes(),
    listIngredients(),
  ]);
  const diet = profile.dietPref as Diet;
  const allergies = parseAllergies(profile.allergies);
  const allowedIds = new Set(
    ALL_SLOTS.flatMap((s) => candidatesFor(s, diet, allergies)).map((r) => r.id),
  );
  const catalog = buildBrowseCatalog(pantry, (recipe) => allowedIds.has(recipe.id));

  return (
    <>
      <section className="block block--tight">
        <div className="card">
          <div className="row-between" style={{ marginBottom: "0.5rem" }}>
            <div>
              <p className="label">Yours</p>
              <p className="cook-rec__title">Recipes you wrote</p>
            </div>
            <Link className="btn btn--primary btn--sm" href="/fuel/recipes/new">
              <Icon name="plus" size={15} />
              New
            </Link>
          </div>

          {mine.length === 0 ? (
            <p className="small sub">
              Write down what you cook at home: the ingredients and the steps, in plain text.
            </p>
          ) : (
            <div className="rows">
              {mine.map((recipe) => (
                <Link
                  className="row"
                  key={recipe.id}
                  href={`/fuel/recipes/${recipe.id}`}
                  prefetch={false}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  <span className="row__lead row__lead--accent">
                    <Icon name="book" size={17} />
                  </span>
                  <span className="row__body">
                    <span className="row__title">{recipe.name}</span>
                    <span className="row__sub">
                      {recipe.ingredients} ingredient{recipe.ingredients === 1 ? "" : "s"} ·{" "}
                      {recipe.steps} step{recipe.steps === 1 ? "" : "s"}
                    </span>
                  </span>
                  <Icon name="chevron" size={14} />
                </Link>
              ))}
            </div>
          )}

          {ingredients.length > 0 ? (
            <>
              <hr className="card__divide" />
              <details className="fold">
                <summary>Your ingredients · {ingredients.length}</summary>
                <div className="fold__body">
                  <p className="small sub" style={{ marginBottom: "0.5rem" }}>
                    One name per ingredient. Shallots and onions are the same line here, so renaming one
                    renames it in every recipe.
                  </p>
                  <div className="rows">
                    {ingredients.map((ingredient) => (
                      <form className="row ingredient-rename" action={renameIngredientLabel} key={ingredient.key}>
                        <input type="hidden" name="key" value={ingredient.key} />
                        <input
                          name="label"
                          defaultValue={ingredient.label}
                          aria-label={`Rename ${ingredient.label}`}
                          maxLength={120}
                          required
                        />
                        <span className="row__meta nowrap">
                          {ingredient.recipes} recipe{ingredient.recipes === 1 ? "" : "s"}
                        </span>
                        <button className="btn btn--quiet btn--sm" type="submit">
                          Save
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              </details>
            </>
          ) : null}
        </div>
      </section>

      <RecipeBrowser catalog={catalog} hasPantry={pantry.size > 0} />
    </>
  );
}

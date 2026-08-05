import { notFound } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatQty } from "@/lib/nutrition/grocery";
import { recipeById, SLOT_LABEL } from "@/lib/nutrition/recipes";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = recipeById(id);
  if (!recipe) notFound();

  return (
    <>
      <Shell>
        <AppBar title={recipe.name} subtitle={SLOT_LABEL[recipe.slot]} back="/fuel" />

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
            </div>

            <div className="card">
              <p className="label" style={{ marginBottom: "0.15rem" }}>
                Ingredients
              </p>
              <div className="rows">
                {recipe.ingredients.map((ingredient) => (
                  <div className="row" key={ingredient.item}>
                    <span className="row__body">
                      <span className="row__title">{ingredient.item}</span>
                    </span>
                    <span className="row__meta">
                      {formatQty({ ...ingredient, key: ingredient.item })}
                    </span>
                  </div>
                ))}
              </div>
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
              {recipe.allergens.length > 0 ? (
                <>
                  <hr className="card__divide" />
                  <p className="small muted">Contains {recipe.allergens.join(", ")}.</p>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </Shell>
      <Nav />
    </>
  );
}

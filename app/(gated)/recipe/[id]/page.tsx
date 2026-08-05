import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { formatQty } from "@/lib/nutrition/grocery";
import { recipeById, SLOT_LABEL } from "@/lib/nutrition/recipes";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = recipeById(id);
  if (!recipe) notFound();

  return (
    <Shell>
      <section className="sec">
        <p className="sec-label">{SLOT_LABEL[recipe.slot]}</p>
        <h2 className="sec-title">{recipe.name}</h2>
        <p className="sec-intro">{recipe.note}</p>
      </section>

      <article className="plaque">
        <div className="metric-row">
          <div className="metric">
            <p className="metric-value">{recipe.calories}</p>
            <p className="metric-label">kcal</p>
          </div>
          <div className="metric">
            <p className="metric-value">{recipe.protein}</p>
            <p className="metric-label">protein</p>
          </div>
          <div className="metric">
            <p className="metric-value">{recipe.carbs}</p>
            <p className="metric-label">carbs</p>
          </div>
          <div className="metric">
            <p className="metric-value">{recipe.fat}</p>
            <p className="metric-label">fat</p>
          </div>
          <div className="metric">
            <p className="metric-value">{recipe.minutes}</p>
            <p className="metric-label">minutes</p>
          </div>
        </div>
      </article>

      <article className="plaque">
        <p className="plaque-kicker">Ingredients</p>
        <ul className="recipe-lines">
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.item}>
              {ingredient.item} — {formatQty({ ...ingredient, key: ingredient.item })}
            </li>
          ))}
        </ul>
      </article>

      <article className="plaque">
        <p className="plaque-kicker">Method</p>
        <ul className="recipe-lines">
          {recipe.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        {recipe.allergens.length > 0 ? (
          <p className="plaque-tip">Contains: {recipe.allergens.join(", ")}.</p>
        ) : null}
      </article>

      <div className="btn-row">
        <Link className="btn btn--ghost btn--small" href="/fuel">
          Back to the week
        </Link>
      </div>

      <Nav />
    </Shell>
  );
}

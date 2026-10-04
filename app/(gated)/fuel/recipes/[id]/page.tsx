import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { DeleteRecipeButton } from "@/components/meals/DeleteRecipeButton";
import { formatShort, todayISO } from "@/lib/date";
import { formatAmount } from "@/lib/meals/catalog";
import { getMealsForRecipe, getUserRecipe } from "@/lib/meals/store";

export const dynamic = "force-dynamic";

export default async function UserRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) notFound();

  const [recipe, meals] = await Promise.all([
    getUserRecipe(recipeId),
    getMealsForRecipe(`user:${recipeId}`),
  ]);
  if (!recipe) notFound();
  const today = todayISO();
  const photos = meals.filter((meal) => meal.photoUrl).slice(0, 8);

  return (
    <section className="block block--tight">
      <div className="stack">
        <div className="card">
          <p className="label">Your recipe</p>
          <h2 className="card__title" style={{ marginTop: "0.35rem" }}>
            {recipe.name}
          </h2>
          <p className="card__sub">
            {recipe.ingredients.length} ingredient{recipe.ingredients.length === 1 ? "" : "s"} ·{" "}
            {recipe.steps.length} step{recipe.steps.length === 1 ? "" : "s"}
            {meals.length > 0 ? ` · made ${meals.length} time${meals.length === 1 ? "" : "s"}` : ""}
          </p>
          <div className="btnrow btnrow--split" style={{ marginTop: "0.85rem" }}>
            <Link className="btn btn--primary btn--sm" href={`/fuel?log=user:${recipe.id}`}>
              <Icon name="camera" size={15} />
              Log this meal
            </Link>
            <Link className="btn btn--ghost btn--sm" href={`/fuel/recipes/${recipe.id}/edit`}>
              <Icon name="edit" size={15} />
              Edit
            </Link>
          </div>
        </div>

        {photos.length > 0 ? (
          <div className="card">
            <p className="label" style={{ marginBottom: "0.5rem" }}>
              When you made it
            </p>
            <div className="meal-grid meal-grid--small">
              {photos.map((meal) => (
                <Link
                  className="meal-tile"
                  key={meal.id}
                  href={meal.date === today ? "/fuel" : `/fuel?d=${meal.date}`}
                  prefetch={false}
                >
                  <span className="meal-tile__media">
                    <img src={meal.photoUrl!} alt={meal.name} loading="lazy" />
                  </span>
                  <span className="meal-tile__when">{formatShort(meal.date)}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card">
          <p className="label" style={{ marginBottom: "0.35rem" }}>
            Ingredients
          </p>
          {recipe.ingredients.length === 0 ? (
            <p className="small muted">No ingredients yet.</p>
          ) : (
            <div className="rows">
              {recipe.ingredients.map((ingredient) => (
                <div className="row" key={ingredient.key}>
                  <span className="row__body">
                    <span className="row__title">{ingredient.label}</span>
                  </span>
                  <span className="row__meta">{formatAmount(ingredient.qty, ingredient.unit)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <p className="label" style={{ marginBottom: "0.15rem" }}>
            Method
          </p>
          {recipe.steps.length === 0 ? (
            <p className="small muted" style={{ marginTop: "0.35rem" }}>
              No steps yet.{" "}
              <Link href={`/fuel/recipes/${recipe.id}/edit`}>Add them</Link>.
            </p>
          ) : (
            <div className="rows">
              {recipe.steps.map((step, index) => (
                <div className="row" key={`${index}-${step}`}>
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
          )}
        </div>

        <DeleteRecipeButton id={recipe.id} name={recipe.name} />
      </div>
    </section>
  );
}

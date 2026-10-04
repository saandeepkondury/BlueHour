import { RecipeEditor } from "@/components/meals/RecipeEditor";
import { todayISO } from "@/lib/date";
import { getIngredientLabels, getMeal } from "@/lib/meals/store";

export const dynamic = "force-dynamic";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ meal?: string; name?: string }>;
}) {
  const { meal: mealParam, name } = await searchParams;
  const mealId = Number(mealParam);
  const [labels, meal] = await Promise.all([
    getIngredientLabels(),
    Number.isInteger(mealId) && mealId > 0 ? getMeal(mealId) : Promise.resolve(null),
  ]);
  const doneHref = meal ? (meal.date === todayISO() ? "/fuel" : `/fuel?d=${meal.date}`) : undefined;

  return (
    <section className="block block--tight">
      {meal ? (
        <p className="small sub" style={{ marginBottom: "0.75rem" }}>
          Writing the recipe for {meal.name}. It gets attached to that meal when you save.
        </p>
      ) : null}
      <RecipeEditor
        labels={labels}
        mealId={meal?.id}
        initialName={name ?? meal?.name ?? ""}
        doneHref={doneHref}
      />
    </section>
  );
}

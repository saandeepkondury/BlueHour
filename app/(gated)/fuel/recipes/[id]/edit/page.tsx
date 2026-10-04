import { notFound } from "next/navigation";
import { RecipeEditor } from "@/components/meals/RecipeEditor";
import { getIngredientLabels, getUserRecipe } from "@/lib/meals/store";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) notFound();

  const [recipe, labels] = await Promise.all([getUserRecipe(recipeId), getIngredientLabels()]);
  if (!recipe) notFound();

  return (
    <section className="block block--tight">
      <RecipeEditor recipe={recipe} labels={labels} />
    </section>
  );
}

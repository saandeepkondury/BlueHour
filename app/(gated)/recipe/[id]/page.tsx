import Link from "next/link";
import { notFound } from "next/navigation";
import { addRecipeToDay } from "@/app/actions";
import { AppBar } from "@/components/AppBar";
import { Nav } from "@/components/Nav";
import { Shell } from "@/components/Shell";
import { addDays, formatShort, startOfWeek, todayISO, weekdayShort } from "@/lib/date";
import { formatQty, ingredientKey, recipeReadiness } from "@/lib/nutrition/grocery";
import { recipeById, SLOT_LABEL, type Slot } from "@/lib/nutrition/recipes";
import { getPantryHaveKeys } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function RecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; slot?: string; week?: string }>;
}) {
  const { id } = await params;
  const { date: dateParam, slot: slotParam, week: weekParam } = await searchParams;
  const recipe = recipeById(id);
  if (!recipe) notFound();

  const today = todayISO();
  const weekStart =
    weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
      ? startOfWeek(weekParam)
      : dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? startOfWeek(dateParam)
        : startOfWeek(today);
  const defaultDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const slot = (slotParam as Slot | undefined) || recipe.slot;
  const back = `/fuel?week=${weekStart}&slot=${recipe.slot}`;

  const haveKeys = await getPantryHaveKeys();
  const ready = recipeReadiness(recipe, haveKeys);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <>
      <Shell>
        <AppBar title={recipe.name} subtitle={SLOT_LABEL[recipe.slot]} back={back} />

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
                    Pantry: {ready.have}/{ready.total} ingredients at home ({ready.pct}%)
                  </p>
                </>
              ) : null}
              {recipe.videoUrl ? (
                <>
                  <hr className="card__divide" />
                  <a
                    className="btn btn--ghost btn--block"
                    href={recipe.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Watch on Instagram
                  </a>
                </>
              ) : null}
            </div>

            <div className="card">
              <p className="label" style={{ marginBottom: "0.35rem" }}>
                Add to a day
              </p>
              <p className="small sub" style={{ marginBottom: "0.75rem" }}>
                Puts this on {SLOT_LABEL[slot].toLowerCase()} for the day you pick.
              </p>
              <form action={addRecipeToDay}>
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="slot" value={slot} />
                <div className="inline-field">
                  <select name="date" defaultValue={defaultDate} required>
                    {weekDays.map((day) => (
                      <option key={day} value={day}>
                        {weekdayShort(day)} {formatShort(day)}
                        {day === today ? " · today" : ""}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn--primary btn--sm nowrap" type="submit">
                    Add to meal
                  </button>
                </div>
              </form>
            </div>

            <div className="card">
              <p className="label" style={{ marginBottom: "0.15rem" }}>
                Ingredients
              </p>
              <div className="rows">
                {recipe.ingredients.map((ingredient) => {
                  const atHome = haveKeys.has(ingredientKey(ingredient));
                  return (
                    <div className={atHome ? "row row--done" : "row"} key={ingredient.item}>
                      <span className="row__body">
                        <span className="row__title">{ingredient.item}</span>
                        <span className="row__sub">{atHome ? "At home" : "Need"}</span>
                      </span>
                      <span className="row__meta">
                        {formatQty(ingredient)}
                      </span>
                    </div>
                  );
                })}
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

            <Link className="btn btn--ghost btn--block" href={back}>
              Back to Fuel
            </Link>
          </div>
        </section>
      </Shell>
      <Nav />
    </>
  );
}

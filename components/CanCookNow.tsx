"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { addRecipeToDay } from "@/app/actions";
import type { BrowseRecipe } from "@/lib/nutrition/grocery";
import { SLOT_LABEL, type Slot } from "@/lib/nutrition/recipes";

type DayMeal = {
  slot: string;
  recipeId: string | null;
};

function mainsSummary(recipe: BrowseRecipe): string {
  if (recipe.mainsHave.length > 0) {
    return recipe.mainsHave.slice(0, 4).join(" · ");
  }
  if (recipe.mains.length > 0) {
    return recipe.mains.slice(0, 4).join(" · ");
  }
  return `${recipe.minutes} min`;
}

/**
 * Compact pantry-ready strip for Today's Fuel.
 * Ready = all main ingredients at home (seasonings/garnishes ignored).
 */
export function CanCookNow({
  date,
  weekStart,
  pantryCount,
  recipes,
  meals,
}: {
  date: string;
  weekStart: string;
  pantryCount: number;
  recipes: BrowseRecipe[];
  meals: DayMeal[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function assign(recipe: BrowseRecipe) {
    const data = new FormData();
    data.set("date", date);
    data.set("slot", recipe.slot);
    data.set("recipeId", recipe.id);
    start(async () => {
      await addRecipeToDay(data);
      router.refresh();
    });
  }

  function slotFilled(slot: Slot): boolean {
    return meals.some((meal) => meal.slot === slot && Boolean(meal.recipeId));
  }

  if (pantryCount === 0) {
    return (
      <div className="can-cook">
        <div className="can-cook__head">
          <p className="label">Can cook now</p>
          <Link className="block__link" href={`/fuel/grocery?week=${weekStart}`}>
            Grocery
          </Link>
        </div>
        <p className="small sub">
          Mark mains you have — chicken, rice, paneer — on Grocery to unlock dishes.
        </p>
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="can-cook">
        <div className="can-cook__head">
          <p className="label">Can cook now</p>
          <Link className="pill pill--accent" href={`/fuel/grocery?week=${weekStart}`}>
            {pantryCount} at home
          </Link>
        </div>
        <p className="small sub">
          No dish has all its main ingredients yet — seasonings don&apos;t count. Shuffle a
          meal to see almost-there options.
        </p>
      </div>
    );
  }

  return (
    <div className="can-cook" style={{ opacity: pending ? 0.7 : 1 }}>
      <div className="can-cook__head">
        <div>
          <p className="label">Can cook now</p>
          <p className="small sub" style={{ marginTop: "0.15rem" }}>
            Based on mains — not sauces or garnish
          </p>
        </div>
        <Link className="pill pill--good" href={`/fuel/grocery?week=${weekStart}`}>
          {pantryCount} at home
        </Link>
      </div>
      <div className="rows">
        {recipes.map((recipe) => {
          const filled = slotFilled(recipe.slot);
          return (
            <div className="row" key={recipe.id}>
              <Link
                className="row__hit"
                href={`/recipe/${recipe.id}?week=${weekStart}&date=${date}&slot=${recipe.slot}`}
                prefetch={false}
                aria-label={`Open ${recipe.name} recipe`}
              >
                <span className="row__body">
                  <span className="row__title">{recipe.name}</span>
                  <span className="row__sub row__sub--wrap">
                    <span className="pill pill--good">Mains ready</span>
                    <span className="muted">
                      {" "}
                      · {SLOT_LABEL[recipe.slot]} · {mainsSummary(recipe)}
                    </span>
                  </span>
                </span>
              </Link>
              <button
                type="button"
                className="btn btn--ghost btn--sm nowrap"
                disabled={pending}
                onClick={() => assign(recipe)}
                aria-label={
                  filled
                    ? `Swap ${SLOT_LABEL[recipe.slot]} with ${recipe.name}`
                    : `Assign ${recipe.name} to ${SLOT_LABEL[recipe.slot]}`
                }
              >
                {filled ? "Swap" : "Assign"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

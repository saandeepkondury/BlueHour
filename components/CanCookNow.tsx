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

/**
 * Compact pantry-ready strip for Today's Fuel.
 * Assign fills the recipe's slot when empty, otherwise swaps that slot.
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
          Mark what you have on Grocery to unlock dishes you can cook today.
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
          Nothing fully ready — use shuffle on a meal to see almost-there dishes.
        </p>
      </div>
    );
  }

  return (
    <div className="can-cook" style={{ opacity: pending ? 0.7 : 1 }}>
      <div className="can-cook__head">
        <p className="label">Can cook now</p>
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
                    <span className="pill pill--good">Ready</span>
                    <span className="muted">
                      {" "}
                      · {SLOT_LABEL[recipe.slot]} · {recipe.have}/{recipe.total} ·{" "}
                      {recipe.minutes} min
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

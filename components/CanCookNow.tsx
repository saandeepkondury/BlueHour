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

function missingCount(recipe: BrowseRecipe): number {
  return Math.max(0, recipe.total - recipe.have);
}

function rowMeta(recipe: BrowseRecipe): string {
  const bits = [SLOT_LABEL[recipe.slot], `${recipe.protein}g`, `${recipe.minutes}m`];
  const missing = missingCount(recipe);
  if (missing > 0 && recipe.mains.length > 0) {
    const lack = recipe.mains.filter((name) => !recipe.mainsHave.includes(name)).slice(0, 2);
    if (lack.length > 0) bits.push(`need ${lack.join(", ")}`);
  } else if (recipe.mainsHave.length > 0) {
    bits.push(recipe.mainsHave.slice(0, 2).join(", "));
  }
  return bits.join(" · ");
}

/**
 * Pantry-first cook recommendations for Today.
 * Ready = all mains at home; Almost = missing ≤2 mains.
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

  const ready = recipes.filter((recipe) => recipe.pct >= 100);
  const almost = recipes.filter((recipe) => recipe.pct < 100 && missingCount(recipe) <= 2);

  return (
    <div className="cook-rec" style={{ opacity: pending ? 0.7 : 1 }}>
      <div className="cook-rec__head">
        <div>
          <p className="label">Cook</p>
          <p className="cook-rec__title">From your pantry</p>
        </div>
        <div className="cook-rec__links">
          <Link className="pill pill--good" href="/fuel/grocery">
            {pantryCount} home
          </Link>
          <Link className="block__link" href="/fuel/recipes">
            All
          </Link>
        </div>
      </div>

      {pantryCount === 0 ? (
        <div className="cook-rec__empty">
          <p className="small sub">Mark what’s at home to get dish ideas.</p>
          <Link className="btn btn--primary btn--sm" href="/fuel/grocery">
            Open Grocery
          </Link>
        </div>
      ) : ready.length === 0 && almost.length === 0 ? (
        <div className="cook-rec__empty">
          <p className="small sub">Nothing close yet — add a few more mains on Grocery.</p>
          <Link className="btn btn--ghost btn--sm" href="/fuel/grocery">
            Grocery
          </Link>
        </div>
      ) : (
        <div className="rows">
          {[...ready, ...almost].map((recipe) => {
            const filled = slotFilled(recipe.slot);
            const readyNow = recipe.pct >= 100;
            return (
              <div className="row cook-rec__row" key={recipe.id}>
                <Link
                  className="row__hit"
                  href={`/recipe/${recipe.id}?week=${weekStart}&date=${date}&slot=${recipe.slot}`}
                  prefetch={false}
                  aria-label={`Open ${recipe.name}`}
                >
                  <span className="row__body">
                    <span className="row__title">{recipe.name}</span>
                    <span className="row__sub row__sub--wrap">
                      <span className={readyNow ? "pill pill--good" : "pill pill--accent"}>
                        {readyNow ? "Ready" : "Almost"}
                      </span>
                      <span className="muted"> · {rowMeta(recipe)}</span>
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  className="btn btn--primary btn--sm nowrap"
                  disabled={pending}
                  onClick={() => assign(recipe)}
                  aria-label={
                    filled
                      ? `Swap ${SLOT_LABEL[recipe.slot]} with ${recipe.name}`
                      : `Cook ${recipe.name} for ${SLOT_LABEL[recipe.slot]}`
                  }
                >
                  {filled ? "Swap" : "Cook"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

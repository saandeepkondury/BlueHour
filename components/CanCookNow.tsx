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
  name?: string;
};

function missingCount(recipe: BrowseRecipe): number {
  return Math.max(0, recipe.total - recipe.have);
}

function needLine(recipe: BrowseRecipe): string | null {
  const missing = missingCount(recipe);
  if (missing <= 0) return null;
  const lack = recipe.mains.filter((name) => !recipe.mainsHave.includes(name)).slice(0, 2);
  return lack.length > 0 ? `Need ${lack.join(", ")}` : null;
}

/**
 * Pantry-first cook recommendations.
 * Ready = all mains at home; Almost = missing ≤2 mains.
 */
export function CanCookNow({
  date,
  weekStart,
  pantryCount,
  recipes,
  meals,
  compact = false,
}: {
  date: string;
  weekStart: string;
  pantryCount: number;
  recipes: BrowseRecipe[];
  meals: DayMeal[];
  /** Quieter header when nested inside the Fuel day card. */
  compact?: boolean;
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

  function mealInSlot(slot: Slot): DayMeal | undefined {
    return meals.find((meal) => meal.slot === slot && Boolean(meal.recipeId));
  }

  const ready = recipes.filter((recipe) => recipe.pct >= 100);
  const almost = recipes.filter((recipe) => recipe.pct < 100 && missingCount(recipe) <= 2);
  const picks = [...ready, ...almost];

  return (
    <div className="cook-rec" style={{ opacity: pending ? 0.7 : 1 }}>
      <div className="cook-rec__head">
        <div>
          <p className="label">{compact ? "Cook from pantry" : "Cook"}</p>
          {!compact ? <p className="cook-rec__title">From your pantry</p> : null}
        </div>
        <div className="cook-rec__links">
          <Link className="pill pill--good" href="/fuel/grocery">
            {pantryCount} home
          </Link>
          <Link className="block__link" href="/fuel/recipes">
            Recipes
          </Link>
        </div>
      </div>

      {pantryCount === 0 ? (
        <div className="cook-rec__empty">
          <p className="small muted">Mark what’s at home on Grocery.</p>
          <Link className="btn btn--primary btn--sm" href="/fuel/grocery">
            Grocery
          </Link>
        </div>
      ) : picks.length === 0 ? (
        <p className="small muted">Nothing close yet — add a few more mains on Grocery.</p>
      ) : (
        <div className="rows">
          {picks.map((recipe) => {
            const current = mealInSlot(recipe.slot);
            const readyNow = recipe.pct >= 100;
            const slotLabel = SLOT_LABEL[recipe.slot];
            const need = needLine(recipe);
            const actionLabel = current ? `Replace ${slotLabel}` : `→ ${slotLabel}`;

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
                      <span className="muted">
                        {" "}
                        · {slotLabel} · {recipe.protein}g · {recipe.minutes}m
                        {need ? ` · ${need}` : ""}
                        {current?.name ? ` · now ${current.name}` : ""}
                      </span>
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  className={`btn btn--sm nowrap${current ? " btn--ghost" : " btn--primary"}`}
                  disabled={pending}
                  onClick={() => assign(recipe)}
                  aria-label={
                    current
                      ? `Replace ${slotLabel} (${current.name ?? "current meal"}) with ${recipe.name}`
                      : `Add ${recipe.name} to ${slotLabel}`
                  }
                >
                  {actionLabel}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

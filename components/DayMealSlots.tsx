"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addRecipeToDay, clearDayMeal, toggleMeal } from "@/app/actions";
import { Check } from "@/components/Check";
import { Icon } from "@/components/Icon";
import { isVegRecipe, type BrowseRecipe } from "@/lib/nutrition/grocery";
import { MEAL_SLOTS, SLOT_LABEL, type Slot } from "@/lib/nutrition/recipes";

type DayMeal = {
  id: number;
  slot: string;
  recipeId: string | null;
  name: string;
  calories: number;
  eaten: number;
};

/** Picker lists everyday meals first; run-fuel recipes stay available after. */
const CATALOG_SLOT_ORDER: Slot[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "fuel_pre",
  "fuel_during",
  "fuel_post",
];

type DietGroup = {
  key: "veg" | "non-veg";
  label: string;
  recipes: BrowseRecipe[];
};

type SlotGroup = {
  slot: Slot;
  label: string;
  diets: DietGroup[];
};

function dietGroups(recipes: BrowseRecipe[]): DietGroup[] {
  const sorted = [...recipes].sort((a, b) => a.name.localeCompare(b.name));
  return [
    {
      key: "veg" as const,
      label: "Vegetarian",
      recipes: sorted.filter(isVegRecipe),
    },
    {
      key: "non-veg" as const,
      label: "Non-veg",
      recipes: sorted.filter((recipe) => !isVegRecipe(recipe)),
    },
  ].filter((group) => group.recipes.length > 0);
}

export function DayMealSlots({
  date,
  weekStart,
  weekday,
  meals,
  catalog,
  showEaten = false,
}: {
  date: string;
  weekStart: string;
  weekday: string;
  meals: DayMeal[];
  catalog: BrowseRecipe[];
  /** Today / day log: mark meals eaten alongside pick/swap. */
  showEaten?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState<Slot | null>(null);
  const [query, setQuery] = useState("");

  const mealBySlot = useMemo(() => {
    const map = new Map<string, DayMeal>();
    for (const meal of meals) map.set(meal.slot, meal);
    return map;
  }, [meals]);

  const catalogGroups = useMemo((): SlotGroup[] => {
    if (!picking) return [];
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? catalog.filter((recipe) => recipe.name.toLowerCase().includes(needle))
      : catalog;

    const slotOrder = [
      picking,
      ...CATALOG_SLOT_ORDER.filter((slot) => slot !== picking),
    ];

    return slotOrder
      .map((slot) => {
        const recipes = matches.filter((recipe) => recipe.slot === slot);
        const diets = dietGroups(recipes);
        if (diets.length === 0) return null;
        return {
          slot,
          label: slot === picking ? `${SLOT_LABEL[slot]} · this meal` : SLOT_LABEL[slot],
          diets,
        };
      })
      .filter((group): group is SlotGroup => group !== null);
  }, [catalog, picking, query]);

  useEffect(() => {
    if (!picking) {
      setQuery("");
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPicking(null);
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [picking]);

  function pick(slot: Slot, recipeId: string) {
    const data = new FormData();
    data.set("date", date);
    data.set("slot", slot);
    data.set("recipeId", recipeId);
    setPicking(null);
    start(async () => {
      await addRecipeToDay(data);
      router.refresh();
    });
  }

  function remove(slot: Slot) {
    const data = new FormData();
    data.set("date", date);
    data.set("slot", slot);
    setPicking(null);
    start(async () => {
      await clearDayMeal(data);
      router.refresh();
    });
  }

  return (
    <>
      <div className="rows" style={{ opacity: pending ? 0.7 : 1 }}>
        {MEAL_SLOTS.map((slot) => {
          const meal = mealBySlot.get(slot);
          const slotLabel = SLOT_LABEL[slot];

          return (
            <div className={meal?.eaten === 1 ? "row row--done" : "row"} key={slot}>
              {showEaten && meal?.recipeId ? (
                <Check
                  action={toggleMeal}
                  on={meal.eaten === 1}
                  flag="eaten"
                  label={meal.name}
                  fields={{ date, slot }}
                />
              ) : null}
              {meal?.recipeId ? (
                <Link
                  className="row__hit"
                  href={`/recipe/${meal.recipeId}?week=${weekStart}&date=${date}&slot=${slot}`}
                  prefetch={false}
                  aria-label={`Open ${meal.name} recipe`}
                >
                  <span className="row__body">
                    <span className="row__title">{meal.name}</span>
                    <span className="row__sub row__sub--wrap">
                      {slotLabel}
                      <span className="muted"> · {meal.calories} kcal</span>
                    </span>
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  className="row__hit"
                  disabled={pending}
                  onClick={() => setPicking(slot)}
                  aria-label={`Choose ${slotLabel.toLowerCase()}`}
                >
                  <span className="row__body">
                    <span className="row__title">{slotLabel}</span>
                    <span className="row__sub">Choose a dish</span>
                  </span>
                </button>
              )}
              <button
                type="button"
                className="iconbtn"
                disabled={pending}
                onClick={() => setPicking(slot)}
                aria-label={
                  meal
                    ? `Change ${slotLabel}`
                    : `Choose ${slotLabel.toLowerCase()}`
                }
              >
                <Icon name="shuffle" size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {picking ? (
        <div
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`pick-${date}-${picking}`}
        >
          <button
            type="button"
            className="sheet__backdrop"
            aria-label="Close"
            onClick={() => setPicking(null)}
          />
          <div className="sheet__panel">
            <div className="sheet__handle" aria-hidden="true" />
            <div className="sheet__head">
              <div>
                <p className="label">{weekday}</p>
                <h2 className="sheet__title" id={`pick-${date}-${picking}`}>
                  {SLOT_LABEL[picking]}
                </h2>
              </div>
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => setPicking(null)}
              >
                Done
              </button>
            </div>

            <label className="field sheet__search">
              <span className="sr-only">Search recipes</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search all recipes"
                autoComplete="off"
                enterKeyHint="search"
                autoFocus
              />
            </label>

            <div className="sheet__body">
              {catalogGroups.length === 0 ? (
                <p className="small muted" style={{ padding: "1rem 0" }}>
                  {query.trim()
                    ? "No recipes match that search."
                    : "No recipes available yet."}
                </p>
              ) : (
                <div className="meal-groups">
                  {catalogGroups.map((group) => (
                    <div className="meal-group" key={group.slot}>
                      <p className="label meal-group__label">{group.label}</p>
                      {group.diets.map((diet) => (
                        <div className="meal-group meal-group--diet" key={diet.key}>
                          <p className="label meal-group__label meal-group__label--diet">
                            {diet.label}
                          </p>
                          <div className="rows">
                            {diet.recipes.map((recipe) => {
                              const selected =
                                mealBySlot.get(picking)?.recipeId === recipe.id;
                              return (
                                <div
                                  className={selected ? "row row--done" : "row"}
                                  key={recipe.id}
                                >
                                  <button
                                    type="button"
                                    className="row__hit"
                                    disabled={pending}
                                    onClick={() => pick(picking, recipe.id)}
                                  >
                                    <span className="row__body">
                                      <span className="row__title">{recipe.name}</span>
                                      <span className="row__sub">
                                        {recipe.calories} kcal · {recipe.protein}g protein
                                      </span>
                                    </span>
                                    {selected ? <Icon name="check" size={18} /> : null}
                                  </button>
                                  <Link
                                    href={`/recipe/${recipe.id}?week=${weekStart}&date=${date}&slot=${picking}`}
                                    prefetch={false}
                                    className="iconbtn"
                                    aria-label={`Open ${recipe.name} recipe`}
                                  >
                                    <Icon name="chevron" size={16} />
                                  </Link>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {mealBySlot.get(picking) ? (
              <div className="sheet__foot">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm btn--block"
                  onClick={() => remove(picking)}
                >
                  Clear {SLOT_LABEL[picking].toLowerCase()}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

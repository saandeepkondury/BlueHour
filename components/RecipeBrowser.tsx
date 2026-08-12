"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { isVegRecipe, readyToCook, type BrowseRecipe } from "@/lib/nutrition/grocery";
import { MEAL_SLOTS, SLOT_LABEL, type Slot } from "@/lib/nutrition/recipes";

const RUN_SLOTS: Slot[] = ["fuel_pre", "fuel_during", "fuel_post"];

function missingCount(recipe: BrowseRecipe): number {
  return Math.max(0, recipe.total - recipe.have);
}

function cookMeta(recipe: BrowseRecipe): string {
  const bits = [SLOT_LABEL[recipe.slot], `${recipe.protein}g`, `${recipe.minutes}m`];
  const missing = missingCount(recipe);
  if (missing > 0) {
    const lack = recipe.mains.filter((name) => !recipe.mainsHave.includes(name)).slice(0, 2);
    if (lack.length > 0) bits.push(`need ${lack.join(", ")}`);
  } else if (recipe.mainsHave.length > 0) {
    bits.push(recipe.mainsHave.slice(0, 2).join(", "));
  }
  return bits.join(" · ");
}

export function RecipeBrowser({
  weekStart,
  today,
  catalog,
  initialSlot = "breakfast",
  hasPantry,
}: {
  weekStart: string;
  today: string;
  catalog: BrowseRecipe[];
  initialSlot?: Slot;
  hasPantry: boolean;
}) {
  const [slot, setSlot] = useState<Slot>(initialSlot);
  const [pending, start] = useTransition();

  const list = useMemo(
    () => catalog.filter((recipe) => recipe.slot === slot),
    [catalog, slot],
  );

  const listGroups = useMemo(() => {
    const veg = list.filter(isVegRecipe);
    const nonVeg = list.filter((recipe) => !isVegRecipe(recipe));
    return [
      { key: "veg", label: "Vegetarian", recipes: veg },
      { key: "non-veg", label: "Non-veg", recipes: nonVeg },
    ].filter((group) => group.recipes.length > 0);
  }, [list]);

  const pantryPicks = useMemo(() => {
    const picks = readyToCook(catalog, { minPct: 50, limit: 10 });
    const ready = picks.filter((recipe) => recipe.pct >= 100);
    const almost = picks.filter(
      (recipe) => recipe.pct < 100 && missingCount(recipe) <= 2,
    );
    return [...ready, ...almost];
  }, [catalog]);

  return (
    <>
      <section className="block block--tight">
        <div className="card">
          <div className="cook-rec__head" style={{ marginBottom: "0.85rem" }}>
            <div>
              <p className="label">Cook</p>
              <p className="cook-rec__title">From your pantry</p>
            </div>
            <Link className="pill pill--good" href="/fuel/grocery">
              Grocery
            </Link>
          </div>

          {!hasPantry ? (
            <div className="cook-rec__empty">
              <p className="small sub">Mark what’s at home to unlock dishes.</p>
              <Link className="btn btn--primary btn--sm" href="/fuel/grocery">
                Open Grocery
              </Link>
            </div>
          ) : pantryPicks.length === 0 ? (
            <p className="small muted">Nothing close yet — add a few more mains on Grocery.</p>
          ) : (
            <div className="rows">
              {pantryPicks.map((recipe) => {
                const readyNow = recipe.pct >= 100;
                return (
                  <Link
                    className="row cook-rec__row"
                    key={recipe.id}
                    href={`/recipe/${recipe.id}?week=${weekStart}&date=${today}&slot=${recipe.slot}`}
                    prefetch={false}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    <span className="row__body">
                      <span className="row__title">{recipe.name}</span>
                      <span className="row__sub row__sub--wrap">
                        <span className={readyNow ? "pill pill--good" : "pill pill--accent"}>
                          {readyNow ? "Ready" : "Almost"}
                        </span>
                        <span className="muted"> · {cookMeta(recipe)}</span>
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="block block--tight">
        <div className="card">
          <p className="label" style={{ marginBottom: "0.65rem" }}>
            All recipes
          </p>
          <div className="seg" role="tablist" aria-label="Meal type" style={{ marginBottom: "0.5rem" }}>
            {MEAL_SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={slot === s}
                onClick={() => start(() => setSlot(s))}
              >
                {SLOT_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="seg" role="tablist" aria-label="Run fuel" style={{ marginBottom: "0.75rem" }}>
            {RUN_SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={slot === s}
                onClick={() => start(() => setSlot(s))}
              >
                {SLOT_LABEL[s]}
              </button>
            ))}
          </div>

          <div style={{ opacity: pending ? 0.7 : 1 }}>
            {list.length === 0 ? (
              <p className="small muted">No recipes for this meal type yet.</p>
            ) : (
              <div className="meal-groups">
                {listGroups.map((group) => (
                  <div className="meal-group" key={group.key}>
                    <p className="label meal-group__label">{group.label}</p>
                    <div className="rows">
                      {group.recipes.map((recipe) => (
                        <Link
                          className="row"
                          key={recipe.id}
                          href={`/recipe/${recipe.id}?week=${weekStart}&date=${today}&slot=${recipe.slot}`}
                          prefetch={false}
                          style={{ color: "inherit", textDecoration: "none" }}
                        >
                          <span className="row__body">
                            <span className="row__title">{recipe.name}</span>
                            <span className="row__sub">
                              {recipe.calories} kcal · {recipe.protein}g · {recipe.minutes}m
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

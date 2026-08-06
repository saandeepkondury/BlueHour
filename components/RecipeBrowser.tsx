"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { isVegRecipe, type BrowseRecipe } from "@/lib/nutrition/grocery";
import { MEAL_SLOTS, SLOT_LABEL, type Slot } from "@/lib/nutrition/recipes";

const RUN_SLOTS: Slot[] = ["fuel_pre", "fuel_during", "fuel_post"];

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

  const readyNow = useMemo(
    () =>
      catalog
        .filter(
          (recipe) => MEAL_SLOTS.includes(recipe.slot) && recipe.total > 0 && recipe.pct >= 50,
        )
        .slice(0, 6),
    [catalog],
  );

  const readyGroups = useMemo(() => {
    const veg = readyNow.filter(isVegRecipe);
    const nonVeg = readyNow.filter((recipe) => !isVegRecipe(recipe));
    return [
      { key: "veg", label: "Vegetarian", recipes: veg },
      { key: "non-veg", label: "Non-veg", recipes: nonVeg },
    ].filter((group) => group.recipes.length > 0);
  }, [readyNow]);

  return (
    <>
      <section className="block block--tight">
        <div className="card">
          <p className="label" style={{ marginBottom: "0.35rem" }}>
            All recipes
          </p>
          <p className="small sub" style={{ marginBottom: "0.75rem" }}>
            Open a dish for instructions. Add it to a day from the Week tab.
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
                              {recipe.calories} kcal · {recipe.protein}g protein ·{" "}
                              {recipe.minutes} min
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

      {readyNow.length > 0 ? (
        <section className="block block--tight">
          <div className="card">
            <p className="label" style={{ marginBottom: "0.35rem" }}>
              Ready from your pantry
            </p>
            <div className="meal-groups">
              {readyGroups.map((group) => (
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
                            {SLOT_LABEL[recipe.slot]} · {recipe.have}/{recipe.total} at home
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : !hasPantry ? (
        <section className="block block--tight">
          <div className="card">
            <p className="small sub">
              Mark what you have on{" "}
              <Link href={`/fuel/grocery?week=${weekStart}`}>Grocery</Link> to highlight dishes you
              can cook.
            </p>
          </div>
        </section>
      ) : null}
    </>
  );
}

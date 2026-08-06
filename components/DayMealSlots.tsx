"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addRecipeToDay, clearDayMeal } from "@/app/actions";
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

const CATALOG_SLOT_ORDER: Slot[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "fuel_pre",
  "fuel_during",
  "fuel_post",
];

function MealCatalogSelect({
  catalog,
  value,
  onChange,
  id,
}: {
  catalog: BrowseRecipe[];
  value: string;
  onChange: (recipeId: string) => void;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Pick a meal from all recipes"
    >
      <option value="">Choose a meal…</option>
      {CATALOG_SLOT_ORDER.map((slot) => {
        const options = catalog.filter((recipe) => recipe.slot === slot);
        if (options.length === 0) return null;
        return (
          <optgroup key={slot} label={SLOT_LABEL[slot]}>
            {options.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name} · {recipe.calories} kcal
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

export function DayMealSlots({
  date,
  weekStart,
  weekday,
  meals,
  catalog,
}: {
  date: string;
  weekStart: string;
  weekday: string;
  meals: DayMeal[];
  catalog: BrowseRecipe[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState<Slot | null>(null);
  const [replaceSlot, setReplaceSlot] = useState<Slot>("breakfast");
  const [replaceRecipeId, setReplaceRecipeId] = useState("");
  const [sheetRecipeId, setSheetRecipeId] = useState("");

  const mealBySlot = useMemo(() => {
    const map = new Map<string, DayMeal>();
    for (const meal of meals) map.set(meal.slot, meal);
    return map;
  }, [meals]);

  const options = useMemo(
    () => (picking ? catalog.filter((recipe) => recipe.slot === picking) : []),
    [catalog, picking],
  );

  const optionGroups = useMemo(() => {
    const veg = options.filter(isVegRecipe);
    const nonVeg = options.filter((recipe) => !isVegRecipe(recipe));
    return [
      { key: "veg", label: "Vegetarian", recipes: veg },
      { key: "non-veg", label: "Non-veg", recipes: nonVeg },
    ].filter((group) => group.recipes.length > 0);
  }, [options]);

  const replaceSelected = useMemo(
    () => catalog.find((recipe) => recipe.id === replaceRecipeId) ?? null,
    [catalog, replaceRecipeId],
  );

  const sheetSelected = useMemo(
    () => catalog.find((recipe) => recipe.id === sheetRecipeId) ?? null,
    [catalog, sheetRecipeId],
  );

  useEffect(() => {
    if (!picking) {
      setSheetRecipeId("");
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
    setReplaceRecipeId("");
    setSheetRecipeId("");
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
                    ? `Change ${slotLabel}: pick a different dish`
                    : `Choose ${slotLabel.toLowerCase()}`
                }
              >
                <Icon name="chevron" size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <details className="fold" style={{ marginTop: "0.65rem" }}>
        <summary>Replace from all recipes</summary>
        <div className="fold__body stack">
          <label className="field">
            <span className="field__label">Meal slot</span>
            <select
              value={replaceSlot}
              onChange={(event) => setReplaceSlot(event.target.value as Slot)}
              aria-label="Which meal to replace"
            >
              {MEAL_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {SLOT_LABEL[slot]}
                  {mealBySlot.get(slot)?.name
                    ? ` · ${mealBySlot.get(slot)!.name}`
                    : " · empty"}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Meal</span>
            <MealCatalogSelect
              catalog={catalog}
              value={replaceRecipeId}
              onChange={setReplaceRecipeId}
            />
          </label>

          {replaceSelected ? (
            <div className="card card--sunk" style={{ padding: "0.75rem" }}>
              <p className="row__title">{replaceSelected.name}</p>
              <p className="row__sub" style={{ marginTop: "0.2rem" }}>
                {SLOT_LABEL[replaceSelected.slot]} · {replaceSelected.calories} kcal ·{" "}
                {replaceSelected.protein}g protein
              </p>
              <button
                className="btn btn--primary btn--sm btn--block"
                type="button"
                disabled={pending}
                style={{ marginTop: "0.65rem" }}
                onClick={() => pick(replaceSlot, replaceSelected.id)}
              >
                {pending ? "Replacing…" : `Use for ${SLOT_LABEL[replaceSlot].toLowerCase()}`}
              </button>
            </div>
          ) : null}
        </div>
      </details>

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

            <div className="sheet__body stack">
              <label className="field">
                <span className="field__label">From all recipes</span>
                <MealCatalogSelect
                  catalog={catalog}
                  value={sheetRecipeId}
                  onChange={setSheetRecipeId}
                />
              </label>

              {sheetSelected ? (
                <div className="card card--sunk" style={{ padding: "0.75rem" }}>
                  <p className="row__title">{sheetSelected.name}</p>
                  <p className="row__sub" style={{ marginTop: "0.2rem" }}>
                    {SLOT_LABEL[sheetSelected.slot]} · {sheetSelected.calories} kcal ·{" "}
                    {sheetSelected.protein}g protein
                  </p>
                  <button
                    className="btn btn--primary btn--sm btn--block"
                    type="button"
                    disabled={pending}
                    style={{ marginTop: "0.65rem" }}
                    onClick={() => pick(picking, sheetSelected.id)}
                  >
                    {pending ? "Replacing…" : `Use for ${SLOT_LABEL[picking].toLowerCase()}`}
                  </button>
                </div>
              ) : null}

              {options.length === 0 ? (
                <p className="small muted" style={{ padding: "0.5rem 0 1rem" }}>
                  No same-slot dishes yet — pick any meal above.
                </p>
              ) : (
                <div className="meal-groups">
                  <p className="label meal-group__label">Same slot</p>
                  {optionGroups.map((group) => (
                    <div className="meal-group" key={group.key}>
                      <p className="label meal-group__label">{group.label}</p>
                      <div className="rows">
                        {group.recipes.map((recipe) => {
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

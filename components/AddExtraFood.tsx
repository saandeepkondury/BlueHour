"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCustomFood } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { SLOT_LABEL, type Slot } from "@/lib/nutrition/recipes";

export type ExtraFoodOption = {
  id: string;
  name: string;
  slot: Slot;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const SLOT_ORDER: Slot[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "fuel_pre",
  "fuel_during",
  "fuel_post",
];

export function AddExtraFood({
  date,
  catalog,
}: {
  date: string;
  catalog: ExtraFoodOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"catalog" | "custom">("catalog");
  const [recipeId, setRecipeId] = useState("");
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => catalog.find((recipe) => recipe.id === recipeId) ?? null,
    [catalog, recipeId],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter(
      (recipe) =>
        recipe.name.toLowerCase().includes(needle) ||
        SLOT_LABEL[recipe.slot].toLowerCase().includes(needle),
    );
  }, [catalog, query]);

  const grouped = useMemo(() => {
    const map = new Map<Slot, ExtraFoodOption[]>();
    for (const recipe of filtered) {
      const list = map.get(recipe.slot) ?? [];
      list.push(recipe);
      map.set(recipe.slot, list);
    }
    return SLOT_ORDER.filter((slot) => (map.get(slot)?.length ?? 0) > 0).map((slot) => ({
      slot,
      recipes: map.get(slot)!,
    }));
  }, [filtered]);

  function logRecipe(recipe: ExtraFoodOption) {
    const data = new FormData();
    data.set("date", date);
    data.set("name", recipe.name);
    data.set("calories", String(recipe.calories));
    data.set("protein", String(recipe.protein));
    data.set("carbs", String(recipe.carbs));
    data.set("fat", String(recipe.fat));
    start(async () => {
      await addCustomFood(data);
      setRecipeId("");
      setQuery("");
      router.refresh();
    });
  }

  function onCustomSubmit(formData: FormData) {
    start(async () => {
      await addCustomFood(formData);
      router.refresh();
    });
  }

  return (
    <details className="fold">
      <summary>Add something you ate</summary>
      <div className="fold__body stack">
        <div className="seg" role="tablist" aria-label="How to add food">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "catalog"}
            onClick={() => setMode("catalog")}
          >
            Catalogue
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "custom"}
            onClick={() => setMode("custom")}
          >
            Custom
          </button>
        </div>

        {mode === "catalog" ? (
          <div className="stack">
            <label className="field">
              <span className="field__label">Meal</span>
              <select
                value={recipeId}
                onChange={(event) => setRecipeId(event.target.value)}
                aria-label="Pick a meal from the catalogue"
              >
                <option value="">Choose a meal…</option>
                {SLOT_ORDER.map((slot) => {
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
            </label>

            {selected ? (
              <div className="card card--sunk" style={{ padding: "0.75rem" }}>
                <p className="row__title">{selected.name}</p>
                <p className="row__sub" style={{ marginTop: "0.2rem" }}>
                  {SLOT_LABEL[selected.slot]} · {selected.calories} kcal · {selected.protein}p /{" "}
                  {selected.carbs}c / {selected.fat}f
                </p>
                <button
                  className="btn btn--primary btn--sm btn--block"
                  type="button"
                  disabled={pending}
                  style={{ marginTop: "0.65rem" }}
                  onClick={() => logRecipe(selected)}
                >
                  {pending ? "Adding…" : "Add meal"}
                </button>
              </div>
            ) : null}

            <label className="field">
              <span className="field__label">Search catalogue</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Oats, soya, snack…"
                inputMode="search"
                autoComplete="off"
              />
            </label>

            <div className="rows extra-food-list" role="listbox" aria-label="Catalogue meals">
              {grouped.length === 0 ? (
                <p className="small sub" style={{ padding: "0.5rem 0" }}>
                  No meals match that search.
                </p>
              ) : (
                grouped.map((group) => (
                  <div key={group.slot}>
                    <p className="label" style={{ margin: "0.55rem 0 0.15rem" }}>
                      {SLOT_LABEL[group.slot]}
                    </p>
                    {group.recipes.map((recipe) => {
                      const on = recipe.id === recipeId;
                      return (
                        <button
                          key={recipe.id}
                          type="button"
                          role="option"
                          aria-selected={on}
                          className={`row row__hit${on ? " row--selected" : ""}`}
                          disabled={pending}
                          onClick={() => {
                            setRecipeId(recipe.id);
                            logRecipe(recipe);
                          }}
                        >
                          <span className="row__lead row__lead--accent">
                            <Icon name="fuel" size={17} />
                          </span>
                          <span className="row__body">
                            <span className="row__title">{recipe.name}</span>
                            <span className="row__sub">
                              {recipe.protein}p / {recipe.carbs}c / {recipe.fat}f
                            </span>
                          </span>
                          <span className="row__meta">{recipe.calories}</span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <form action={onCustomSubmit} className="stack">
            <input type="hidden" name="date" value={date} />
            <label className="field">
              <span className="field__label">What did you eat?</span>
              <input name="name" placeholder="Taco from Veracruz" required autoComplete="off" />
            </label>
            <div className="grid4">
              <label className="field">
                <span className="field__label">kcal</span>
                <input name="calories" type="number" min="0" inputMode="numeric" placeholder="0" />
              </label>
              <label className="field">
                <span className="field__label">P</span>
                <input name="protein" type="number" min="0" inputMode="numeric" placeholder="0" />
              </label>
              <label className="field">
                <span className="field__label">C</span>
                <input name="carbs" type="number" min="0" inputMode="numeric" placeholder="0" />
              </label>
              <label className="field">
                <span className="field__label">F</span>
                <input name="fat" type="number" min="0" inputMode="numeric" placeholder="0" />
              </label>
            </div>
            <button className="btn btn--ghost btn--sm btn--block" type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add"}
            </button>
          </form>
        )}
      </div>
    </details>
  );
}

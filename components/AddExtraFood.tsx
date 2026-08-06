"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCustomFood } from "@/app/actions";
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

  const selected = useMemo(
    () => catalog.find((recipe) => recipe.id === recipeId) ?? null,
    [catalog, recipeId],
  );

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
            Meal
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
                aria-label="Pick a meal"
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

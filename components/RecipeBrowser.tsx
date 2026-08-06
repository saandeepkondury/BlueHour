"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { BrowseRecipe } from "@/lib/nutrition/grocery";
import { MEAL_SLOTS, SLOT_LABEL, type Slot } from "@/lib/nutrition/recipes";

const BROWSE_SLOTS: Slot[] = [...MEAL_SLOTS, "fuel_pre", "fuel_during", "fuel_post"];

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

  useEffect(() => {
    function onSlot(event: Event) {
      const next = (event as CustomEvent<Slot>).detail;
      if (!next || !BROWSE_SLOTS.includes(next)) return;
      start(() => setSlot(next));
      document.getElementById("browse")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    window.addEventListener("fuel-slot", onSlot);
    return () => window.removeEventListener("fuel-slot", onSlot);
  }, []);

  const list = useMemo(
    () => catalog.filter((recipe) => recipe.slot === slot),
    [catalog, slot],
  );

  const readyNow = useMemo(
    () =>
      catalog
        .filter(
          (recipe) => MEAL_SLOTS.includes(recipe.slot) && recipe.total > 0 && recipe.pct >= 50,
        )
        .slice(0, 6),
    [catalog],
  );

  return (
    <>
      <section className="block block--tight">
        <div className="card">
          <p className="label" style={{ marginBottom: "0.35rem" }}>
            Pick a recipe
          </p>
          <p className="small sub" style={{ marginBottom: "0.75rem" }}>
            Filter by meal, open a dish for instructions, then add it to any day.
          </p>
          <div className="seg" role="tablist" aria-label="Meal type" style={{ marginBottom: "0.75rem" }}>
            {BROWSE_SLOTS.map((s) => (
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

          <div
            id="browse"
            className="rows"
            style={{ maxHeight: "18rem", overflow: "auto", opacity: pending ? 0.7 : 1 }}
          >
            {list.length === 0 ? (
              <p className="small muted">No recipes for this meal type yet.</p>
            ) : (
              list.map((recipe) => (
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
                      {recipe.calories} kcal · {recipe.protein}g protein · {recipe.minutes} min
                      {recipe.total > 0 ? ` · ${recipe.have}/${recipe.total} at home` : ""}
                    </span>
                  </span>
                  <span className="row__meta">{recipe.total > 0 ? `${recipe.pct}%` : "→"}</span>
                </Link>
              ))
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
            <p className="small sub" style={{ marginBottom: "0.75rem" }}>
              Dishes where you already have most of the ingredients.
            </p>
            <div className="rows">
              {readyNow.map((recipe) => (
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
                      {SLOT_LABEL[recipe.slot]} · {recipe.have}/{recipe.total} ingredients
                    </span>
                  </span>
                  <span className="row__meta">{recipe.pct}%</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : !hasPantry ? (
        <section className="block block--tight">
          <div className="card">
            <p className="small sub">
              Mark what you have on{" "}
              <Link href={`/fuel/grocery?week=${weekStart}`}>Grocery</Link> and we&apos;ll surface
              recipes you can cook tonight.
            </p>
          </div>
        </section>
      ) : null}
    </>
  );
}

export function SlotJump({ slot, label }: { slot: Slot; label: string }) {
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("fuel-slot", { detail: slot }));
      }}
    >
      + {label}
    </button>
  );
}

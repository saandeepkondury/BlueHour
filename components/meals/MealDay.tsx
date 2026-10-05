"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import type { MealEntry, RecipeOption } from "@/lib/meals/catalog";
import { MealCard } from "./MealCard";
import { MealComposer } from "./MealComposer";

type Composer = { meal?: MealEntry; preset?: string } | null;

/** One day's meals plus the "Log a meal" sheet. Shared by Fuel and Today. */
export function MealDay({
  date,
  meals,
  recipes,
  variant = "full",
  presetRecipe,
  composeOnLoad = false,
  canLog = true,
}: {
  date: string;
  meals: MealEntry[];
  recipes: RecipeOption[];
  variant?: "full" | "compact";
  /** Opens the composer on load with this recipe linked. */
  presetRecipe?: string;
  /** Opens a blank composer on load (the home screen widget's camera button). */
  composeOnLoad?: boolean;
  canLog?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [composer, setComposer] = useState<Composer>(() => {
    if (!canLog) return null;
    if (presetRecipe) return { preset: presetRecipe };
    return composeOnLoad ? {} : null;
  });
  const [openId, setOpenId] = useState<number | null>(null);
  const [gone, setGone] = useState<number[]>([]);
  const visible = meals.filter((meal) => !gone.includes(meal.id));

  const close = useCallback(() => {
    setComposer(null);
    if (params.has("log") || params.has("compose")) {
      const next = new URLSearchParams(params.toString());
      next.delete("log");
      next.delete("compose");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [params, pathname, router]);

  return (
    <>
      {visible.length === 0 ? (
        <div className="empty">
          <span className="empty__icon">
            <Icon name="camera" size={20} />
          </span>
          <p className="small sub">
            {canLog ? "Nothing logged yet. Snap your next meal." : "No meals logged this day."}
          </p>
        </div>
      ) : (
        <div className={variant === "full" ? "meal-list" : "meal-list meal-list--compact"}>
          {visible.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              variant={variant}
              shut={openId !== null && openId !== meal.id}
              onEdit={(picked) => setComposer({ meal: picked })}
              onOpen={() => setOpenId(meal.id)}
              onClose={() => setOpenId((id) => (id === meal.id ? null : id))}
              onRemoved={() => {
                setGone((ids) => (ids.includes(meal.id) ? ids : [...ids, meal.id]));
                setOpenId((id) => (id === meal.id ? null : id));
              }}
              onRestored={() => setGone((ids) => ids.filter((id) => id !== meal.id))}
            />
          ))}
        </div>
      )}

      {canLog ? (
        <button
          type="button"
          className="btn btn--primary btn--block"
          style={{ marginTop: "0.85rem" }}
          onClick={() => setComposer({})}
        >
          <Icon name="camera" size={18} />
          Log a meal
        </button>
      ) : null}

      {composer ? (
        <MealComposer
          key={composer.meal?.id ?? `new-${composer.preset ?? ""}`}
          date={date}
          recipes={recipes}
          meal={composer.meal}
          presetRecipe={composer.preset}
          onClose={close}
        />
      ) : null}
    </>
  );
}

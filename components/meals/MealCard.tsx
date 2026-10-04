"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMealPhoto, starMeal } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { MARK_NAME, SLOT_NAME, SOURCE_NAME, type MealEntry } from "@/lib/meals/catalog";
import { shrinkPhoto } from "./shrinkPhoto";

export function StarGlyph({ on, size = 20 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3.15l2.62 5.31 5.86.85-4.24 4.13 1 5.83L12 16.5l-5.24 2.77 1-5.83-4.24-4.13 5.86-.85z"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={on ? 0 : 1.7}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MealTags({ meal }: { meal: Pick<MealEntry, "source" | "mark"> }) {
  return (
    <span className="meal-tags">
      <span className={`pill meal-tag meal-tag--${meal.source}`}>{SOURCE_NAME[meal.source]}</span>
      {meal.mark ? (
        <span className={`pill ${meal.mark === "healthy" ? "pill--good" : "pill--warn"}`}>
          {MARK_NAME[meal.mark]}
        </span>
      ) : null}
    </span>
  );
}

export function MealCard({
  meal,
  variant = "full",
  onEdit,
}: {
  meal: MealEntry;
  variant?: "full" | "compact";
  onEdit: (meal: MealEntry) => void;
}) {
  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const [starred, setStarred] = useState(meal.starred);
  const [uploading, startUpload] = useTransition();
  const [, startStar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setStarred(meal.starred), [meal.starred]);

  function flipStar() {
    const next = !starred;
    setStarred(next);
    const data = new FormData();
    data.set("id", String(meal.id));
    data.set("date", meal.date);
    data.set("starred", next ? "1" : "0");
    startStar(async () => {
      await starMeal(data);
      router.refresh();
    });
  }

  function pickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    startUpload(async () => {
      const data = new FormData();
      data.set("id", String(meal.id));
      data.set("photo", await shrinkPhoto(file));
      const result = await addMealPhoto(data);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  return (
    <article className={`meal-card meal-card--${variant}`}>
      <div className="meal-card__media">
        {meal.photoUrl ? (
          <img className="meal-card__img" src={meal.photoUrl} alt={meal.name} loading="lazy" />
        ) : (
          <button
            type="button"
            className="meal-card__nophoto"
            disabled={uploading}
            onClick={() => photoRef.current?.click()}
          >
            <Icon name="camera" size={variant === "full" ? 24 : 18} />
            {variant === "full" ? <span>{uploading ? "Uploading…" : "Add photo"}</span> : null}
          </button>
        )}
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
        <button
          type="button"
          className={`meal-star${starred ? " meal-star--on" : ""}`}
          aria-pressed={starred}
          aria-label={starred ? `Unstar ${meal.name}` : `Star ${meal.name}`}
          onClick={flipStar}
        >
          <StarGlyph on={starred} size={variant === "full" ? 20 : 16} />
        </button>
      </div>

      <div className="meal-card__body">
        <p className="label">{SLOT_NAME[meal.slot]}</p>
        <p className="meal-card__name">{meal.name}</p>
        <MealTags meal={meal} />
        {meal.recipeHref && meal.recipeName ? (
          <Link className="meal-card__recipe" href={meal.recipeHref} prefetch={false}>
            <Icon name="book" size={14} />
            {meal.recipeName.trim().toLowerCase() === meal.name.trim().toLowerCase() ? "Recipe" : meal.recipeName}
            {meal.calories > 0 ? <span className="muted"> · {meal.calories} kcal</span> : null}
          </Link>
        ) : null}
        {error ? <p className="small" style={{ color: "var(--bad)" }}>{error}</p> : null}
      </div>

      <button
        type="button"
        className="iconbtn meal-card__edit"
        aria-label={`Edit ${meal.name}`}
        onClick={() => onEdit(meal)}
      >
        <Icon name="edit" size={17} />
      </button>
    </article>
  );
}

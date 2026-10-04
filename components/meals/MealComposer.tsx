"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeMeal, saveMeal } from "@/app/actions";
import { Icon } from "@/components/Icon";
import {
  MEAL_MARKS,
  MEAL_SLOT_LIST,
  MEAL_SOURCES,
  slotForHour,
  type MealEntry,
  type MealMark,
  type MealSlot,
  type MealSource,
  type RecipeOption,
} from "@/lib/meals/catalog";
import { formatShort, weekdayShort } from "@/lib/date";
import { shrinkPhoto } from "./shrinkPhoto";

const NEW_RECIPE = "__new";

export function MealComposer({
  date,
  recipes,
  meal,
  presetRecipe,
  onClose,
}: {
  date: string;
  recipes: RecipeOption[];
  /** Set when editing an existing meal. */
  meal?: MealEntry;
  /** Prefills the recipe link, e.g. from "Log this meal" on a recipe page. */
  presetRecipe?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const preset = presetRecipe ? recipes.find((recipe) => recipe.ref === presetRecipe) : undefined;
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(meal?.photoUrl ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [name, setName] = useState(meal?.name ?? preset?.name ?? "");
  const [slot, setSlot] = useState<MealSlot>(meal?.slot ?? slotForHour(new Date().getHours()));
  const [source, setSource] = useState<MealSource>(meal?.source ?? "home");
  const [mark, setMark] = useState<MealMark | null>(meal?.mark ?? null);
  const [recipeRef, setRecipeRef] = useState(meal?.recipeRef ?? preset?.ref ?? "");

  const mine = useMemo(() => recipes.filter((recipe) => recipe.kind === "user"), [recipes]);
  const catalog = useMemo(() => recipes.filter((recipe) => recipe.kind === "catalog"), [recipes]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    if (source === "out") setRecipeRef("");
    if (source === "prepped" && recipeRef === NEW_RECIPE) setRecipeRef("");
  }, [source, recipeRef]);

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhoto(file);
    setRemovePhoto(false);
  }

  function clearPhoto() {
    setPhoto(null);
    setPreview(null);
    setRemovePhoto(Boolean(meal?.photoUrl));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const linked = recipes.find((recipe) => recipe.ref === recipeRef);
    const writingRecipe = recipeRef === NEW_RECIPE;

    start(async () => {
      const data = new FormData();
      if (meal) data.set("id", String(meal.id));
      data.set("date", meal?.date ?? date);
      data.set("slot", slot);
      data.set("source", source);
      data.set("mark", mark ?? "");
      data.set("name", name.trim());
      data.set("recipeRef", writingRecipe ? "" : recipeRef);
      if (linked) data.set("recipeName", linked.name);
      if (photo) data.set("photo", await shrinkPhoto(photo));
      if (removePhoto) data.set("removePhoto", "1");

      const result = await saveMeal(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (writingRecipe) {
        const params = new URLSearchParams({ meal: String(result.id) });
        if (name.trim()) params.set("name", name.trim());
        router.push(`/fuel/recipes/new?${params.toString()}`);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  function destroy() {
    if (!meal) return;
    if (!window.confirm(`Delete ${meal.name}?`)) return;
    const data = new FormData();
    data.set("id", String(meal.id));
    data.set("date", meal.date);
    start(async () => {
      await removeMeal(data);
      onClose();
      router.refresh();
    });
  }

  const day = meal?.date ?? date;

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="sheet__backdrop" aria-label="Close" onClick={onClose} />
      <form className="sheet__panel sheet__panel--tall" onSubmit={submit}>
        <div className="sheet__handle" aria-hidden="true" />
        <div className="sheet__head">
          <div>
            <p className="label">
              {weekdayShort(day)} {formatShort(day)}
            </p>
            <h2 className="sheet__title" id={titleId}>
              {meal ? "Edit meal" : "Log a meal"}
            </h2>
          </div>
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="sheet__body stack">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={pickFile}
          />
          <input ref={libraryRef} type="file" accept="image/*" hidden onChange={pickFile} />

          {preview ? (
            <div className="meal-photo-pick">
              <img className="meal-photo-pick__img" src={preview} alt="Meal photo" />
              <div className="meal-photo-pick__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => cameraRef.current?.click()}
                >
                  Retake
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={clearPhoto}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="meal-photo-empty">
              <button
                type="button"
                className="meal-photo-empty__camera"
                onClick={() => cameraRef.current?.click()}
              >
                <Icon name="camera" size={26} />
                <span>Take a photo</span>
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => libraryRef.current?.click()}
              >
                Choose from library
              </button>
            </div>
          )}

          <label className="field">
            <span className="field__label">What was it?</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={recipeRef && recipeRef !== NEW_RECIPE ? "Uses the recipe name" : "Dal and rice"}
              autoComplete="off"
              maxLength={120}
            />
          </label>

          <fieldset className="choice">
            <legend className="field__label">Meal</legend>
            <div className="chiprow chiprow--wrap">
              {MEAL_SLOT_LIST.map((option) => (
                <label className="chip" key={option.id}>
                  <input
                    type="radio"
                    name="slot"
                    value={option.id}
                    checked={slot === option.id}
                    onChange={() => setSlot(option.id)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice">
            <legend className="field__label">Where it came from</legend>
            <div className="chiprow chiprow--wrap">
              {MEAL_SOURCES.map((option) => (
                <label className="chip" key={option.id}>
                  <input
                    type="radio"
                    name="source"
                    value={option.id}
                    checked={source === option.id}
                    onChange={() => setSource(option.id)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice">
            <legend className="field__label">Mark it (optional)</legend>
            <div className="chiprow chiprow--wrap">
              {MEAL_MARKS.map((option) => {
                const on = mark === option.id;
                return (
                  <button
                    type="button"
                    key={option.id}
                    className={`chip chip--mark-${option.id}${on ? " chip--picked" : ""}`}
                    aria-pressed={on}
                    onClick={() => setMark(on ? null : option.id)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {source !== "out" ? (
            <label className="field">
              <span className="field__label">Recipe (optional)</span>
              <select value={recipeRef} onChange={(event) => setRecipeRef(event.target.value)}>
                <option value="">No recipe</option>
                {source === "home" ? <option value={NEW_RECIPE}>Write a new recipe</option> : null}
                {mine.length > 0 ? (
                  <optgroup label="Your recipes">
                    {mine.map((recipe) => (
                      <option key={recipe.ref} value={recipe.ref}>
                        {recipe.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label="Instagram recipes">
                  {catalog.map((recipe) => (
                    <option key={recipe.ref} value={recipe.ref}>
                      {recipe.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              {recipeRef === NEW_RECIPE ? (
                <span className="field__hint">You will write it right after saving the meal.</span>
              ) : null}
            </label>
          ) : null}

          {error ? <p className="notice notice--bad">{error}</p> : null}
        </div>

        <div className="sheet__foot stack stack--sm">
          <button className="btn btn--primary btn--block" type="submit" disabled={pending}>
            {pending ? "Saving…" : meal ? "Save meal" : "Log meal"}
          </button>
          {meal ? (
            <button
              type="button"
              className="btn btn--danger btn--sm btn--block"
              disabled={pending}
              onClick={destroy}
            >
              Delete meal
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

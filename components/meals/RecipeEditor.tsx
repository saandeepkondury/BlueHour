"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRecipe } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { formatAmount, splitSteps } from "@/lib/meals/catalog";
import { resolveIngredientIdentity } from "@/lib/nutrition/ingredient-identity";

type Line = { uid: number; name: string; amount: string; key: string };
type Step = { uid: number; text: string };

let nextUid = 1;
const fresh = () => nextUid++;

export function RecipeEditor({
  recipe,
  labels,
  mealId,
  initialName = "",
  doneHref,
}: {
  recipe?: {
    id: number;
    name: string;
    steps: string[];
    ingredients: { key: string; name: string; qty: number | null; unit: string | null }[];
  };
  /** Saved display name per ingredient key on this account. */
  labels: Record<string, string>;
  /** Meal that gets this recipe linked once it is saved. */
  mealId?: number;
  initialName?: string;
  /** Where to go after saving. Defaults to the recipe page. */
  doneHref?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const ingredientRef = useRef<HTMLInputElement>(null);
  const stepRefs = useRef(new Map<number, HTMLTextAreaElement>());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(recipe?.name ?? initialName);
  const [lines, setLines] = useState<Line[]>(
    () =>
      recipe?.ingredients.map((ingredient) => ({
        uid: fresh(),
        name: ingredient.name,
        amount: formatAmount(ingredient.qty, ingredient.unit),
        key: ingredient.key,
      })) ?? [],
  );
  const [steps, setSteps] = useState<Step[]>(() =>
    (recipe?.steps.length ? recipe.steps : [""]).map((text) => ({ uid: fresh(), text })),
  );
  const [draft, setDraft] = useState("");
  const [draftAmount, setDraftAmount] = useState("");

  const suggestions = useMemo(
    () => [...new Set(Object.values(labels))].sort((a, b) => a.localeCompare(b)),
    [labels],
  );

  const draftKey = draft.trim() ? resolveIngredientIdentity(draft).key : null;
  const duplicate = draftKey ? lines.find((line) => line.key === draftKey) : undefined;
  const savedLabel = draftKey ? labels[draftKey] : undefined;

  function labelFor(line: Pick<Line, "key" | "name">): string {
    return labels[line.key] ?? lines.find((other) => other.key === line.key)?.name ?? line.name;
  }

  let hint: string | null = null;
  if (duplicate) hint = `Already in this recipe as ${labelFor(duplicate)}.`;
  else if (savedLabel && savedLabel.toLowerCase() !== draft.trim().toLowerCase()) {
    hint = `Using ${savedLabel}, which you already have.`;
  }

  function addIngredient() {
    const typed = draft.trim();
    if (!typed || !draftKey || duplicate) return;
    setLines((prev) => [...prev, { uid: fresh(), name: typed, amount: draftAmount.trim(), key: draftKey }]);
    setDraft("");
    setDraftAmount("");
    ingredientRef.current?.focus();
  }

  function updateLine(uid: number, amount: string) {
    setLines((prev) => prev.map((line) => (line.uid === uid ? { ...line, amount } : line)));
  }

  function removeLine(uid: number) {
    setLines((prev) => prev.filter((line) => line.uid !== uid));
  }

  function focusStep(uid: number) {
    requestAnimationFrame(() => stepRefs.current.get(uid)?.focus());
  }

  function addStep(after?: number) {
    const step = { uid: fresh(), text: "" };
    setSteps((prev) => {
      if (after === undefined) return [...prev, step];
      const index = prev.findIndex((item) => item.uid === after);
      return [...prev.slice(0, index + 1), step, ...prev.slice(index + 1)];
    });
    focusStep(step.uid);
  }

  function setStep(uid: number, text: string) {
    setSteps((prev) => prev.map((step) => (step.uid === uid ? { ...step, text } : step)));
  }

  function moveStep(uid: number, by: -1 | 1) {
    setSteps((prev) => {
      const index = prev.findIndex((step) => step.uid === uid);
      const target = index + by;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function removeStep(uid: number) {
    setSteps((prev) => (prev.length === 1 ? [{ uid: fresh(), text: "" }] : prev.filter((step) => step.uid !== uid)));
  }

  /** Pasting several lines into one step turns each line into its own step. */
  function pasteSteps(uid: number, event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = event.clipboardData.getData("text");
    if (!text.includes("\n")) return;
    const parts = splitSteps(text);
    if (parts.length < 2) return;
    event.preventDefault();
    setSteps((prev) => {
      const index = prev.findIndex((step) => step.uid === uid);
      const current = prev[index];
      const pasted = parts.map((text, i) => ({
        uid: i === 0 && !current.text.trim() ? current.uid : fresh(),
        text,
      }));
      const replaced = current.text.trim() ? [current, ...pasted] : pasted;
      return [...prev.slice(0, index), ...replaced, ...prev.slice(index + 1)];
    });
  }

  function onStepKey(uid: number, event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      addStep(uid);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Give the recipe a name.");
      return;
    }
    const pendingDraft =
      draft.trim() && draftKey && !duplicate ? [{ name: draft.trim(), amount: draftAmount.trim() }] : [];
    start(async () => {
      const result = await saveRecipe({
        id: recipe?.id,
        name: name.trim(),
        steps: steps.map((step) => step.text.trim()).filter(Boolean),
        ingredients: [...lines.map((line) => ({ name: line.name, amount: line.amount })), ...pendingDraft],
        mealId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(doneHref ?? `/fuel/recipes/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="card stack">
        <label className="field">
          <span className="field__label">Recipe name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Mom's dal"
            maxLength={120}
            autoComplete="off"
            required
          />
        </label>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: "0.5rem" }}>
          <p className="label">Ingredients</p>
          <span className="label">{lines.length}</span>
        </div>

        {lines.length > 0 ? (
          <div className="rows" style={{ marginBottom: "0.75rem" }}>
            {lines.map((line) => {
              const label = labelFor(line);
              const renamed = label.toLowerCase() !== line.name.toLowerCase();
              return (
                <div className="row" key={line.uid}>
                  <div className="row__body">
                    <span className="row__title">{label}</span>
                    {renamed ? <span className="row__sub">You typed {line.name}</span> : null}
                  </div>
                  <input
                    className="recipe-amount"
                    value={line.amount}
                    onChange={(event) => updateLine(line.uid, event.target.value)}
                    placeholder="Amount"
                    aria-label={`Amount of ${label}`}
                    maxLength={40}
                  />
                  <button
                    type="button"
                    className="iconbtn"
                    aria-label={`Remove ${label}`}
                    onClick={() => removeLine(line.uid)}
                  >
                    <Icon name="minus" size={17} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="recipe-add">
          <input
            ref={ingredientRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addIngredient();
              }
            }}
            placeholder="Add an ingredient"
            aria-label="Ingredient"
            list={listId}
            autoComplete="off"
            maxLength={120}
          />
          <input
            className="recipe-amount"
            value={draftAmount}
            onChange={(event) => setDraftAmount(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addIngredient();
              }
            }}
            placeholder="Amount"
            aria-label="Amount"
            maxLength={40}
          />
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={!draft.trim() || Boolean(duplicate)}
            onClick={addIngredient}
          >
            Add
          </button>
        </div>
        <datalist id={listId}>
          {suggestions.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
        {hint ? <p className="field__hint">{hint}</p> : null}
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: "0.5rem" }}>
          <p className="label">Method</p>
          <span className="small muted">Enter adds the next step</span>
        </div>
        <ol className="recipe-steps">
          {steps.map((step, index) => (
            <li className="recipe-step" key={step.uid}>
              <span className="recipe-step__num" aria-hidden="true">
                {index + 1}
              </span>
              <textarea
                ref={(node) => {
                  if (node) stepRefs.current.set(step.uid, node);
                  else stepRefs.current.delete(step.uid);
                }}
                value={step.text}
                onChange={(event) => setStep(step.uid, event.target.value)}
                onPaste={(event) => pasteSteps(step.uid, event)}
                onKeyDown={(event) => onStepKey(step.uid, event)}
                placeholder={index === 0 ? "Heat oil, add cumin seeds…" : "Next step"}
                aria-label={`Step ${index + 1}`}
                rows={2}
                maxLength={2000}
              />
              <div className="recipe-step__tools">
                <button
                  type="button"
                  className="iconbtn"
                  aria-label={`Move step ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => moveStep(step.uid, -1)}
                >
                  <Icon name="chevron" size={16} className="icon-up" />
                </button>
                <button
                  type="button"
                  className="iconbtn"
                  aria-label={`Move step ${index + 1} down`}
                  disabled={index === steps.length - 1}
                  onClick={() => moveStep(step.uid, 1)}
                >
                  <Icon name="chevron" size={16} className="icon-down" />
                </button>
                <button
                  type="button"
                  className="iconbtn"
                  aria-label={`Delete step ${index + 1}`}
                  onClick={() => removeStep(step.uid)}
                >
                  <Icon name="minus" size={16} />
                </button>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn--quiet btn--sm btn--block" onClick={() => addStep()}>
          <Icon name="plus" size={15} />
          Add step
        </button>
        <p className="field__hint">Paste a list of steps into any box and each line becomes its own step.</p>
      </div>

      {error ? <p className="notice notice--bad">{error}</p> : null}

      <button className="btn btn--primary btn--block" type="submit" disabled={pending}>
        {pending ? "Saving…" : recipe ? "Save recipe" : mealId ? "Save and attach to meal" : "Save recipe"}
      </button>
    </form>
  );
}

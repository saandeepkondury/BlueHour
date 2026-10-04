"use client";

import { useTransition } from "react";
import { removeRecipe } from "@/app/actions";

export function DeleteRecipeButton({ id, name }: { id: number; name: string }) {
  const [pending, start] = useTransition();

  function destroy() {
    if (!window.confirm(`Delete ${name}? Meals that used it keep their photos.`)) return;
    const data = new FormData();
    data.set("id", String(id));
    start(() => removeRecipe(data));
  }

  return (
    <button type="button" className="btn btn--danger btn--sm btn--block" disabled={pending} onClick={destroy}>
      {pending ? "Deleting…" : "Delete recipe"}
    </button>
  );
}

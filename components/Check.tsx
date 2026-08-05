"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";

/**
 * A tick that flips immediately and reconciles when the server action returns.
 * The caller passes identity fields only; the boolean is derived here so a fast
 * double tap can never send the same value twice.
 */
export function Check({
  action,
  on,
  label,
  flag,
  fields,
}: {
  action: (formData: FormData) => Promise<void>;
  on: boolean;
  label: string;
  flag: string;
  fields: Record<string, string | number>;
}) {
  const [busy, start] = useTransition();
  const [local, setLocal] = useState(on);

  useEffect(() => {
    setLocal(on);
  }, [on]);

  function toggle() {
    const next = !local;
    setLocal(next);

    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
    data.set(flag, next ? "1" : "0");

    start(() => action(data));
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={local}
      aria-label={label}
      className={`check${local ? " check--on" : ""}${busy ? " check--busy" : ""}`}
      onClick={toggle}
    >
      <span className="check__box">
        <Icon name="check" size={14} strokeWidth={2.6} />
      </span>
    </button>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { Ring } from "@/components/Ring";

/**
 * Hydration is the most-tapped control in the app, so it reads and writes
 * without a round trip: the ring moves on tap and the write follows.
 */
export function WaterCard({
  action,
  date,
  ounces,
  target,
}: {
  action: (formData: FormData) => Promise<void>;
  date: string;
  ounces: number;
  target: number;
}) {
  const [, start] = useTransition();
  const [local, setLocal] = useState(ounces);

  useEffect(() => {
    setLocal(ounces);
  }, [ounces]);

  function add(oz: number) {
    const next = Math.max(0, local + oz);
    if (next === local) return;
    setLocal(next);

    const data = new FormData();
    data.set("date", date);
    data.set("oz", String(oz));
    start(() => action(data));
  }

  const pct = target > 0 ? (local / target) * 100 : 0;

  return (
    <div className="card">
      <div className="row-between">
        <div>
          <p className="tile__label">
            <Icon name="water" size={14} />
            Water
          </p>
          <p className="tile__value" style={{ marginTop: "0.3rem" }}>
            {local}
            <small>/ {target} oz</small>
          </p>
        </div>
        <Ring
          pct={pct}
          tone={pct >= 100 ? "good" : "accent"}
          size={64}
          thickness={6}
          value={`${Math.min(999, Math.round(pct))}%`}
          label={`${local} of ${target} ounces`}
        />
      </div>

      <div className="btnrow btnrow--split" style={{ marginTop: "0.875rem" }}>
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => add(-8)}>
          <Icon name="minus" size={15} />8
        </button>
        {[8, 16, 24].map((oz) => (
          <button className="btn btn--ghost btn--sm" type="button" key={oz} onClick={() => add(oz)}>
            <Icon name="plus" size={15} />
            {oz}
          </button>
        ))}
      </div>
    </div>
  );
}

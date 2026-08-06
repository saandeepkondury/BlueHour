"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { Ring } from "@/components/Ring";
import { CUP_OZ } from "@/lib/notify/water";

/**
 * Hydration is the most-tapped control in the app, so it reads and writes
 * without a round trip: the ring moves on tap and the write follows.
 */
export function WaterCard({
  action,
  date,
  ounces,
  target,
  historyHref = "/water",
}: {
  action: (formData: FormData) => Promise<void>;
  date: string;
  ounces: number;
  target: number;
  /** Link the Water label to history. Pass null on the history page itself. */
  historyHref?: string | null;
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
  const cups = local / CUP_OZ;
  const targetCups = target / CUP_OZ;
  const cupsLabel = Number.isInteger(cups) ? String(cups) : cups.toFixed(1);
  const targetLabel = Number.isInteger(targetCups) ? String(targetCups) : targetCups.toFixed(1);

  const label = (
    <>
      <Icon name="water" size={14} />
      Water
    </>
  );

  return (
    <div className="card">
      <div className="row-between">
        <div>
          {historyHref ? (
            <Link className="tile__label" href={historyHref} style={{ textDecoration: "none" }}>
              {label}
            </Link>
          ) : (
            <p className="tile__label">{label}</p>
          )}
          <p className="tile__value" style={{ marginTop: "0.3rem" }}>
            {cupsLabel}
            <small>/ {targetLabel} cups</small>
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
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => add(-CUP_OZ)}>
          <Icon name="minus" size={15} />1 cup
        </button>
        <button className="btn btn--primary btn--sm" type="button" onClick={() => add(CUP_OZ)}>
          <Icon name="plus" size={15} />1 cup
        </button>
      </div>
    </div>
  );
}

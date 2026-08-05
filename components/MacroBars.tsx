interface Row {
  label: string;
  value: number;
  target: number;
  unit: string;
}

export function MacroBars({ rows }: { rows: Row[] }) {
  return (
    <div>
      {rows.map((row) => {
        const pct = row.target === 0 ? 0 : Math.round((row.value / row.target) * 100);
        const over = pct > 108;
        const hit = pct >= 92 && !over;

        return (
          <div className="meter" key={row.label}>
            <div className="meter__head">
              <span className="meter__name">{row.label}</span>
              <span className="meter__read">
                {Math.round(row.value)} / {row.target} {row.unit}
              </span>
            </div>
            <div
              className="meter__track"
              role="meter"
              aria-valuenow={Math.round(row.value)}
              aria-valuemin={0}
              aria-valuemax={row.target}
              aria-label={`${row.label}: ${Math.round(row.value)} of ${row.target} ${row.unit}`}
            >
              <div
                className={`meter__fill${over ? " meter__fill--over" : hit ? " meter__fill--good" : ""}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

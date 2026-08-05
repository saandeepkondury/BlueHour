interface Row {
  label: string;
  value: number;
  target: number;
  unit: string;
}

export function MacroBars({ rows }: { rows: Row[] }) {
  return (
    <div className="bars">
      {rows.map((row) => {
        const pct = row.target === 0 ? 0 : Math.round((row.value / row.target) * 100);
        const over = pct > 108;
        return (
          <div className="bar-row" key={row.label}>
            <div className="bar-head">
              <strong>{row.label}</strong>
              <span>
                {Math.round(row.value)} / {row.target} {row.unit}
              </span>
            </div>
            <div
              className="bar-track"
              role="meter"
              aria-valuenow={Math.round(row.value)}
              aria-valuemin={0}
              aria-valuemax={row.target}
              aria-label={`${row.label}: ${Math.round(row.value)} of ${row.target} ${row.unit}`}
            >
              <div
                className={over ? "bar-fill bar-fill--over" : "bar-fill"}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

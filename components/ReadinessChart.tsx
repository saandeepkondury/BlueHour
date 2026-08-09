import type { ReadinessDay } from "@/lib/health/read";

/**
 * Soft area + line chart of daily race-readiness scores.
 * Chronological left → right; empty days leave a gap in the line.
 */
export function ReadinessChart({
  days,
}: {
  /** Newest-first from getReadinessHistory — reversed for the plot. */
  days: ReadinessDay[];
}) {
  const chronological = [...days].reverse();
  const scored = chronological.filter((day) => day.score !== null);

  if (scored.length === 0) {
    return (
      <div className="readiness-chart readiness-chart--empty" role="img" aria-label="No readiness scores yet">
        <p className="small muted">Scores appear once sleep, heart rate, or runs land.</p>
      </div>
    );
  }

  const width = 320;
  const height = 168;
  const padX = 8;
  const padTop = 14;
  const padBottom = 22;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;

  const n = Math.max(1, chronological.length - 1);
  const xAt = (index: number) => padX + (index / n) * plotW;
  const yAt = (score: number) => padTop + plotH - (score / 100) * plotH;

  const points = chronological
    .map((day, index) =>
      day.score === null ? null : { x: xAt(index), y: yAt(day.score), score: day.score, date: day.date },
    )
    .filter((point): point is { x: number; y: number; score: number; date: string } => point !== null);

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const area =
    points.length > 0
      ? `${line} L${points[points.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L${points[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : "";

  const bandY = (score: number) => yAt(score);
  const first = chronological[0];
  const last = chronological[chronological.length - 1];
  const latest = points[points.length - 1];

  return (
    <div className="readiness-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Race readiness from ${first.date} to ${last.date}`}
        className="readiness-chart__svg"
      >
        <defs>
          <linearGradient id="readinessFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Reference bands: building / on track / race ready */}
        <line
          x1={padX}
          x2={width - padX}
          y1={bandY(56)}
          y2={bandY(56)}
          className="readiness-chart__guide"
        />
        <line
          x1={padX}
          x2={width - padX}
          y1={bandY(75)}
          y2={bandY(75)}
          className="readiness-chart__guide readiness-chart__guide--good"
        />
        <text x={width - padX} y={bandY(75) - 4} className="readiness-chart__guide-label" textAnchor="end">
          Race ready
        </text>
        <text x={width - padX} y={bandY(56) - 4} className="readiness-chart__guide-label" textAnchor="end">
          On track
        </text>

        {area ? <path d={area} fill="url(#readinessFill)" /> : null}
        {line ? (
          <path
            d={line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {points.length <= 60
          ? points.map((point) => (
              <circle
                key={point.date}
                cx={point.x}
                cy={point.y}
                r={points.length <= 24 ? 3.2 : 2.2}
                className="readiness-chart__dot"
              />
            ))
          : null}

        {latest ? (
          <circle cx={latest.x} cy={latest.y} r={5} className="readiness-chart__dot readiness-chart__dot--now" />
        ) : null}
      </svg>
    </div>
  );
}

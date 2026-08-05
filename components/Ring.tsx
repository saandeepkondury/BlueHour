const TONE_COLOR = {
  accent: "var(--accent)",
  good: "var(--good)",
  warn: "var(--warn)",
  bad: "var(--bad)",
} as const;

export type RingTone = keyof typeof TONE_COLOR;

/** A single progress arc with whatever you put in the middle. */
export function Ring({
  pct,
  size = 76,
  thickness = 7,
  tone = "accent",
  value,
  caption,
  label,
}: {
  pct: number;
  size?: number;
  thickness?: number;
  tone?: RingTone;
  value?: React.ReactNode;
  caption?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (clamped / 100) * circumference;

  return (
    <div
      className="ring"
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--canvas-sunk)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_COLOR[tone]}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      {value !== undefined || caption ? (
        <div className="ring__center">
          {value !== undefined ? <span className="ring__num">{value}</span> : null}
          {caption ? <span className="ring__cap">{caption}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

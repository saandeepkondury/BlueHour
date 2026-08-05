import { BrandMark } from "@/components/Brand";
import { Ring } from "@/components/Ring";
import { daysBetween, formatShort } from "@/lib/date";
import { PHASE_LABEL, type Phase } from "@/lib/plan/types";

/** The one drawing in the app: a Hill Country ridge, flat and thin. */
function Ridge() {
  return (
    <svg className="hero__ridge" viewBox="0 0 1200 70" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 54 C90 46 150 50 230 36 C330 18 400 28 520 14 C640 0 720 18 860 8 C980 0 1080 12 1200 6 L1200 70 L0 70 Z"
        fill="var(--accent-wash)"
      />
      <path
        d="M0 54 C90 46 150 50 230 36 C330 18 400 28 520 14 C640 0 720 18 860 8 C980 0 1080 12 1200 6"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.45"
      />
    </svg>
  );
}

export function TodayHero({
  today,
  raceDate,
  raceName,
  phase,
  week,
  totalWeeks,
}: {
  today: string;
  raceDate: string;
  raceName: string;
  phase: Phase;
  week: number;
  totalWeeks: number;
}) {
  const days = daysBetween(today, raceDate);
  const isRaceDay = days === 0;
  const past = days < 0;
  const blockPct = totalWeeks > 0 ? (week / totalWeeks) * 100 : 0;

  return (
    <header className="hero">
      <div className="hero__top">
        <div>
          <span className="brandrow">
            <BrandMark size={20} />
            <span className="label">
              {past ? "Ran it" : isRaceDay ? "Race day" : "To the start"}
            </span>
          </span>
          <p className="hero__num">
            {past ? "13.1" : days}
            <span>{past ? "miles done" : isRaceDay ? "go" : days === 1 ? "day" : "days"}</span>
          </p>
          <p className="hero__meta">
            {raceName} · {formatShort(raceDate)} · 7:00 AM
          </p>
        </div>

        {!past && totalWeeks > 0 ? (
          <Ring
            pct={blockPct}
            size={72}
            thickness={7}
            value={week}
            caption={`of ${totalWeeks}`}
            label={`Week ${week} of ${totalWeeks}`}
          />
        ) : null}
      </div>

      {!past && !isRaceDay ? (
        <p style={{ marginTop: "0.6rem" }}>
          <span className="pill pill--accent">{PHASE_LABEL[phase]}</span>
        </p>
      ) : null}

      <Ridge />
    </header>
  );
}

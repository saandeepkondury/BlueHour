import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/Brand";
import { daysBetween, formatLong } from "@/lib/date";
import { PHASE_LABEL, type Phase } from "@/lib/plan/types";

/** A single Hill Country ridge line. One drawing, no runners, no clip-art. */
function RidgeLine() {
  return (
    <svg className="ridge-line" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 96 L120 78 L215 88 L330 52 L430 74 L520 60 L640 92 L760 66 L880 84 L980 58 L1080 80 L1200 68 L1200 120 L0 120 Z"
        fill="var(--limestone-deep)"
      />
      <path
        d="M0 96 L120 78 L215 88 L330 52 L430 74 L520 60 L640 92 L760 66 L880 84 L980 58 L1080 80 L1200 68"
        fill="none"
        stroke="var(--oak-soft)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.5"
      />
    </svg>
  );
}

export function RidgeHeader({
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

  return (
    <header className="ridge">
      <div className="ridge-inner">
        <Link href="/" className="ridge-brand" aria-label="Blue Hour home">
          <BrandMark size={28} />
          <Wordmark size="sm" />
        </Link>
        <p className="eyebrow">
          {past ? "You ran it" : isRaceDay ? "Today is the day" : "Days to Austin"}
        </p>
        <p className="countdown">{past ? <em>13.1</em> : isRaceDay ? <em>0</em> : <em>{days}</em>}</p>
        <p className="countdown-unit">
          {past ? "miles behind you" : isRaceDay ? "go get it" : days === 1 ? "day" : "days"}
        </p>
        <p className="race-line">
          <strong>{raceName}</strong>
          <br />
          {formatLong(raceDate)} · 7:00 AM · Congress Avenue
          {!past && !isRaceDay ? (
            <>
              <br />
              {PHASE_LABEL[phase]} · week {week} of {totalWeeks}
            </>
          ) : null}
        </p>
      </div>
      <RidgeLine />
    </header>
  );
}

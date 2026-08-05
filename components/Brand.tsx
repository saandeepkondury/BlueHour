import { useId } from "react";
import Link from "next/link";

type MarkTone = "seal" | "plain";

const CRESCENT =
  "M25.3 10.45A10.8 10.8 0 1 0 31.03 28.22A9.4 9.4 0 1 1 25.3 10.45Z";
const RIDGE =
  "M0 46.2C11 43 17 44.5 25 39.5c7-4.3 13-2 19-7.3 7-5.7 13-2.7 20-4.9V64H0Z";

/** Waxing crescent over a Hill Country ridge — blue hour as a seal. */
export function BrandMark({
  size = 32,
  tone = "seal",
  title = "Blue Hour",
}: {
  size?: number;
  tone?: MarkTone;
  title?: string;
}) {
  const clip = `bh${useId().replace(/:/g, "")}`;
  const ink = tone === "seal" ? "#f3efe6" : "#2f6d99";

  return (
    <svg
      className="brandmark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
    >
      {tone === "seal" ? (
        <>
          <defs>
            <clipPath id={clip}>
              <circle cx="32" cy="32" r="32" />
            </clipPath>
          </defs>
          <circle cx="32" cy="32" r="32" fill="#2f6d99" />
          <g clipPath={`url(#${clip})`}>
            <path fill={ink} d={CRESCENT} />
            <path fill="#e6ddd0" d={RIDGE} />
          </g>
        </>
      ) : (
        <>
          <path fill={ink} d={CRESCENT} />
          <path fill={ink} d={RIDGE} />
        </>
      )}
    </svg>
  );
}

export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`wordmark wordmark--${size}`}>
      Blue <em>Hour</em>
    </span>
  );
}

export function BrandRow({ href }: { href?: string }) {
  const inner = (
    <>
      <BrandMark size={26} />
      <Wordmark size="sm" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className="brandrow" aria-label="Blue Hour home">
        {inner}
      </Link>
    );
  }

  return <span className="brandrow">{inner}</span>;
}

export function BrandLockup() {
  return (
    <div className="brandrow brandrow--stack">
      <BrandMark size={88} />
      <Wordmark size="lg" />
    </div>
  );
}

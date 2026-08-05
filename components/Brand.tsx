import Link from "next/link";

type MarkTone = "seal" | "plain";

/** Moon over paired horizons — blue hour as a seal, not a landscape. */
export function BrandMark({
  size = 32,
  tone = "seal",
  title = "Blue Hour",
}: {
  size?: number;
  tone?: MarkTone;
  title?: string;
}) {
  const moon = tone === "seal" ? "#f3efe6" : "#3f7196";
  const ground = tone === "seal" ? "#3f7196" : "transparent";

  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
    >
      {tone === "seal" ? <circle cx="32" cy="32" r="32" fill={ground} /> : null}
      <circle cx="32" cy="25" r="8.2" fill={moon} />
      <rect x="22.5" y="39.6" width="19" height="1.5" rx="0.75" fill="#d9d0c0" />
      <rect x="19" y="44.4" width="26" height="2.6" rx="1.3" fill={moon} />
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

export function BrandBar() {
  return (
    <Link href="/" className="brand-bar" aria-label="Blue Hour home">
      <BrandMark size={28} />
      <Wordmark size="sm" />
    </Link>
  );
}

export function BrandLockup({
  size = "md",
  href,
}: {
  size?: "md" | "lg";
  href?: string;
}) {
  const mark = size === "lg" ? 72 : 40;
  const inner = (
    <>
      <BrandMark size={mark} />
      <Wordmark size={size === "lg" ? "lg" : "md"} />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`brand-lockup brand-lockup--${size}`} aria-label="Blue Hour home">
        {inner}
      </Link>
    );
  }

  return <div className={`brand-lockup brand-lockup--${size}`}>{inner}</div>;
}

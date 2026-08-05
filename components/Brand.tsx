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
      className="brandmark"
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

export function BrandRow({ href }: { href?: string }) {
  const inner = (
    <>
      <BrandMark size={24} />
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
      <BrandMark size={64} />
      <Wordmark size="lg" />
    </div>
  );
}

import Link from "next/link";
import { Icon } from "@/components/Icon";

/**
 * Compact sticky header: optional back chevron, title, and a settings entry on
 * the right. Every screen gets one so the hub is always a single tap away.
 */
export function AppBar({
  title,
  subtitle,
  back,
  pending = 0,
  action,
  edge = false,
}: {
  title: React.ReactNode;
  subtitle?: string;
  back?: string;
  pending?: number;
  action?: React.ReactNode;
  edge?: boolean;
}) {
  return (
    <header className={edge ? "appbar appbar--edge" : "appbar"}>
      {back ? (
        <Link className="iconbtn" href={back} aria-label="Back">
          <Icon name="back" size={22} />
        </Link>
      ) : null}
      <h1 className="appbar__title">
        {title}
        {subtitle ? <span className="appbar__sub">{subtitle}</span> : null}
      </h1>
      {action ?? (
        <Link className="iconbtn" href="/more" aria-label="More and settings">
          <Icon name="settings" size={21} />
          {pending > 0 ? <span className="iconbtn__dot">{pending}</span> : null}
        </Link>
      )}
    </header>
  );
}

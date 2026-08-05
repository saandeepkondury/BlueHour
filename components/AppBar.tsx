import { BackButton, MoreLink } from "@/components/MoreNav";

/**
 * Compact sticky header: optional back chevron, title, and a hub entry on the
 * right so every screen can reach the full page list in one tap.
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
      {back ? <BackButton href={back} /> : null}
      <h1 className="appbar__title">
        {title}
        {subtitle ? <span className="appbar__sub">{subtitle}</span> : null}
      </h1>
      {action ?? <MoreLink pending={pending} />}
    </header>
  );
}

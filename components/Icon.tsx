/**
 * One stroked icon set at a single weight, so the UI never mixes visual
 * languages. Every glyph is drawn on a 24 grid and inherits `currentColor`.
 */

export type IconName =
  | "today"
  | "calendar"
  | "fuel"
  | "body"
  | "coach"
  | "settings"
  | "grid"
  | "chevron"
  | "back"
  | "check"
  | "plus"
  | "minus"
  | "run"
  | "rest"
  | "cross"
  | "strength"
  | "water"
  | "moon"
  | "heart"
  | "pulse"
  | "flame"
  | "clock"
  | "cart"
  | "pill"
  | "flag"
  | "watch"
  | "chart"
  | "shuffle"
  | "bell"
  | "sync"
  | "person";

const PATHS: Record<IconName, React.ReactNode> = {
  person: (
    <>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.75 20c.9-3.9 3.8-6 7.25-6s6.35 2.1 7.25 6" />
    </>
  ),
  today: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10.5V20h12v-9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8.5 3.5V6M15.5 3.5V6" />
      <path d="M8 14h2.5M13.5 14H16" />
    </>
  ),
  fuel: (
    <>
      <path d="M7 3.5v7a2.5 2.5 0 0 0 5 0v-7" />
      <path d="M9.5 13v7.5" />
      <path d="M17 3.5c1.6 1.2 2.2 3 2.2 5.2 0 1.7-.7 2.8-2.2 3.3v8.5" />
    </>
  ),
  body: (
    <>
      <circle cx="12" cy="5" r="2.2" />
      <path d="M12 7.5v5m0 0-3 8m3-8 3 8" />
      <path d="M6.5 10.5 12 12l5.5-1.5" />
    </>
  ),
  coach: (
    <path d="M4.8 5.6h10.4A3.2 3.2 0 0 1 18.4 8.8v5.2a3.2 3.2 0 0 1-3.2 3.2H9.6L6 20.4l.7-3.2H4.8A3.2 3.2 0 0 1 1.6 14V8.8A3.2 3.2 0 0 1 4.8 5.6z" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </>
  ),
  chevron: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  back: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  check: <path d="M5.5 12.5 10 17l8.5-9.5" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  minus: <path d="M5.5 12h13" />,
  run: (
    <>
      <path d="M3.5 16.2c0-1.4 1.1-2.4 3.1-2.4h8.2c1.9 0 3.4.8 4.3 2.2l.9 1.5H6.2z" />
      <path d="M7 13.8V11.4c0-1.1.7-1.9 1.9-1.9h3.4" />
      <path d="M14.2 13.8c.7-.7 1.7-1.1 2.8-.9" />
      <path d="M5.2 17.5h12.6" />
    </>
  ),
  rest: (
    <>
      <path d="M3.5 16.5v-3a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v3" />
      <path d="M3.5 16.5h17" />
      <path d="M7 11.5V9a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 17 9v2.5" />
    </>
  ),
  cross: (
    <>
      <circle cx="6" cy="17.5" r="2.8" />
      <circle cx="18" cy="17.5" r="2.8" />
      <path d="M8.5 17.5h6.5l-3.5-7 4-2" />
      <path d="M11 8.5h4" />
    </>
  ),
  strength: (
    <>
      <path d="M4 9.5v5M7 7.5v9M17 7.5v9M20 9.5v5" />
      <path d="M7 12h10" />
    </>
  ),
  water: (
    <>
      <path d="M12 3.5s5.5 6 5.5 10a5.5 5.5 0 0 1-11 0c0-4 5.5-10 5.5-10z" />
      <path d="M9.2 14.5a2.8 2.8 0 0 0 2.8 2.8" />
    </>
  ),
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />,
  heart: (
    <path d="M12 19.5S4.5 15 4.5 9.8A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7.5 1.8c0 5.2-7.5 9.7-7.5 9.7z" />
  ),
  pulse: <path d="M3 12.5h3.5L9 7l3 10 2.5-5.5H21" />,
  flame: (
    <>
      <path d="M12 3.5c3 3.5 5 6 5 9a5 5 0 0 1-10 0c0-1.7.8-3 2-4.5" />
      <path d="M12 20a2.5 2.5 0 0 0 2.5-2.5c0-1.4-2.5-3.5-2.5-3.5s-2.5 2.1-2.5 3.5A2.5 2.5 0 0 0 12 20z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.3" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  cart: (
    <>
      <path d="M3.5 4.5h2l2.3 10h9.4l1.8-7H6.5" />
      <circle cx="9" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
    </>
  ),
  pill: (
    <>
      <rect x="3.5" y="8.5" width="17" height="7" rx="3.5" />
      <path d="M12 8.5v7" />
    </>
  ),
  flag: (
    <>
      <path d="M6 3.5v17" />
      <path d="M6 4.5h11l-1.8 4L17 12.5H6" />
    </>
  ),
  watch: (
    <>
      <rect x="7" y="6.5" width="10" height="11" rx="3" />
      <path d="M9.5 6.5 9 3.5h6l-.5 3M9.5 17.5 9 20.5h6l-.5-3" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 20v-6M12.5 20v-9M17 20v-4" />
    </>
  ),
  shuffle: (
    <>
      <path d="M4 7h4l8 10h4M4 17h4l2-2.5M14 9.5 16 7h4" />
      <path d="M18 4.5 20.5 7 18 9.5M18 14.5 20.5 17 18 19.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z" />
      <path d="M10 19.5a2 2 0 0 0 4 0" />
    </>
  ),
  sync: (
    <>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.4-5.7L19 8.5" />
      <path d="M19.5 4.5v4h-4" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.4 5.7L5 15.5" />
      <path d="M5 19.5v-4h4" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/**
 * Talks to the iPhone shell. A no-op in the browser. Stars and cups on the
 * Habits page post `reloadWidgets` so the home screen card refetches the same
 * payload; the shell calls `__blueHourOnWidget` when the widget writes first.
 */
declare global {
  interface Window {
    __BLUE_HOUR_NATIVE__?: boolean;
    __blueHourOnSync?: (payload: { ok: boolean; message: string }) => void;
    __blueHourOnWidget?: () => void;
    webkit?: {
      messageHandlers?: {
        blueHour?: { postMessage: (message: unknown) => void };
      };
    };
  }
}

export function pingNative(action: string): void {
  if (typeof window === "undefined") return;
  window.webkit?.messageHandlers?.blueHour?.postMessage({ action });
}

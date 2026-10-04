"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pingNative } from "@/lib/native";

/**
 * Keeps the Habits page card and the home screen widget on the same snapshot.
 * The shell injects `__blueHourOnWidget` after a widget tap; coming back to
 * the tab both refreshes this page and asks the widget to refetch.
 */
export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();
    window.__blueHourOnWidget = refresh;

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      refresh();
      pingNative("reloadWidgets");
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (window.__blueHourOnWidget === refresh) delete window.__blueHourOnWidget;
    };
  }, [router]);

  return null;
}

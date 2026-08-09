"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type Status = "idle" | "syncing" | "done" | "missing-app";

declare global {
  interface Window {
    __BLUE_HOUR_NATIVE__?: boolean;
    __blueHourOnSync?: (payload: { ok: boolean; message: string }) => void;
    webkit?: {
      messageHandlers?: {
        blueHour?: { postMessage: (message: unknown) => void };
      };
    };
  }
}

function hasNativeBridge(): boolean {
  return Boolean(window.__BLUE_HOUR_NATIVE__ || window.webkit?.messageHandlers?.blueHour);
}

/** Compact Health sync for the Today session card. */
export function WatchSyncControl({ label = "Sync Watch" }: { label?: string }) {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    window.__blueHourOnSync = (payload) => {
      setStatus(payload.ok ? "done" : "idle");
      if (payload.ok) {
        // Pull the fresh HealthKit log into the server-rendered card.
        window.setTimeout(() => window.location.reload(), 400);
      }
    };
    return () => {
      delete window.__blueHourOnSync;
    };
  }, []);

  function sync() {
    if (hasNativeBridge()) {
      setStatus("syncing");
      window.webkit?.messageHandlers?.blueHour?.postMessage({ action: "syncHealth" });
      return;
    }

    setStatus("syncing");
    window.location.href = "bluehour://sync";
    window.setTimeout(() => {
      setStatus((current) => (current === "syncing" ? "missing-app" : current));
    }, 1600);
  }

  const text =
    status === "syncing" ? "Syncing…" : status === "done" ? "Synced" : label;

  return (
    <div className="stack" style={{ gap: "0.35rem" }}>
      <button
        className="btn btn--primary btn--block"
        type="button"
        onClick={sync}
        disabled={status === "syncing" || status === "done"}
      >
        <Icon name="sync" size={16} />
        {text}
      </button>
      {status === "missing-app" ? (
        <p className="small muted">
          Open the Blue Hour iPhone app so it can pull the workout from Apple Health.
        </p>
      ) : null}
    </div>
  );
}

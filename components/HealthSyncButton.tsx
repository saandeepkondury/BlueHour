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

export function HealthSyncButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    window.__blueHourOnSync = (payload) => {
      setStatus(payload.ok ? "done" : "idle");
      setMessage(payload.message);
    };
    return () => {
      delete window.__blueHourOnSync;
    };
  }, []);

  function sync() {
    setMessage(null);

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

  const label =
    status === "syncing" ? "Syncing…" : status === "done" ? "Synced" : "Sync from Apple Health";

  return (
    <div className="stack">
      <button
        className="btn btn--primary btn--block"
        type="button"
        onClick={sync}
        disabled={status === "syncing"}
      >
        <Icon name="sync" size={16} />
        {label}
      </button>
      {message ? (
        <p className={`notice ${status === "done" ? "notice--good" : "notice--bad"}`}>{message}</p>
      ) : null}
      {status === "missing-app" ? (
        <p className="small muted">
          Open the Blue Hour iPhone app — not Safari — to pull sleep, heart rate, and runs from
          Apple Health. It also syncs on its own every time you open the app.
        </p>
      ) : (
        <p className="small muted">
          Syncs automatically when you open Blue Hour. Tap if a run or last night’s sleep has not
          shown up yet.
        </p>
      )}
    </div>
  );
}

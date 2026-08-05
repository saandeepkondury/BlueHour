"use client";

import { useCallback, useEffect, useState } from "react";

function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

type State = "loading" | "unsupported" | "needs-install" | "off" | "on" | "denied";

export function PushToggle({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(async () => {
    if (typeof window === "undefined") return;

    const supported = "serviceWorker" in navigator && "PushManager" in window;
    if (!supported) {
      // iOS only exposes PushManager once the app is installed to the home screen.
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setState(isIOS && !standalone ? "needs-install" : "unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const existing = await registration.pushManager.getSubscription();
    setState(existing ? "on" : "off");
  }, []);

  useEffect(() => {
    sync().catch(() => setState("unsupported"));
  }, [sync]);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(vapidKey),
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) throw new Error("Subscribe failed");

      setState("on");
      setMessage("Push is on for this device.");
    } catch {
      setMessage("Could not turn on push. Check that VAPID keys are set and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("Push is off on this device.");
    } catch {
      setMessage("Could not turn push off cleanly.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/push/test", { method: "POST" });
    setMessage(response.ok ? "Test sent. Watch for the notification." : "Test failed to send.");
    setBusy(false);
  }

  if (!vapidKey) {
    return (
      <p className="small muted">
        Web push needs VAPID keys. Run <code>npm run keys:vapid</code> and add them to your
        environment, then reload this page.
      </p>
    );
  }

  return (
    <div>
      {message ? <p className="ok">{message}</p> : null}

      {state === "loading" ? <p className="small muted">Checking this device…</p> : null}

      {state === "needs-install" ? (
        <p className="small muted">
          On iPhone, push only works once Blue Hour is installed: tap Share, then{" "}
          <strong>Add to Home Screen</strong>, open it from there, and come back to this screen.
        </p>
      ) : null}

      {state === "unsupported" ? (
        <p className="small muted">
          This browser will not do web push. Install Blue Hour on your phone for morning reminders.
        </p>
      ) : null}

      {state === "denied" ? (
        <p className="small muted">
          Notifications are blocked for this site. Allow them in browser settings, then reload.
        </p>
      ) : null}

      <div className="btn-row" style={{ marginTop: message ? "0.5rem" : 0 }}>
        {state === "off" ? (
          <button className="btn" type="button" onClick={enable} disabled={busy}>
            Turn on push
          </button>
        ) : null}
        {state === "on" ? (
          <>
            <button className="btn btn--ghost btn--small" type="button" onClick={test} disabled={busy}>
              Send a test
            </button>
            <button className="btn btn--ghost btn--small" type="button" onClick={disable} disabled={busy}>
              Turn off push
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

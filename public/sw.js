const SHELL_CACHE = "blue-hour-shell-v1";
const WATER_LOG_ACTION = "log-cup";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(["/icon.svg", "/manifest.webmanifest"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// Network-first: training data changes constantly, so a stale page is worse than a spinner.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      return new Response("Offline — reconnect to load today's plan.", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Blue Hour";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "Today's run is waiting.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: payload.tag || "daily-brief",
      actions: payload.actions || [],
      data: {
        url: payload.url || "/",
        date: payload.date || null,
        tag: payload.tag || "daily-brief",
      },
    }),
  );
});

async function logCupFromNotification(data) {
  const body = { oz: 8 };
  if (data && typeof data.date === "string") body.date = data.date;

  const response = await fetch("/api/water/log", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await self.registration.showNotification("Could not log water", {
      body: "Open Blue Hour and tap +1 cup on Today.",
      tag: "water-log-fail",
      data: { url: "/" },
    });
    return;
  }

  const result = await response.json().catch(() => ({}));
  const oz = typeof result.waterOz === "number" ? result.waterOz : null;
  await self.registration.showNotification("Cup logged", {
    body: oz !== null ? `${oz} oz so far today.` : "One cup added.",
    tag: "water-log-ok",
    data: { url: "/water" },
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === WATER_LOG_ACTION) {
    event.waitUntil(logCupFromNotification(event.notification.data));
    return;
  }

  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});

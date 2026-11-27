/*
 * Imported into the generated service worker (see vite.config.ts → workbox.importScripts).
 *
 * When a NEW service worker takes over from an old one, reload every open window so members
 * land on the new version without clearing site data. First-time installs are skipped.
 */
let hadPreviousWorker = false;

self.addEventListener("install", () => {
  // During an update, `active` is still the old worker; on a first install it is null.
  hadPreviousWorker = !!self.registration.active;
});

self.addEventListener("activate", (event) => {
  if (!hadPreviousWorker) return;
  event.waitUntil(
    // Client#navigate() only works on windows this worker controls, so take control first.
    self.clients
      .claim()
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((windows) => {
        // Fire-and-forget on purpose: the reloaded page's requests wait for this worker to finish
        // activating, so awaiting navigate() inside waitUntil would deadlock.
        windows.forEach((w) => {
          if ("navigate" in w) w.navigate(w.url).catch(() => {});
        });
      })
  );
});

const CACHE_NAME = "femic-gpt-v8-7";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css?v=8.7",
  "./js/app.js?v=8.7",
  "./js/agents.js",
  "./js/api.js",
  "./js/archiveStorage.js",
  "./js/audio.js",
  "./js/brands.js",
  "./js/brasilApi.js",
  "./js/chat.js",
  "./js/communicationStorage.js",
  "./js/costTracker.js",
  "./js/editor-service.js",
  "./js/emailService.js",
  "./js/exportManager.js",
  "./js/fileProcessor.js",
  "./js/instagramCreator.js",
  "./js/memory.js",
  "./js/messagePayload.js",
  "./js/pdf.js",
  "./js/pubmed.js",
  "./js/reportGenerator.js",
  "./js/storage.js",
  "./js/supabaseSync.js",
  "./js/taskSystem.js",
  "./js/templates-service.js",
  "./js/ui-editor.js",
  "./js/ui.js",
  "./js/usageTracker.js",
  "./js/voiceController.js",
  "./js/whatsappService.js",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isAppAsset = url.origin === self.location.origin && (
    event.request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css")
  );

  if (isAppAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
        throw new Error("Offline");
      });
    })
  );
});

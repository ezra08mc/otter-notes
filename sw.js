const CACHE_NAME = "otter-notes-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./otter-logo.png",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        );
      }),
    ]),
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            const cacheCopy = networkResponse.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(e.request, cacheCopy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);
      return cachedResponse || fetchPromise;
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        if (clientList.length > 0) {
          let client = clientList[0];
          for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].focused) client = clientList[i];
          }
          return client.focus();
        }
        return clients.openWindow("./");
      }),
  );
});

self.addEventListener("push", (e) => {
  const data = e.data
    ? e.data.json()
    : { title: "Notifikasi Baru", body: "Anda memiliki pesan baru." };
  const title = data.title || "Otter Notes";
  const options = {
    body: data.body || "",
    icon: "otter-logo.png",
    badge: "otter-logo.png",
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

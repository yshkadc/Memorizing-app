// オフライン用キャッシュ。ファイルを更新したら VERSION を上げる
const VERSION = 'v1';
const CACHE = 'topik-cards-' + VERSION;
const FILES = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/app.js', './js/store.js', './js/srs.js', './js/seed.js', './js/extract.js',
  './js/vendor/anthropic-sdk.js', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // ネット優先・失敗したらキャッシュ（更新がすぐ反映されるように）
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});

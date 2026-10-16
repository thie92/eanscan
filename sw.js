/* Barcode in TXT: uso senza rete.
   Pagina e icone: prima la rete, poi la copia salvata. Librerie e font da CDN: prima la copia salvata.
   Per forzare l'aggiornamento della copia salvata basta cambiare VERSION. */
const VERSION = 'v5';
const CORE = 'core-' + VERSION;
const RUNTIME = 'runtime-' + VERSION;
const CORE_FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
const CDN = /(^|\.)(jsdelivr\.net|googleapis\.com|gstatic\.com)$/;

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CORE)
      .then(function (c) { return c.addAll(CORE_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CORE && k !== RUNTIME; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function withTimeout(promise, ms) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
    promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  if (url.origin === self.location.origin) {
    var netReq = req.mode === 'navigate'
      ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      : new Request(req, { cache: 'no-cache' });
    event.respondWith(
      withTimeout(fetch(netReq), 4000)
        .then(function (res) {
          if (res.ok) { var copy = res.clone(); caches.open(CORE).then(function (c) { c.put(req, copy); }); }
          return res;
        })
        .catch(function () {
          return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('index.html'); });
        })
    );
    return;
  }

  if (CDN.test(url.hostname)) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          if (res.ok || res.type === 'opaque') { var copy = res.clone(); caches.open(RUNTIME).then(function (c) { c.put(req, copy); }); }
          return res;
        });
      })
    );
  }
});

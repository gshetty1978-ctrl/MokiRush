/* MOKI service worker.
 *
 * Deliberately network-first for everything: MOKI is a live multiplayer game
 * that redeploys often, and a stale cached app talking to a newer server is
 * worse than a slightly slower load. The cache is only a fallback for when the
 * network is unavailable, so an installed MOKI still opens on a flaky link.
 *
 * Socket.IO traffic is never cached - it must always hit the network.
 */
var VERSION = 'moki-v3';
var SHELL = [
  '/',
  '/css/style.css',
  '/css/game.css',
  '/js/app.js',
  '/js/moki-catalog.js',
  '/js/moki-render.js',
  '/js/qr.js',
  '/fonts/baloo2-latin.woff2',
  '/icons/moki-192.png',
  '/favicon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* a missing file must not block installation */ })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === VERSION ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/socket.io/') === 0) return;   // live traffic
  if (url.pathname.indexOf('/api/') === 0) return;         // never serve stale game data

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match('/');
      });
    })
  );
});

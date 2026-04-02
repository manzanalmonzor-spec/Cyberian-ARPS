const CACHE_NAME = 'arps-cache-v6';

const PRECACHE_URLS = [
  'manifest.json',
  'shared.js',
  'shared.css',
  'firebase-config.js',
  'Images/ARPLOGO.png',
  'user/home.html',
  'user/sos.html',
  'user/gps.html',
  'user/loginpage.html',
  'user/splash.html',
  'user/onboarding.html',
  'user/pending.html',
  'user/settings.html',
  'user/alerts.html',
  'user/evacuation.html',
  'user/report.html',
  'user/weather.html',
  'user/js/auth-guard.js',
  'user/js/map-common.js',
  'user/js/gps-page.js',
  'user/js/sos.js',
  'user/js/evacuation-page.js',
];

function toScopeUrl(relativePath) {
  return new URL(String(relativePath || '').replace(/^\/+/, ''), self.registration.scope).toString();
}

// External APIs — skip entirely, let them fail gracefully when offline
const SKIP_DOMAINS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'securetoken.googleapis.com',
  'identitytoolkit.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'nominatim.openstreetmap.org',
  'api.bigdatacloud.net',
  'dashboard.philsms.com',
  'api.open-meteo.com',
  'overpass-api.de',
  'maps.mail.ru',
  'overpass.kumi.systems',
  'overpass.private.coffee',
  'tile.openstreetmap.org',
  'router.project-osrm.org',
  'valhalla1.openstreetmap.de',
];

// installer ka pre cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS.map(toScopeUrl)))
      .then(() => self.skipWaiting())
  );
});

// stale cache strat kung may update sa website pero wala pa na cache ang mga new files, ipakita lang ang cached version pero pag may internet connection na, i-update ang cache para next time may update na siya  
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // ga handle lang sang GET requests kag mga http(s) nga requests, indi niya i-handle ang mga non-GET or data URIs or chrome-extension:// etc. nga requests
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  const { hostname } = new URL(req.url);

  // Skip external APIs — allow them to fail naturally (Firebase handles its own offline)
  if (SKIP_DOMAINS.some(d => hostname.includes(d))) return;

  // for design nga kung mag offline di ma damage ang designs
  const isCDN = [
    'cdn.tailwindcss.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'gstatic.com',
    'unpkg.com',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
  ].some(d => hostname.includes(d));

  if (isCDN) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(req);
        const networkFetch = fetch(req)
          .then(res => {
            if (res.ok) {
              const responseToCache = res.clone();
              cache.put(req, responseToCache);
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Network-first for local app files: always try to get fresh code,
  // fall back to cache only when offline.
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const responseToCache = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, responseToCache));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

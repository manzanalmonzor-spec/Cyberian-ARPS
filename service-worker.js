const CACHE_NAME = 'arps-cache-v7';

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
  'user/js/ban-guard.js',
  'user/js/heartbeat.js',
  'user/js/map-common.js',
  'user/js/gps-page.js',
  'user/js/sos.js',
  'user/js/evacuation-page.js',
];

function toScopeUrl(relativePath) {
  return new URL(String(relativePath || '').replace(/^\/+/, ''), self.registration.scope).toString();
}


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


self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS.map(toScopeUrl)))
      .then(() => self.skipWaiting())
  );
});


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


  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  const { hostname } = new URL(req.url);


  if (SKIP_DOMAINS.some(d => hostname.includes(d))) return;


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

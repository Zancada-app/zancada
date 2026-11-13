// Zancada: guarda la app en el móvil para que abra sin conexión.
// Las peticiones a Strava, al proxy y al tiempo nunca se guardan en caché.
// Al añadir o quitar archivos de la app, actualiza SHELL y sube la versión de CACHE
// (tests/check-sw.cjs avisa si falta alguno).
const CACHE = 'zancada-v17';
const SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './css/app.css',
    './js/core/store.js',
    './js/core/util.js',
    './js/main.js',
    './js/model/activities.js',
    './js/model/adapt.js',
    './js/model/analysis.js',
    './js/model/calendar.js',
    './js/model/constants.js',
    './js/model/cycle.js',
    './js/model/elevation.js',
    './js/model/finish.js',
    './js/model/goal.js',
    './js/model/guide.js',
    './js/model/heartrate.js',
    './js/model/load.js',
    './js/model/marks.js',
    './js/model/plan.js',
    './js/model/readiness.js',
    './js/model/shoes.js',
    './js/model/strength.js',
    './js/model/weather.js',
    './js/model/weekly.js',
    './js/model/workouts.js',
    './js/model/xtrain.js',
    './js/services/gps.js',
    './js/services/strava.js',
    './js/services/voice.js',
    './js/services/weather.js',
    './js/ui/actions.js',
    './js/ui/blocks.js',
    './js/ui/cards.js',
    './js/ui/charts.js',
    './js/ui/checkin.js',
    './js/ui/cycle.js',
    './js/ui/dom.js',
    './js/ui/events.js',
    './js/ui/guide.js',
    './js/ui/pickers.js',
    './js/ui/router.js',
    './js/ui/screens/hoy.js',
    './js/ui/screens/manual.js',
    './js/ui/screens/perfil.js',
    './js/ui/screens/plan.js',
    './js/ui/screens/progreso.js',
    './js/ui/screens/wizard.js',
    './js/ui/screens/zonas.js',
    './js/ui/shoes.js',
    './js/ui/strength.js',
    './js/ui/toast.js',
    './js/ui/xtrain.js',
    './icons/apple-touch-icon.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-192.png',
    './icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // servicios externos: directo a la red
  // Primero la red (para recibir actualizaciones); si no hay conexión, la copia guardada.
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, {ignoreSearch: true})
      .then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});

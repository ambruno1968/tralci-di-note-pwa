/* Service worker di Tralci di note: funzionamento offline dell'app. */
const CACHE = 'tralci-di-note-v3.0.2';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'pwa.js', 'localDbEngine.js', 'driveClient.js',
  'printTemplates.js', 'default-db.json', 'WIKI.md', 'logo.png', 'icon.png',
  'icon-192.png', 'icon-512.png', 'manifest.webmanifest'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Google API & GIS: sempre in rete
  // Rete prima (aggiornamenti immediati), cache come ripiego offline
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});


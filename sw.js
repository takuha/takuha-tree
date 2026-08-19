/* TIM — offline service worker
   方針:
     HTML・sync.json … network-first（更新を取りこぼさない。オフライン時だけキャッシュ）
     その他 … cache-first（アイコン等は変わらないので速さ優先）
   キャッシュ名の版を上げると古いキャッシュは activate 時に消える。 */
const VERSION = 'tim-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './theme.css',
  './app-core.js',
  './studio/',
  './studio/index.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    /* 1本でも 404 だと addAll がまるごと失敗するので個別に入れる */
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const wantsHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (url.pathname.endsWith('/sync.json')) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const c = await caches.open(VERSION);
        c.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }

  if (wantsHTML) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(VERSION);
        c.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match(req)) ||
               (await caches.match('./index.html')) ||
               Response.error();
      }
    })());
    return;
  }

  /* CSS/JS は stale-while-revalidate。
     cache-first にすると版を上げ忘れたとき古いコードが残り続けるので、
     表示は即キャッシュ・裏で取り直して次回に反映させる。 */
  if (/\.(css|js)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const hit = await c.match(req);
      const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
    return;
  }

  /* 画像などは cache-first（中身が変わらないので速さ優先） */
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      const c = await caches.open(VERSION);
      c.put(req, fresh.clone());
      return fresh;
    } catch (_) {
      return Response.error();
    }
  })());
});

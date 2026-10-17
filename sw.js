/* Medina beta: shell atómico por versión; planos conservados entre actualizaciones. */
importScripts('./offline-assets.js');
const SHELL_CACHE = 'medina-beta-shell-v0.1.90';
const PLAN_CACHE = 'medina-beta-plans-v1';
const absolute = path => new URL(path, self.registration.scope).href;
const SHELL = ['./usage-core.js','./usage.js','./asset-index.js','./van-verified.js','./qr-policy.js','./index.html','./unified-search.js','./reports.js','./offline.js','./beta.css',
  './offline-assets.js','./manifest.webmanifest','./favicon.png','./icon.svg','./icon-192.png',
  './icon-512.png','./apple-touch-icon.png','./auwa-equivalencias.js','./ct-lines.js',
  './bp-lines.js','./accumulator-traces.js','./plane-gestures.js','./chain-highlight.js'].map(absolute);
const PLANS = self.MEDINA_OFFLINE_ASSETS.map(absolute);
const planSet = new Set(PLANS), shellSet = new Set(SHELL);
let warming = null;
async function valid(response, url) {
  if (!response || !response.ok || response.redirected) return false;
  const type = response.headers.get('content-type') || '';
  if (url.endsWith('.webp')) {
    if (type.startsWith('image/')) return true;
    // Sites puede servir WebP como octet-stream. Verificamos los bytes, no una página de acceso.
    if (!type.startsWith('application/octet-stream')) return false;
    const bytes = new Uint8Array(await response.clone().arrayBuffer());
    return bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70
      && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80;
  }
  return /\.(?:json|webmanifest)$/.test(url) ? type.includes('json')
    : url.endsWith('.js') ? /javascript/.test(type)
    : url.endsWith('.css') ? type.includes('text/css')
    : url.endsWith('.html') ? type.includes('text/html') : true;
}
async function cachedCount() {
  const cache = await caches.open(PLAN_CACHE);
  return (await cache.keys()).filter(request => planSet.has(request.url)).length;
}
async function notify(data) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => client.postMessage(data));
}
async function reportStatus() {
  await notify({ type: 'OFFLINE_STATUS', saved: await cachedCount(), total: PLANS.length });
}
async function warmPlans() {
  if (warming) return warming;
  warming = (async () => {
    const cache = await caches.open(PLAN_CACHE);
    let saved = await cachedCount(), failed = 0;
    await notify({ type: 'OFFLINE_PROGRESS', saved, failed, total: PLANS.length, running: true });
    for (let i = 0; i < PLANS.length; i += 4) {
      await Promise.all(PLANS.slice(i, i + 4).map(async url => {
        if (await cache.match(url)) return;
        try {
          const response = await fetch(new Request(url, { cache: 'reload' }));
          if (!await valid(response, url)) throw new Error('Plano no disponible');
          await cache.put(url, response);saved++;
        } catch (_) { failed++; }
      }));
      await notify({ type: 'OFFLINE_PROGRESS', saved, failed, total: PLANS.length, running: true });
    }
    await notify({ type: 'OFFLINE_PROGRESS', saved: await cachedCount(), failed, total: PLANS.length, running: false });
  })().finally(() => { warming = null; });
  return warming;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const responses = await Promise.all(SHELL.map(async url => {
      // El alojamiento normaliza index.html a la raíz. Pedir la raíz evita
      // una respuesta redirigida y conserva la clave portable index.html.
      const source = url === absolute('./index.html') ? self.registration.scope : url;
      const response = await fetch(new Request(source, { cache: 'reload' }));
      if (!await valid(response, url)) throw new Error('Recurso de aplicación no disponible');
      return response;
    }));
    await Promise.all(SHELL.map((url, index) => cache.put(url, responses[index])));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('medina-beta-shell-') && key !== SHELL_CACHE).map(key => caches.delete(key)));
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'OFFLINE_STATUS') event.waitUntil(reportStatus());
  if (event.data?.type === 'PRECACHE_ALL') event.waitUntil(warmPlans());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  url.search = '';url.hash = '';
  const home = new URL(self.registration.scope).pathname;
  const navigate = event.request.mode === 'navigate' && [home, home + 'index.html'].includes(url.pathname);
  if (!navigate && !planSet.has(url.href) && !shellSet.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(planSet.has(url.href) ? PLAN_CACHE : SHELL_CACHE);
    const key = navigate ? absolute('./index.html') : url.href;
    const hit = await cache.match(key);
    if (hit) return hit;
    try {
      const response = await fetch(event.request);
      if (await valid(response, key)) {
        try { await cache.put(key, response.clone()); } catch (_) {}
      }
      return response;
    } catch (_) {
      return new Response(navigate ? 'Conéctate y abre la beta una vez antes de usarla sin conexión.' : '', {
        status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});

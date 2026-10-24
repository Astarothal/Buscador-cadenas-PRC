/* Medina beta: shell atómico por versión; planos conservados entre actualizaciones. */
importScripts('./offline-assets.js');
const SHELL_CACHE = 'medina-beta-shell-v0.1.94.1-documentation-list';
const PLAN_CACHE = 'medina-beta-plans-v1';
const absolute = path => new URL(path, self.registration.scope).href;
const SHELL = ['./documents/ajuste-horquilla.pdf','./usage-core.js','./usage.js','./asset-index.js','./van-verified.js','./qr-policy.js','./index.html','./unified-search.js','./reports.js','./offline.js','./beta.css',
  './offline-assets.js','./manifest.webmanifest','./favicon.png','./icon.svg','./icon-192.png',
  './icon-512.png','./apple-touch-icon.png','./auwa-equivalencias.js','./ct-lines.js',
  './bp-lines.js','./accumulator-traces.js','./plane-gestures.js','./chain-highlight.js','./asset-icons/valla.webp','./asset-icons/bypass.webp','./asset-icons/clasificador.webp','./asset-icons/acumulador.webp','./asset-icons/dematic-gg.webp','./asset-icons/dematic-kk.webp','./asset-icons/formadora-c2h.webp','./asset-icons/k12r.webp','./asset-icons/k12r-emp2.webp','./asset-icons/lrc.webp','./asset-icons/rspn.webp','./asset-icons/lrd.webp','./asset-icons/lrj.webp','./asset-icons/k12r-tal.webp','./asset-icons/esc.webp','./asset-icons/tgw-kcc.webp','./asset-icons/tgw-pwt.webp','./asset-icons/tgw-kcs.webp','./asset-icons/tgw-kac.webp','./asset-icons/tgw-krc.webp','./asset-icons/tgw-bc.webp','./asset-icons/gdd.webp'].map(absolute);
const PLANS = self.MEDINA_OFFLINE_ASSETS.map(absolute);
const planSet = new Set(PLANS), shellSet = new Set(SHELL);
let warming = null;
async function valid(response, url) {
  if (!response || !response.ok || response.redirected) return false;
  const type = response.headers.get('content-type') || '';
  if (url.endsWith('.pdf')) {
    const bytes=new Uint8Array(await response.clone().arrayBuffer());
    return bytes.length>=5 && String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
  }
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
async function verifiedCount(name, urls) {
  const cache = await caches.open(name);
  let count = 0;
  for (let i=0;i<urls.length;i+=8) {
    const found=await Promise.all(urls.slice(i,i+8).map(async url=>await valid(await cache.match(url),url)));
    count+=found.filter(Boolean).length;
  }
  return count;
}
async function cachedCount() { return verifiedCount(PLAN_CACHE,PLANS); }
async function snapshot() {
  const saved=await cachedCount(), shellSaved=await verifiedCount(SHELL_CACHE,SHELL);
  return {saved,total:PLANS.length,shellSaved,shellTotal:SHELL.length,complete:saved===PLANS.length&&shellSaved===SHELL.length};
}
async function notify(data) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => client.postMessage(data));
}
async function reportStatus() {
  await notify({ type: 'OFFLINE_STATUS', ...await snapshot(), running:!!warming });
}
async function warmPlans() {
  if (warming) return warming;
  warming = (async () => {
    const cache = await caches.open(PLAN_CACHE);
    const shell=await caches.open(SHELL_CACHE);
    for(const url of SHELL){
      if(await valid(await shell.match(url),url))continue;
      try{
        const source=url===absolute('./index.html')?self.registration.scope:url;
        const response=await fetch(new Request(source,{cache:'reload'}));
        if(await valid(response,url))await shell.put(url,response);
      }catch(_){}
    }
    let saved = await cachedCount(), failed = 0;
    await notify({ type: 'OFFLINE_PROGRESS', saved, failed, total: PLANS.length, running: true });
    for (let i = 0; i < PLANS.length; i += 4) {
      await Promise.all(PLANS.slice(i, i + 4).map(async url => {
        if (await valid(await cache.match(url),url)) return;
        try {
          const response = await fetch(new Request(url, { cache: 'reload' }));
          if (!await valid(response, url)) throw new Error('Plano no disponible');
          await cache.put(url, response);saved++;
        } catch (_) { failed++; }
      }));
      await notify({ type: 'OFFLINE_PROGRESS', saved, failed, total: PLANS.length, running: true });
    }
    await notify({ type: 'OFFLINE_PROGRESS', ...await snapshot(), failed, running: false });
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

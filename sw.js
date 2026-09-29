const CACHE='saldana00-v32-qr-fix';
const CORE=['./','./index.html','./manifest.webmanifest','./favicon.png','./icon-192.png','./icon.svg','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(e.request.mode==='navigate'||new URL(e.request.url).pathname.endsWith('/index.html')){
    e.respondWith(fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',x));return r}).catch(()=>caches.match('./index.html')));return;
  }
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r})));
});

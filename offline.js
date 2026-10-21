/* Buscador Medina v0.1.77 — estado real del almacenamiento sin conexión. */
(() => {
  const $ = id => document.getElementById(id);
  const badge = $('offlineState'), detail = $('offlineDetail'), button = $('offlineDownload');
  const planCache = 'medina-beta-plans-v1';
  let registration, lastStatus = null, busy = false;
  const pendingKey='medina-offline-download-pending';
  let resumeWanted=false;
  try{resumeWanted=localStorage.getItem(pendingKey)==='1';}catch(_){}
  function connection() {
    badge.textContent = navigator.onLine ? 'Con conexión' : 'Sin conexión';
    badge.dataset.offline = String(!navigator.onLine);
    button.disabled = busy || !navigator.onLine || !registration;
    if (!navigator.onLine && !busy) {
      detail.textContent=lastStatus?.complete?'Listo sin conexión · Todos los mapas guardados.':`Sin conexión · ${lastStatus?.saved||0} de ${lastStatus?.total||'…'} mapas guardados.`;
    }
  }
  function status(data) {
    lastStatus = data;
    if(data.type==='OFFLINE_PROGRESS')busy=Boolean(data.running);
    if(data.complete){
      resumeWanted=false;try{localStorage.removeItem(pendingKey);}catch(_){}
    }
    detail.textContent = busy ? `Descargando: ${data.saved} de ${data.total} mapas.`
      : data.complete ? 'Listo sin conexión · Todos los mapas guardados.'
      : `${data.saved} de ${data.total} mapas guardados.${data.failed?' Pendientes: reintentar descarga.':''}`;
    button.textContent=busy?'Descargando…':data.complete?'Verificar descarga':'Descargar todo para uso offline';
    connection();
  }
  function tell(type) {
    const worker = navigator.serviceWorker.controller || registration?.active;
    worker?.postMessage({ type });
  }
  async function saveLoadedPlan(img) {
    if (!img.complete || !img.naturalWidth || !img.currentSrc && !img.src || !('caches' in window)) return;
    const url = new URL(img.currentSrc || img.src, location.href);
    if (url.origin !== location.origin || !/\/(?:paqueteria|tgw|tgw_hq|vanderlande_hq)\/.+\.webp$/.test(url.pathname)) return;
    url.search = '';
    try {
      const cache = await caches.open(planCache);
      if (await cache.match(url.href)) return;
      const response = await fetch(url.href);
      if (!response.ok || response.redirected) return;
      const type = response.headers.get('content-type') || '';
      if (!type.startsWith('image/')) {
        if (!type.startsWith('application/octet-stream')) return;
        const bytes = new Uint8Array(await response.clone().arrayBuffer());
        if (bytes.length < 12 || bytes[0] !== 82 || bytes[1] !== 73 || bytes[2] !== 70 || bytes[3] !== 70
          || bytes[8] !== 87 || bytes[9] !== 69 || bytes[10] !== 66 || bytes[11] !== 80) return;
      }
      await cache.put(url.href, response);
      tell('OFFLINE_STATUS');
    } catch (_) {
      detail.textContent = 'Plano no guardado. Revisa conexión y espacio.';
    }
  }
  function imageNotice(img, failed) {
    const viewer = img.closest('.viewer,.paq-viewer');
    if (!viewer) return;
    let note = viewer.querySelector('.offline-plan-notice');
    if (!failed) { if (note) note.remove(); return; }
    if (!note) {
      note = document.createElement('div');note.className = 'offline-plan-notice';note.setAttribute('role', 'status');
      const text = document.createElement('span');
      const retry = document.createElement('button');retry.type = 'button';retry.textContent = 'Reintentar plano';
      retry.onclick = () => { const src = img.src;img.removeAttribute('src');img.src = src; };
      note.append(text, retry);viewer.prepend(note);
    }
    note.firstChild.textContent = navigator.onLine ? 'No se pudo cargar el plano.' : 'Este plano todavía no está guardado. Conéctate para abrirlo.';
  }
  document.addEventListener('load', event => {
    if (event.target.tagName !== 'IMG') return;
    imageNotice(event.target, false);saveLoadedPlan(event.target);
  }, true);
  document.addEventListener('error', event => {
    if (event.target.tagName === 'IMG' && /\.webp(?:\?|$)/.test(event.target.src)) imageNotice(event.target, true);
  }, true);
  async function downloadAll() {
    if(!navigator.onLine||busy||!registration)return;
    resumeWanted=true;try{localStorage.setItem(pendingKey,'1');}catch(_){}
    busy=true;connection();button.textContent='Descargando…';
    detail.textContent='Descargando buscador y mapas (aprox. 95 MB)…';
    try{await navigator.storage?.persist?.();}catch(_){}
    tell('PRECACHE_ALL');
  }
  button.addEventListener('click',downloadAll);
  window.addEventListener('online',()=>{connection();tell('OFFLINE_STATUS');if(resumeWanted)downloadAll();});
  window.addEventListener('offline', connection);
  connection();
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) {
    detail.textContent = 'Guardado sin conexión no disponible en este navegador.';
    button.disabled = true;return;
  }
  navigator.serviceWorker.addEventListener('message', event => {
    if (['OFFLINE_STATUS', 'OFFLINE_PROGRESS'].includes(event.data?.type)) status(event.data);
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => tell('OFFLINE_STATUS'));
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(async reg => {
    registration = reg;
    await navigator.serviceWorker.ready;
    connection();tell('OFFLINE_STATUS');
    if(resumeWanted)downloadAll();
    document.querySelectorAll('img').forEach(saveLoadedPlan);
  }).catch(() => {
    detail.textContent = 'Guardado sin conexión no disponible. Recarga para reintentar.';
  });
})();

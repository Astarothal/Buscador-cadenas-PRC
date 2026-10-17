/* Buscador Medina v0.1.77 — estado real del almacenamiento sin conexión. */
(() => {
  const $ = id => document.getElementById(id);
  const badge = $('offlineState'), detail = $('offlineDetail'), button = $('offlineDownload');
  const planCache = 'medina-beta-plans-v1';
  let registration, lastStatus = null, busy = false;
  function connection() {
    badge.textContent = navigator.onLine ? 'Con conexión' : 'Sin conexión';
    badge.dataset.offline = String(!navigator.onLine);
    button.disabled = busy || !navigator.onLine || !registration;
    if (!navigator.onLine && !busy) detail.textContent = 'Puedes buscar y abrir los planos guardados. AUWA, IMMS y Teams necesitan red.';
  }
  function status(data) {
    lastStatus = data;
    if (data.type === 'OFFLINE_PROGRESS') {
      busy = data.running;
      detail.textContent = data.running
        ? `Guardando planos: ${data.saved} de ${data.total} · ${data.failed} pendientes.`
        : `${data.saved} de ${data.total} recursos de planos guardados.${data.failed ? ' Algunos no se han podido guardar. Pulsa «Guardar todos los planos» para reintentar.' : ' Disponibles sin conexión en este dispositivo.'}`;
    } else if (!busy) {
      detail.textContent = `${data.saved} de ${data.total} recursos de planos guardados. Los planos que abras se guardan automáticamente.`;
    }
    button.textContent = busy ? 'Guardando planos…' : 'Guardar todos los planos';
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
      detail.textContent = 'No se ha podido guardar este plano. Comprueba la conexión o el espacio del dispositivo.';
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
    note.firstChild.textContent = navigator.onLine ? 'No se ha podido cargar este plano. Puedes reintentarlo.' : 'Este plano todavía no está guardado. Conéctate y ábrelo una vez para poder usarlo sin conexión.';
  }
  document.addEventListener('load', event => {
    if (event.target.tagName !== 'IMG') return;
    imageNotice(event.target, false);saveLoadedPlan(event.target);
  }, true);
  document.addEventListener('error', event => {
    if (event.target.tagName === 'IMG' && /\.webp(?:\?|$)/.test(event.target.src)) imageNotice(event.target, true);
  }, true);
  button.addEventListener('click', () => {
    if (!navigator.onLine) return;
    busy = true;connection();button.textContent = 'Guardando planos…';
    detail.textContent = 'Preparando la descarga de todos los planos (aprox. 85 MB)…';
    tell('PRECACHE_ALL');
  });
  window.addEventListener('online', () => { connection();tell('OFFLINE_STATUS'); });
  window.addEventListener('offline', connection);
  connection();
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) {
    detail.textContent = 'Este navegador no permite guardar la aplicación sin conexión. Usa la URL HTTPS en Safari, Chrome o Edge.';
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
    document.querySelectorAll('img').forEach(saveLoadedPlan);
  }).catch(() => {
    detail.textContent = 'No se ha podido activar el modo sin conexión. Recarga con conexión para reintentarlo.';
  });
})();

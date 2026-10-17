/* Prepara un borrador; el envío siempre se realiza manualmente en Teams. */
(() => {
  const $ = id => document.getElementById(id);
  const recipient = 'albertomsa@ext.inditex.com', version = 'v0.1.80 BETA privada';
  const key = 'medinaBetaReportDraftV2', modal = $('reportModal');
  let context, previousFocus, previousOverflow;
  const description = $('reportDescription'), type = $('reportType'), feedback = $('reportStatus');
  const link = $('reportSend'), preview = $('reportPreview'), main = $('reportBtn');
  function read() { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } }
  function current() {
    if (window.v71GetReportContext) return window.v71GetReportContext();
    const section = document.querySelector('main > section.active');
    return { section: section?.id || 'Buscador', query: '', detail: '' };
  }
  function message() {
    return ['Buscador Medina · Reporte', 'Tipo: ' + type.value, 'Versión: ' + version,
      'Sección: ' + (context?.section || 'Buscador'),
      context?.query ? 'Búsqueda: ' + context.query : '', context?.detail ? 'Vista: ' + context.detail : '',
      '', 'Descripción:', description.value.trim()].filter((line, i, lines) => line || i >= lines.length - 3).join('\n');
  }
  function save() {
    if (!description.value.trim()) return false;
    try {
      localStorage.setItem(key, JSON.stringify({ type: type.value, description: description.value, context, updatedAt: new Date().toISOString() }));
      main.classList.add('pending');return true;
    } catch (_) { feedback.textContent = 'El navegador no permite guardar el borrador. Copia el texto antes de cerrar.';return false; }
  }
  function refresh() {
    preview.value = message();
    const url = new URL('https://teams.microsoft.com/l/chat/0/0');
    url.searchParams.set('users', recipient);url.searchParams.set('message', preview.value);
    link.href = url.href;
  }
  function open(options = {}) {
    window.MedinaUsage?.track('report');
    // Los eventos de click no son opciones de reporte.
    if (options instanceof Event) options = {};
    previousFocus = document.activeElement;previousOverflow = document.body.style.overflow;
    const draft = read();
    context = options.context || draft?.context || current();
    type.value = options.type || draft?.type || 'Problema';
    description.value = typeof options.description === 'string' ? options.description : draft?.description || '';
    if (options.context || options.description !== undefined) context = options.context || current();
    $('reportContext').textContent = ['Sección: ' + context.section, context.query ? 'Búsqueda: ' + context.query : '', context.detail || ''].filter(Boolean).join(' · ');
    feedback.textContent = options.status || (draft ? 'Borrador recuperado con su contexto original. Puedes revisarlo antes de abrir Teams.' : 'Revisa el borrador. Abrir Teams no envía el mensaje.');
    modal.style.display = 'block';modal.removeAttribute('aria-hidden');document.body.style.overflow = 'hidden';
    refresh();description.focus();
  }
  function close() {
    save();modal.style.display = 'none';modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = previousOverflow || '';previousFocus?.focus();
  }
  window.openTeamsReport = open;
  main.addEventListener('click', open);
  document.querySelectorAll('.report-open').forEach(button => button.addEventListener('click', open));
  $('reportClose').addEventListener('click', close);$('reportCancel').addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault();close(); }
    if (event.key !== 'Tab') return;
    const controls = [...modal.querySelectorAll('button,select,textarea,a[href]')];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault();last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault();first.focus(); }
  });
  for (const event of ['input', 'change']) modal.addEventListener(event, e => {
    if (e.target !== description && e.target !== type) return;
    refresh();save();
  });
  link.addEventListener('click', event => {
    if (!description.value.trim()) { event.preventDefault();feedback.textContent = 'Describe el problema o la mejora antes de abrir Teams.';description.focus();return; }
    refresh();const saved = save();
    if (!navigator.onLine) {
      event.preventDefault();if (saved) feedback.textContent = 'Sin conexión. Borrador guardado con su búsqueda. Vuelve a abrirlo cuando tengas red.';
      return;
    }
    if (saved) feedback.textContent = 'Se abre el borrador en Teams. El texto se conserva aquí hasta que pulses «Descartar borrador».';
  });
  $('reportCopy').onclick = async () => {
    refresh();
    try { await navigator.clipboard.writeText(preview.value);feedback.textContent = 'Texto copiado. Puedes pegarlo en Teams.'; }
    catch (_) { preview.focus();preview.select();feedback.textContent = 'Selecciona y copia el texto del borrador.'; }
  };
  $('reportDiscard').onclick = () => {
    try { localStorage.removeItem(key); } catch (_) {}
    main.classList.remove('pending');description.value = '';type.value = 'Problema';context = current();refresh();
    $('reportContext').textContent = 'Sección: ' + context.section + (context.query ? ' · Búsqueda: ' + context.query : '');
    feedback.textContent = 'Borrador descartado. Puedes preparar otro reporte.';
  };
  window.addEventListener('online', () => { if (read()) feedback.textContent = 'Ya hay conexión. Revisa el borrador y abre Teams cuando quieras.'; });
  if (read()) main.classList.add('pending');
  window.hideMissingReport = statusId => {
    document.querySelectorAll('.missing-report-wrap').forEach(node => { if (node.dataset.status === statusId) node.remove(); });
  };
  window.showMissingReport = (statusId, query) => {
    window.hideMissingReport(statusId);
    const status = $(statusId);query = String(query || '').trim();
    if (!status || !query) return;
    const captured = { ...current(), query };
    const wrap = document.createElement('div');wrap.className = 'missing-report-wrap';wrap.dataset.status = statusId;
    const button = document.createElement('button');button.type = 'button';button.className = 'missing-report-btn';button.textContent = 'Reportar falta en Teams';
    const note = document.createElement('span');note.className = 'missing-report-note';note.textContent = 'Prepara un borrador dirigido a Medina.';
    button.onclick = () => open({ context: captured, type: 'Información que falta', description: 'No se encuentra en el buscador: ' + query, status: 'Revisa el reporte de información que falta antes de abrir Teams.' });
    wrap.append(button, note);status.insertAdjacentElement('afterend', wrap);
  };
})();

/* Identidad única del activo = QR. Las referencias y las páginas son relaciones del activo. */
(() => {
  const compact = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const qrKey = value => String(value ?? '').trim().replace(/^QR\s*[:#-]?\s*/i, '');
  // Alta confirmada por Medina (17/10/2026). Plano pendiente; QR numérico generado y verificado mediante lectura independiente.
  const confirmedAdditions = [{c:'311903',e:'SS1_IND_16',l:'SS1 Inducción 16 · Paquetería',q:'/jv8EtBuuLt1dduursF5B/qv4BQAvjPn5/LrosWTvHf4lgB0q/lSsFw2uvSl1fIuqsEEfK/qkgA=',s:21}];
  let catalog, loading, renderSerial = 0;
  const locationKey = loc => loc.kind === 'dematic' ? `dematic|${compact(loc.plc)}|${compact(loc.pos)}`
    : loc.kind === 'prc' ? `prc|${loc.type}|${loc.key}` : `${loc.kind}|${compact(loc.code)}`;
  function build(input) {
    const byQR = new Map(), bindings = new Map(), records = [];
    const bind = (loc, asset) => {
      const key = locationKey(loc);if (!bindings.has(key)) bindings.set(key, new Map());bindings.get(key).set(asset.qr, asset);
    };
    for (const row of input) {
      if (!MedinaQR.allows(row)) continue;
      const qr = qrKey(row.c);if (!qr) continue;
      if (!byQR.has(qr)) byQR.set(qr, { qr, record: row, rows: [], aliases: [], lines: [], pages: [], pageMap: new Map(), referencePages: [], referenceMap: new Map(), refs: [] });
      const asset = byQR.get(qr);
      if (!asset.record.q && row.q) asset.record = row;
      if (!asset.rows.some(r => r.e === row.e && r.l === row.l)) { asset.rows.push(row);records.push(row); }
      if (row.e && !asset.aliases.includes(row.e)) asset.aliases.push(row.e);
      if (row.l && !asset.lines.includes(row.l)) asset.lines.push(row.l);
    }
    const vanIndex = new Map();for(const h of VANDERLANDE_INDEX){const key=compact(h.code);if(!vanIndex.has(key))vanIndex.set(key,[]);vanIndex.get(key).push(h);}
    const posIndex = new Map();
    for (const [pos, pages] of Object.entries(PAQ.positions)) for (const h of pages) {
      const key = `${compact(h.plc || 'CNX1')}|${compact(pos)}`;
      if (!posIndex.has(key)) posIndex.set(key, []);posIndex.get(key).push({ h, pos });
    }
    function addPage(asset, page, tool, boxes = []) {
      const key = `${page.kind}|${page.image || page.page}`;
      if (!asset.pageMap.has(key)) asset.pageMap.set(key, { ...page, key, labels:[page.label], tools: [], boxes: [], traces: [], bypassMarkers: [] });
      const item = asset.pageMap.get(key);
      if(!item.labels.includes(page.label)){item.labels.push(page.label);item.label=item.labels.join(' / ');}
      if (tool && !item.tools.some(t => locationKey(t)===locationKey(tool) && (t.h?.image||t.h?.page||t.lcc)===(tool.h?.image||tool.h?.page||tool.lcc))) item.tools.push(tool);
      for (const box of boxes) if (!item.boxes.some(b => JSON.stringify(b) === JSON.stringify(box))) item.boxes.push(box);
      return item;
    }
    for (const asset of byQR.values()) for (const row of asset.rows) {
      const parts = String(row.e || '').toUpperCase().replace(/\s+/g, '').split('_');
      const plc = parts[0], suffix = compact(parts.slice(2).join('_'));
      for (const { h, pos } of posIndex.get(`${compact(plc)}|${suffix}`) || []) {
        const tool = { kind: 'dematic', plc: h.plc || 'CNX1', pos, h, reference:row.e };
        bind(tool, asset);
        addPage(asset, { kind: 'dematic', image: './' + h.image, label: `${h.plc || 'CNX1'} · ${h.per} · página ${h.pdf_page}`, page: h.pdf_page, width: h.page_w, height: h.page_h }, tool,
          (h.boxes || []).map(b => [b[0] / h.page_w, b[1] / h.page_h, (b[2] - b[0]) / h.page_w, (b[3] - b[1]) / h.page_h]));
      }
      const canonical = tgwCanonicalRef(row.e), group = canonical && TGW_GROUPS.get(canonical);
      if (group) {
        bind({ kind: 'tgw', code: canonical }, asset);
        for (const h of group.entries) {
          const pg = TGW.pages.find(p => p.page === h.page);if (!pg) continue;
          const b = h.box;
          addPage(asset, { kind: 'tgw', image: tgwPageSrc(h.page), label: `TGW · página ${h.page}`, page: h.page, width: pg.w, height: pg.h }, { kind: 'tgw', code: canonical, h },
            b ? [[b[0] / pg.w, b[1] / pg.h, (b[2] - b[0]) / pg.w, (b[3] - b[1]) / pg.h]] : []);
        }
      }
      if (vanIsQrTransport(row)) {
        const v = vanQrHit(row), src = v.lcc != null && vanLayoutSrc(v.plc, v.lcc);
        bind({ kind: 'van', code: row.e }, asset);
        const verifiedPages = window.MedinaVanVerified?.getAll(row) || [];
        if (verifiedPages.length) {
          for (const proof of verifiedPages) {
            addPage(asset, { kind:'van', image:vanLayoutSrc(proof.plc,proof.lcc), label:`Vanderlande · PLC${proof.plc} · LCC${proof.lcc}`, page:Number(proof.plc)*100+proof.lcc, verified:proof }, {kind:'van',plc:proof.plc,lcc:proof.lcc,code:row.e}, proof.boxes);
          }
        } else if (src) {
          const pos = vanMarkPos(v.plc, v.lcc, row.e, row);
          addPage(asset, { kind:'van', image:src, label:`Vanderlande · PLC${v.plc} · LCC${String(v.lcc).padStart(2,'0')}`, page:Number(v.plc)*100+v.lcc }, {kind:'van',plc:v.plc,lcc:v.lcc,code:row.e}, pos ? [[pos.x,pos.y,pos.w,pos.h]] : []);
        }
        for(const ref of vanPlanReferences(row)){
          const image=vanLayoutSrc(ref.plc,ref.lcc),key='van|'+image,old=asset.referenceMap.get(key);
          if(!old||old.referenceBasis==='area')asset.referenceMap.set(key,{kind:'van',key,image,page:Number(ref.plc)*100+ref.lcc,label:`Vanderlande · PLC${ref.plc} · LCC${ref.lcc}`,referenceBasis:ref.basis,labels:[],tools:[{kind:'van',plc:ref.plc,lcc:ref.lcc,code:row.e}],boxes:[],traces:[],bypassMarkers:[]});
        }
      }
      // Referencias exactas adicionales: nunca se adivina el PLC a partir de una posición parecida.
      for (const h of vanIndex.get(compact(row.e)) || []) {
        const src = vanLayoutSrc(h.plc, h.lcc);if (!src) continue;
        bind({ kind: 'van', code: h.code }, asset);
        const pos = vanMarkPos(h.plc, h.lcc, h.code, row);
        addPage(asset, { kind: 'van', image: src, label: `Vanderlande · PLC${h.plc} · LCC${h.lcc}`, page: Number(h.plc) * 100 + h.lcc }, { kind: 'van', ...h }, pos ? [[pos.x, pos.y, pos.w, pos.h]] : []);
      }
    }
    for (const type of ['chain', 'bypass']) for (const [key, qr] of Object.entries(ELEMENT_TO_ASSET[type] || {})) {
      const asset = byQR.get(qrKey(qr));if (!asset) continue;
      const loc = { kind: 'prc', type, key };bind(loc, asset);asset.refs.push(loc);
      const hits = (type === 'chain' ? LAYOUT.chains[key] : LAYOUT.bypasses[key]) || [];
      const traces = (type === 'chain' ? CT_LINES['CT' + key] : BP_LINES['BP' + key]) || {};
      const pageNumbers = new Set([...hits.map(h => h.page), ...Object.keys(traces).map(Number), ...(type === 'chain' ? (GARMENT_SECCIONADORES_ALL[key] || []).map(s => s.page) : [])]);
      for (const page of pageNumbers) {
        const pg = LAYOUT.pages[page - 1];if (!pg) continue;
        const item = addPage(asset, { kind: 'prc', page, label: `Prenda colgada · página ${page}`, width: pg.w, height: pg.h }, loc);
        const trace = traces[page];if (trace && !item.traces.includes(trace)) item.traces.push(trace);
        if (type === 'bypass') for (const h of hits.filter(h => h.page === page)) {
          if (!item.bypassMarkers.some(m => m.x0 === h.x0 && m.y0 === h.y0)) item.bypassMarkers.push(h);
          if (!trace) item.boxes.push([h.x0 / pg.w, h.y0 / pg.h, (h.x1 - h.x0) / pg.w, (h.y1 - h.y0) / pg.h]);
        }
      }
    }
    for (const asset of byQR.values()) {
      asset.pages = [...asset.pageMap.values()].sort((a, b) => a.kind.localeCompare(b.kind) || Number(!!b.verified?.physicalMark)-Number(!!a.verified?.physicalMark) || a.page - b.page || a.label.localeCompare(b.label, 'es', { numeric: true }));
      const references=[...asset.referenceMap.values()].filter(p=>!asset.pageMap.has(p.key));
      asset.referencePages=references.filter(p=>!references.some(q=>q.referenceBasis==='number')||p.referenceBasis==='number').sort((a,b)=>a.page-b.page);
      delete asset.pageMap;delete asset.referenceMap;
    }
    return { byQR, bindings, records };
  }
  async function ensure() {
    if (catalog) return catalog;
    if (!loading) loading = loadFullAssets().then(rows => catalog = build([...rows, ...MAPPED_ASSETS, ...confirmedAdditions])).finally(() => { loading = null; });
    return loading;
  }
  function get(qr) { return catalog?.byQR.get(qrKey(qr)); }
  function forLocation(loc) { return [...(catalog?.bindings.get(locationKey(loc))?.values() || [])]; }
  function rowsForLocation(loc){
    return forLocation(loc).map(asset=>loc.kind==='dematic'?(asset.rows.find(row=>{
      const parts=String(row.e||'').toUpperCase().replace(/\s+/g,'').split('_');
      return compact(parts[0])===compact(loc.plc)&&compact(parts.slice(2).join('_'))===compact(loc.pos);
    })||asset.record):asset.record);
  }
  function unifyHits(items, model = catalog) {
    const merged = new Map(), unresolved = [];
    for (const item of items) {
      const assets = item.qr ? [model?.byQR.get(qrKey(item.qr))].filter(Boolean) : item.loc ? [...(model?.bindings.get(locationKey(item.loc))?.values() || [])] : [];
      if (!assets.length) { if (!item.qr || MedinaQR.allows(item.qr)) unresolved.push(item);continue; }
      for (const asset of assets) {
        if (!merged.has(asset.qr)) merged.set(asset.qr, { ...item, asset, qr: asset.qr, rank: item.rank, matches: [] });
        const result = merged.get(asset.qr);result.rank = Math.min(result.rank, item.rank);
        if (!result.matches.includes(item.title)) result.matches.push(item.title);
      }
    }
    for (const item of merged.values()) {
      const pages = item.asset.pages;
      item.subtitle = `${item.group === 'multi' ? 'TGW · ' : ''}QR ${item.qr}`;
      item.details = [item.asset.record.e, pages.length ? `${pages.length} página${pages.length === 1 ? '' : 's'} de layout` : item.asset.referencePages?.length ? `${item.asset.referencePages.length} plano${item.asset.referencePages.length===1?'':'s'} de referencia · ubicación pendiente` : item.asset.record.l].filter(Boolean).join(' · ');
    }
    return [...unresolved, ...merged.values()];
  }
  function renderLegacy(statusId,resultId,items,raw){
    const unique=unifyHits(items),box=document.getElementById(resultId);box.replaceChildren();
    document.getElementById(statusId).textContent=unique.length+' resultado'+(unique.length===1?'':'s')+' para '+raw+'.';
    for(const h of unique){
      const button=document.createElement('button');button.type='button';button.className='result';if(h.qr)button.dataset.qr=h.qr;
      const title=document.createElement('b');title.textContent=h.title;
      const detail=document.createElement('small');detail.textContent=h.subtitle+' · '+h.details;button.append(title,detail);
      button.onclick=()=>h.asset?window.medinaShowAsset?.(h.asset,raw):h.open();box.appendChild(button);
    }
    if(unique.length===1&&unique[0].asset)window.medinaShowAsset?.(unique[0].asset,raw);
    else if(unique.length&&!unique[0].asset)unique[0].open();
  }
  function openTool(asset, tool) {
    if (window.medinaOpenAssetTool) window.medinaOpenAssetTool(asset, tool);
  }
  function runTool(asset, tool) {
    if (tool.kind === 'dematic') { $('paqQ').value = tool.reference||asset.record.e;paqPlcFilter = tool.plc;$('paqPlcSelect').value = tool.plc;showPaq(tool.h, tool.pos, null); }
    if (tool.kind === 'prc') { $('layoutQ').value = tool.key;searchLayout(); }
    if (tool.kind === 'tgw') { $('tgwQ').value = tool.code;showTgw(tool.h, null); }
    if (tool.kind === 'van') { const row=asset.rows.find(r=>compact(r.e)===compact(tool.code))||asset.record;$('vanQ').value = row.e;vanOpen(tool.plc, tool.lcc, tool.code, row); }
  }
  function toolLabel(tool) { return tool.kind === 'prc' ? `Herramientas ${tool.type === 'chain' ? 'cadena' : 'bypass'} ${tool.key}` : 'Herramientas del plano'; }
  async function render(row) {
    const my = ++renderSerial;
    let panel = document.getElementById('assetLayouts');
    if (!panel) { panel = document.createElement('div');panel.id = 'assetLayouts';$('qrDetail').insertBefore(panel,$('qrFooter')); }
    panel.replaceChildren();panel.textContent = 'Cargando páginas del activo…';panel.dataset.qr = qrKey(row.c);
    await ensure();if (my !== renderSerial) return;
    const asset = get(row.c);panel.replaceChildren();if (!asset) return;
    $('qrEq').textContent = asset.record.e;$('qrLine').textContent = asset.lines.join(' · ');
    const aliases = document.createElement('div');aliases.className = 'asset-aliases';
    const displayAliases=[...new Set([...asset.aliases,...asset.refs.map(r=>(r.type==='chain'?'Cadena ':'Bypass ')+r.key),...asset.pages.flatMap(p=>p.tools.filter(t=>t.kind==='tgw').map(t=>t.code))])];
    if (displayAliases.length > 1) { const title = document.createElement('b');title.textContent = 'Referencias del mismo activo';aliases.appendChild(title);for (const name of displayAliases) { const line = document.createElement('div');line.textContent = name;aliases.appendChild(line); }panel.appendChild(aliases); }
    const links = new Map();for (const r of asset.rows) for (const link of auwaLinksForAsset(r)) links.set(link.url, link);
    $('qrAuwa').innerHTML = auwaBlock([...links.values()]);
    const references=asset.referencePages||[],displayPages=[...asset.pages,...references];
    const heading = document.createElement('h3');heading.textContent = asset.pages.length ? `Todas las páginas del activo (${asset.pages.length})` : references.length ? `Planos de referencia de Vanderlande (${references.length})` : 'Plano pendiente de asociar';panel.appendChild(heading);
    if(references.length){const note=document.createElement('p');note.className='asset-reference-note';note.textContent=references.some(p=>p.referenceBasis==='number')?'La numeración de la referencia coincide con el índice de estos planos. La asociación del QR y su posición exacta están pendientes de verificar.':'No hay una línea LCC verificada para este QR. Se muestran los planos disponibles de su PLC como referencia de zona; no indican la ubicación exacta del activo.';panel.appendChild(note);}
    if(!displayPages.length&&asset.rows.some(vanIsQrTransport)){const note=document.createElement('p');note.className='asset-reference-note';note.textContent='La relación de esta zona con los planos cargados sigue pendiente. Puedes reportarla a Medina. No se asigna un PLC ni una posición sin verificar.';panel.appendChild(note);}
    // El aviso de Vanderlande sigue presente en la ficha unificada.
    if (asset.rows.some(vanIsQrTransport)) {
      const warning = document.querySelector('#vanSection .van-construction')?.cloneNode(true);
      if (warning) { warning.querySelectorAll('button').forEach(b => b.addEventListener('click', () => window.openTeamsReport?.()));panel.appendChild(warning); }
    }
    const index = document.createElement('nav');index.className = 'asset-page-index';index.setAttribute('aria-label', 'Páginas del activo');panel.appendChild(index);
    displayPages.forEach((page, n) => {
      const id = `asset-${asset.qr}-page-${n}`, card = document.createElement('article');card.id = id;card.className = 'asset-layout-page viewer';card.dataset.pageKey = page.key;if(page.referenceBasis)card.dataset.reference=page.referenceBasis;
      const jump = document.createElement('a');jump.href = '#' + id;jump.textContent = (page.referenceBasis?'Referencia · ':'')+page.label;index.appendChild(jump);
      const head = document.createElement('div');head.className = 'asset-layout-head';const title = document.createElement('h4');title.textContent = page.label;head.appendChild(title);
      if(page.referenceBasis){const badge=document.createElement('p');badge.className='asset-reference-label';badge.textContent=page.referenceBasis==='number'?'Plano candidato por numeración · sin posición verificada':'Plano de referencia de zona · sin posición verificada';head.appendChild(badge);}
      if(page.verified){const proof=document.createElement('p');proof.className='asset-reference-label';proof.textContent=page.verified.physicalMark?`Posición ${page.verified.position} verificada en plano original${page.verified.photocell?' · Fotocélula '+page.verified.photocell:''}`:`Referencia mecánica ${page.verified.position} localizada en el plano original`;head.appendChild(proof);const source=window.MedinaVanVerified.source(page.verified.sourceKey);if(source){const link=document.createElement('a');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='PDF original en Drive';head.appendChild(link);}}
      const actions = document.createElement('div');actions.className = 'asset-layout-actions';
      const whole = document.createElement('button');whole.type = 'button';whole.textContent = 'Página completa';
      const focus = document.createElement('button');focus.type = 'button';focus.textContent = page.referenceBasis?'Posición sin verificar':'Centrar activo';if(page.referenceBasis)focus.disabled=true;
      actions.append(whole, focus);
      for (const tool of page.tools) { const b = document.createElement('button');b.type = 'button';b.className = 'asset-tool-btn';b.dataset.maker = tool.kind;b.textContent = toolLabel(tool);b.onclick = () => openTool(asset, tool);actions.appendChild(b); }
      head.appendChild(actions);card.appendChild(head);
      const crop = document.createElement('div');crop.className = 'asset-layout-crop';
      const canvas = document.createElement('div');canvas.className = 'asset-layout-canvas';
      const img = document.createElement('img');img.alt = `${asset.record.e} · QR ${asset.qr} · ${page.label}`;img.loading = 'lazy';
      canvas.appendChild(img);crop.appendChild(canvas);card.appendChild(crop);panel.appendChild(card);
      let ready = false;
      const init = () => {
        const width = crop.clientWidth || 320, pw = page.width || img.naturalWidth || 1, ph = page.height || img.naturalHeight || 1;
        canvas.style.width = width + 'px';canvas.style.height = width * ph / pw + 'px';img.style.width = width + 'px';
        canvas.querySelectorAll('.asset-page-mark').forEach(m => m.remove());
        for (const b of page.boxes) { const mark = document.createElement('div');mark.className = 'asset-page-mark' + (page.kind === 'prc' ? ' bypass' : '');[mark.style.left, mark.style.top, mark.style.width, mark.style.height] = b.map(v => v * 100 + '%');canvas.appendChild(mark); }
        if (page.traces.length) {
          const trace = { drawPaths: [], arrows: [], labelMasks: [] };
          for (const t of page.traces) for (const key of Object.keys(trace)) trace[key].push(...(t[key] || []));
          const key = 'CTQR_' + asset.qr;CT_LINES[key] = { ...(CT_LINES[key] || {}), [page.page]: trace };
          ChainHighlight.attach(canvas, img, key, page.page, { w: pw, h: ph }, page.bypassMarkers);
        }
        PlaneGestures.bind(crop, canvas, 1);ready = true;
      };
      img.addEventListener('load', init);
      whole.onclick = () => { if (!ready) init();PlaneGestures.set(crop, 1);crop.scrollLeft = 0;crop.scrollTop = 0; };
      focus.onclick = () => {
        if (!ready) init();const b = page.boxes[0];
        if (b) { const zoom=page.verified?7:3;PlaneGestures.set(crop, zoom);const width = crop.clientWidth || 320, ratio = (page.height || img.naturalHeight || 1) / (page.width || img.naturalWidth || 1);crop.scrollLeft = Math.max(0, (b[0] + b[2] / 2) * width * zoom - crop.clientWidth / 2);crop.scrollTop = Math.max(0, (b[1] + b[3] / 2) * width * ratio * zoom - crop.clientHeight / 2); }
        else PlaneGestures.set(crop, 1.6);
      };
      img.src = page.kind === 'prc' ? pageData(page.page) : page.image;
      if (img.complete && img.naturalWidth) init();
    });
  }
  window.MedinaAssets = Object.freeze({ ensure, get, forLocation, rowsForLocation, unifyHits, renderLegacy, runTool, render, build, records: () => catalog?.records || fullAssets || MAPPED_ASSETS });
})();

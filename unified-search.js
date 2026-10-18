/* Grupo 5 · v0.1.92 BETA · Unifica motores existentes sin modificar sus índices ni sus visores. */
(() => {
  'use strict';
  // Actualiza los textos sin sustituir el HTML que contiene los planos.
  document.querySelectorAll('.van-construction').forEach(node=>node.remove());
  const compactText=(selector,text)=>{const node=document.querySelector(selector);if(node)node.textContent=text;};
  document.querySelectorAll('.v71-intro p,.v71-footnote,.qr-installation-sub,#vanSection > .info,#paqSection > .info,#tgwSection > .info,#layoutSection > .status:not([id]),#offlinePanel > p:not([id])').forEach(node=>node.remove());
  compactText('.v71-intro h2','Buscar');
  ['v71Status','layoutStatus','vanStatus','qrStatus','paqStatus','tgwStatus'].forEach(id=>compactText('#'+id,''));
  compactText('#layoutSection .legend','Verde: recorrido · S: seccionador');
  document.querySelectorAll('.v71-beta').forEach(node=>{node.textContent=node.textContent.replace(/v0\.1\.\d+(?:\.\d+)?/g,'v0.1.92');});
  const helpCard=document.querySelector('#helpModal .help-card');
  if(helpCard){
    const close=document.getElementById('helpClose'),admin=document.getElementById('usageOpen');
    helpCard.innerHTML="\n    <div class=\"help-head\">\n      <h2 id=\"helpTitle\">Ayuda</h2>\n      <button id=\"helpClose\" class=\"help-close\" type=\"button\" aria-label=\"Cerrar\">×</button>\n    </div>\n    <h3>Añadir a la PDA</h3>\n    <p>Abre el buscador en el navegador y guárdalo en la pantalla de inicio como <b>acceso directo, no como aplicación</b>.</p>\n    <h3>Actualizar</h3>\n    <p>Con conexión, pulsa <b>Actualizar</b>. Si no cambia, cierra todas las pestañas del buscador y vuelve a abrirlo.</p>\n    <button id=\"forceUpdateBtn\" class=\"help-update\" type=\"button\">Actualizar</button>\n    <p id=\"forceUpdateMsg\" class=\"status\" role=\"status\"></p>\n    <h3>Reportar errores</h3>\n    <p><b>Reportar</b> → describe el error → <b>Abrir Teams</b> → envía el mensaje a Medina.</p>\n    <p class=\"status\"><span id=\"helpVersion\">v0.1.92</span></p>\n    <p class=\"help-admin-footer\"><a href=\"#estadisticas\" id=\"usageOpen\" class=\"help-admin-link\">Estadísticas</a></p>";
    if(close)document.getElementById('helpClose').replaceWith(close);
    if(admin)document.getElementById('usageOpen').replaceWith(admin);
    const update=document.getElementById('forceUpdateBtn'),message=document.getElementById('forceUpdateMsg');
    update.addEventListener('click',async()=>{
      update.disabled=true;
      if(!navigator.onLine){message.textContent='Conéctate para actualizar.';update.disabled=false;return;}
      message.textContent='Comprobando actualización…';
      try{
        if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();for(const reg of regs)if(reg.scope===new URL('./',location.href).href)await reg.update();}
        message.textContent='Recargando…';setTimeout(()=>location.reload(),700);
      }catch(_){message.textContent='No se pudo actualizar. Reinténtalo.';update.disabled=false;}
    });
  }
  compactText('.report-recipient','Para: Medina · albertomsa@ext.inditex.com');
  compactText('#reportSend','Abrir Teams ↗');
  compactText('.report-preview summary','Ver borrador');
  const description=document.getElementById('reportDescription');if(description)description.placeholder='Describe el error o la mejora…';
  compactText('#usageEmpty','Sin actividad en este periodo.');
  compactText('#usageSection .usage-note','Sesiones anónimas: 30 min de inactividad. Histórico: 90 días. Borradores de Teams: no equivalen a mensajes enviados.');
  const originalAuwa=window.auwaBlock;if(originalAuwa)window.auwaBlock=links=>originalAuwa(links).replace('Enlace AUWA pendiente de asociar para este equipo.','Enlace pendiente.');
  const el = (id) => document.getElementById(id);
  const GROUPS = {
    garment: 'Prenda colgada',
    parcel: 'Paquetería',
    multi: 'Multi TGW',
    misc: 'Otros QR de instalación'
  };
  const FILTER_LABEL = {all:'Todas las instalaciones',...GROUPS};
  const EMP = new Set(['EMP1','EMP2','EMP3']);
  const DEMATIC_PLC = new Set(PAQ.layouts.map(x=>String(x.plc||'CNX1').toUpperCase()));
  const VANDERLANDE_PREFIX = new Set(['ENT3','SIL3','PLM3','PLM4','VAC3','CRR4','CRR5','DPL1','CLA4','CLA5']);
  const body = document.body;
  let filter='all', serial=0, opened=null;
  let activeQuery='', lastSearch='';
  let currentItems=[];
  const compact = s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const score=(txt,q)=>{const x=compact(txt);return x===q?0:x.startsWith(q)?1:x.includes(q)?2:4};
  const groupForPlc=plc=>EMP.has(String(plc||'').toUpperCase())?'garment':'parcel';
  function classifyAsset(r) {
    const eq=String(r.e||'').toUpperCase(),line=String(r.l||'').toUpperCase();
    const prefix=eq.split('_')[0];
    if(EMP.has(prefix) || /PRENDA COLGADA|DURKOPP|DÜRKOPP|PLC25[0-9]|PLC26[0-9]/i.test(eq+' '+line))return 'garment';
    if(/^F\d{3}$/.test(prefix) || /^W\d{3}$/.test(prefix) || prefix==='MS' || /MULTISHUTTLE|MULTI SHUTTLE/i.test(line))return 'multi';
    if(DEMATIC_PLC.has(prefix)||VANDERLANDE_PREFIX.has(prefix)||/PAQUETER[IÍ]A|TRANSPORTADOR|CINTA|SILO|CLASIFICADOR DE PAQUETER[IÍ]A/i.test(line))return 'parcel';
    return 'misc';
  }
  const allows=(group)=>filter==='all'||group===filter;
  const hit=(group,title,subtitle,details,open,rank=2,loc=null)=>({group,title,subtitle,details,open,rank,...(loc?.kind==='qr'?{qr:loc.code}:loc?{loc}:{})});
  // v0.1.71 · Búsqueda rápida de clasificadores Durkopp: CLA 1–6 e indocks 1–5.
  // Página 5 del layout PRC, con pockets 451–456 y acumuladores 801–806.
  // Pockets se visualizan como cadenas CT; acumuladores como trazados verdes de bypass BP.
  // Centros de acumuladores contrastados en el propio plano original (1800 × 1273 píxeles).
  const CLA_DATA = [
    {n:1,chain:'451',acc:'801',plc:'PLC252',x:1635,y:148},
    {n:2,chain:'452',acc:'802',plc:'PLC253',x:1377,y:148},
    {n:3,chain:'453',acc:'803',plc:'PLC259',x:1078,y:169},
    {n:4,chain:'454',acc:'804',plc:'PLC260',x:819,y:169},
    {n:5,chain:'455',acc:'805',plc:'',x:467,y:211},
    {n:6,chain:'456',acc:'806',plc:'',x:225,y:211}
  ];
  // v0.1.74 · Los acumuladores tienen trazados BP801–BP806 en el plano 5, no solo marcadores.
  // No altera el trazado de las cadenas de pockets, ni asigna un QR inexistente.
  const CLA_ACC_INDEX = new Map(CLA_DATA.map(item=>[item.acc,item]));
  for(const item of CLA_DATA){
    const page=LAYOUT.pages[4];
    if(!page)continue;
    const scaleX=page.w/1800,scaleY=page.h/1273,r=14;
    LAYOUT.bypasses[item.acc]=[{
      type:'bypass',page:5,
      x0:(item.x-r)*scaleX,y0:(item.y-r)*scaleY,
      x1:(item.x+r)*scaleX,y1:(item.y+r)*scaleY,
      context:'Acumulador '+item.acc+' · CLA '+item.n,
      accumulator:true,cla:item.n
    }];
  }
  const INDOCK_DATA = [
    {n:1,chain:'216'},
    {n:2,chain:'219'},
    {n:3,chain:'223'},
    {n:4,chain:'232'},
    {n:5,chain:'238'}
  ];
  function claIndex(q){
    if(['CLA','CLAS','CLASIFICADOR','CLASIFICADORES'].includes(q))return CLA_DATA;
    const m=q.match(/^(?:CLA|CLAS|CLASIFICADOR|CLASIFICADORES)0?([1-6])$/);
    if(m)return [CLA_DATA[Number(m[1])-1]];
    return null;
  }
  function indockIndex(q){
    if(['INDOCK','INDOCKS','INDOC','INDOCS'].includes(q))return INDOCK_DATA;
    const m=q.match(/^(?:INDOCK|INDOC)0?([1-5])$/);
    if(m)return [INDOCK_DATA[Number(m[1])-1]];
    return null;
  }
  function showClaAccumulator(item){
    // Usa exactamente el mismo flujo que los bypass habituales: LAYOUT.bypasses,
    // searchLayout(), marcador verde, página y zoom centrados.
    el('layoutQ').value=item.acc;
    searchLayout();
  }
  function searchCla(raw,q,items){
    const found=claIndex(q);if(!found)return false;
    if(!allows('garment'))return true;
    for(const item of found){
      if(!LAYOUT.chains[item.chain]?.length)continue;
      const rank=-100+item.n*2;
      items.push(hit('garment','Cadena de pockets '+item.chain,
        'Durkopp · CLA '+item.n,'Clasificador '+item.n+(item.plc?' · '+item.plc:'')+' · plano P05',()=>{
          // Los números 451-456 también tienen referencias auxiliares en otras páginas.
          // En una búsqueda CLA se debe abrir directamente el trazado de pockets de P05.
          el('layoutQ').value=item.chain;
          const pocketHit=(LAYOUT.chains[item.chain]||[]).find(h=>h.page===5);
          if(pocketHit)selectLayout(item.chain,{...pocketHit,type:'chain',claPocket:true},null);
          else searchLayout();
        },rank,{kind:'prc',type:'chain',key:item.chain}));
      items.push(hit('garment','Acumulador '+item.acc,
        'Durkopp · CLA '+item.n,'Clasificador '+item.n+' · trazado de dos ramales · plano P05',()=>{
          showClaAccumulator(item);
        },rank+1,{kind:'prc',type:'bypass',key:item.acc}));
    }
    return true;
  }
  function searchIndock(raw,q,items){
    const found=indockIndex(q);if(!found)return false;
    if(!allows('garment'))return true;
    for(const item of found){
      if(!LAYOUT.chains[item.chain]?.length)continue;
      items.push(hit('garment','Indock '+item.n+' · Cadena '+item.chain,
        'Durkopp · Prenda colgada','Indock '+item.n+' · cadena asociada '+item.chain,()=>{
          el('layoutQ').value=item.chain;searchLayout();
        },-70+item.n,{kind:'prc',type:'chain',key:item.chain}));
    }
    return true;
  }
  // v0.1.72 · Alias de Prenda colgada a partir del nombre real de cada cadena.
  // No cambiamos números ni localizaciones: usamos GARMENT_RELATIONS.chains y LAYOUT.chains.
  // Una descripción ambigua se resuelve como varios resultados, nunca como una cadena arbitraria.
  const GARMENT_ALIAS_INDEX = (()=>{
    const index=new Map();
    const register=(phrase,chain)=>{
      const key=compact(phrase);
      if(key.length<3)return;
      if(!index.has(key))index.set(key,new Set());
      index.get(key).add(chain);
    };
    const numbers=s=>String(s).replace(/\bII\b/g,'2').replace(/\bI\b/g,'1');
    const expanded=s=>numbers(String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
      .replace(/\bENTR\./g,'ENTRADA').replace(/\bSAL\./g,'SALIDA'));
    const chainNames=GARMENT_RELATIONS.chains||{};
    for(const [chain,name] of Object.entries(chainNames)){
      if(!LAYOUT.chains[chain]?.length)continue; // descarta minicarros que no son cadenas indexadas
      const title=expanded(name);
      register(name,chain);
      register(title,chain);
      if(title.startsWith('CADENA '))register(title.slice(7),chain);
      if(title.includes('PICKING'))register(title.replace(/PICKING/g,'PICK'),chain);
      if(/\bPICK\b/.test(title))register(title.replace(/\bPICK\b/g,'PICKING'),chain);
      if(title.includes('PRE-REPARTOS'))register(title.replace('PRE-REPARTOS','PRE REPARTOS'),chain);
      // Zonas compartidas: buscar STOCK 1, SPLITTER 1, PACKING 1 o EXPORT 1 muestra todas sus cadenas.
      for(const category of ['STOCK','SPLITTER','PACKING','EXPORT','GIB']){
        const re=new RegExp('\\b'+category+'[\\s-]*(\\d+)\\b');
        const match=title.match(re);
        if(match){
          register(category+' '+match[1],chain);
          register(category+' '+match[1].padStart(2,'0'),chain);
          register(category,chain);
        }
      }
      // Pick 1 puede referirse a Picking Pre-1 o a Salida Pick I; se devuelven ambas.
      const pre=title.match(/^PICKING PRE[- ]*(\d+)$/);
      if(pre){register('PRE '+pre[1],chain);register('PICK '+pre[1],chain);register('PICKING '+pre[1],chain)}
      const exit=title.match(/^SALIDA PICK[- ]*(\d+)$/);
      if(exit){register('PICK '+exit[1],chain);register('PICKING '+exit[1],chain)}
      if(/^PRE[- ]*\d+$/.test(title))register(title,chain);
      const docks=title.match(/\bMUELLES?\s+(\d+)\s+Y\s+(\d+)\b/);
      if(docks){for(const number of [docks[1],docks[2]]){
        register('MUELLE '+number,chain);register('MUELLES '+number,chain);
      }}
      // Una colectora sirve a dos CLA: el nombre específico debe apuntar a la misma cadena.
      const collectors=title.match(/^COLECTORA CLA\s*(\d+)\s+Y\s+CLA\s*(\d+)$/);
      if(collectors){for(const number of [collectors[1],collectors[2]])register('COLECTORA CLA '+number,chain)}
      const silo=title.match(/^LOOP (ENTRADA|SALIDA) SILO FASE (\d+)$/);
      if(silo){register('SILO FASE '+silo[2],chain);register('LOOP SILO FASE '+silo[2],chain)}
      // Nombres sin dirección cuando no pueden confundirse con un código numérico puro.
      const area=title.match(/^(?:REPARTO|SALIDA|ENTRADA|PICKING|EVACUACION|COLECTORA) (.+)$/);
      if(area && !/^(?:STOCK|SPLITTER|CLA|PACKING|EXPORT|GIB)\b/.test(area[1]))register(area[1],chain);
    }
    // Evita que una búsqueda "CLA 1" desvíe al técnico desde los pockets/acumuladores.
    // El motor CLA se ejecuta primero; aquí solo son alias de nombres como "colectora CLA 1".
    return index;
  })();
  function searchGarmentAlias(raw,q,items){
    const aliasKey=compact(String(raw).toUpperCase().replace(/\bENTR\./g,'ENTRADA').replace(/\bSAL\./g,'SALIDA').replace(/\bII\b/g,'2').replace(/\bI\b/g,'1'));
    const chains=GARMENT_ALIAS_INDEX.get(aliasKey);
    if(!chains)return false;
    if(!allows('garment'))return true;
    const names=GARMENT_RELATIONS.chains||{};
    for(const chain of chains){
      if(!LAYOUT.chains[chain]?.length)continue;
      const label=names[chain]||('Cadena '+chain);
      items.push(hit('garment',label+' · Cadena '+chain,
        'Durkopp · Prenda colgada',
        'Cadena '+chain+' · '+LAYOUT.chains[chain].length+' posiciones en planos',()=>{
          el('layoutQ').value=chain;searchLayout();
        },-60,{kind:'prc',type:'chain',key:chain}));
    }
    return true;
  }
  function searchDurkopp(raw,q,items){
    if(!allows('garment'))return;
    const named=q.match(/^(?:ACUMULADOR|ACUM|ACC)(?:CLA([1-6])|(80[1-6]))$/);
    if(!named&&!/^[0-9]{1,4}$/.test(raw))return;
    const key=named?(named[2]||String(800+Number(named[1]))):String(Number(raw));
    if(LAYOUT.chains[key]?.length){
      items.push(hit('garment','Cadena '+key,'Durkopp · Prenda colgada',LAYOUT.chains[key].length+' posiciones en planos',()=>{
        el('layoutQ').value=key;searchLayout();
      },0,{kind:'prc',type:'chain',key}));
    }
    if(LAYOUT.bypasses[key]?.length){
      const acc=CLA_ACC_INDEX.get(key);
      items.push(hit('garment',acc?'Acumulador '+key:'Bypass '+key,
        acc?'Durkopp · CLA '+acc.n:'Durkopp · Prenda colgada',
        acc?'Clasificador '+acc.n+' · plano P05':LAYOUT.bypasses[key].length+' posiciones en planos',()=>{
        el('layoutQ').value=key;
        if(LAYOUT.chains[key]?.length){
          layoutMatches=LAYOUT.bypasses[key].map(h=>({...h,type:'bypass'}));
          showLayoutMatch(0);
        }else searchLayout();
      },0,{kind:'prc',type:'bypass',key}));
    }
  }
  function searchDematic(raw,q,items){
    const numericOnly=/^\d+$/.test(q), seen=new Set();
    const add=(h,pos,rank=2)=>{
      const plc=String(h.plc||'CNX1').toUpperCase(),grp=groupForPlc(plc);
      if(!allows(grp))return;
      const k=[plc,h.per,h.layout_sheet,pos||''].join('|');
      if(seen.has(k))return; seen.add(k);
      const title=pos?(plc+' · '+pos):(plc+' · '+h.per);
      const details='Plano '+h.per+(pos?' · posición '+pos:'')+' · Pág. '+h.pdf_page;
      items.push(hit(grp,title,'Dematic · '+plc,details,()=>{
        el('paqQ').value=raw;
        paqPlcFilter=plc;
        el('paqPlcSelect').value=plc;
        showPaq(h,pos||null,null);
      },rank,{kind:'dematic',plc,pos}));
    };
    const plcQuery=Array.from(DEMATIC_PLC).filter(p=>compact(p)===q || (q.length>=4&&compact(p).includes(q)));
    for (const plc of plcQuery){
      if(!allows(groupForPlc(plc)))continue;
      const selected=PAQ.layouts.filter(h=>(h.plc||'CNX1')===plc);
      selected.slice(0,24).forEach(h=>add(h,null,1));
    }
    const isPer=q.startsWith('PER'), perTail=isPer?q.slice(3):'';
    for(const h of PAQ.layouts){
      const perC=compact(h.per),pn=String(parseInt(h.per.replace(/\D/g,''),10)),p2=pn.padStart(2,'0');
      let matched=false;
      if(isPer){matched=perC.includes(q)||(perTail&&(pn.includes(perTail)||p2.includes(perTail)))}
      else if(numericOnly&&q.length<=2){matched=pn===String(parseInt(q,10))||p2.includes(q)}
      if(matched)add(h,null,perC===q?0:2);
    }
    if(q.length>=2){
      for(const [pos,arr] of Object.entries(PAQ.positions)){
        const cp=compact(pos);
        if(!cp.includes(q))continue;
        for(const h of arr)add(h,pos,cp===q?0:cp.startsWith(q)?1:2);
      }
    }
  }
  function searchTgwIndex(raw,q,items){
    if(!allows('multi'))return;
    // Un resultado por transporte real, aunque tenga dos páginas en el plano.
    for(const {group,rank} of tgwSearchGroups(raw)){
      items.push(hit('multi',group.key,'TGW · Multishuttle',
        'Plano TGW · '+tgwPageLabel(group),()=>{
          el('tgwQ').value=group.key;
          showTgw(group.entries[0],null);
        },rank,{kind:'tgw',code:group.key}));
    }
  }
  function searchVanIndex(q,items){
    if(!allows('parcel'))return;
    const plans=vanPlanQuery(q);
    if(plans.length){for(const h of plans)items.push(hit('parcel',`Plano Vanderlande · PLC${h.plc} · LCC${h.lcc}`,'Vanderlande · '+vanArea(h.plc),'Plano de referencia de zona',()=>vanOpen(h.plc,h.lcc,h.code,null),0));return;}
    const seen=new Set();
    for(const h of VANDERLANDE_INDEX){
      const key=compact(h.code);
      if(!key.includes(q))continue;
      const k=h.plc+'|'+h.lcc+'|'+h.code;
      if(seen.has(k))continue; seen.add(k);
      items.push(hit('parcel',h.code,'Vanderlande · PLC'+h.plc,'Plano EM · LCC'+String(h.lcc).padStart(2,'0'),()=>{
        el('vanQ').value=activeQuery;
        vanOpen(h.plc,h.lcc,h.code,null);
      },score(h.code,q),{kind:'van',code:h.code}));
    }
  }
  function searchQRAssets(raw,q,items){
    const numericShort=/^\d{1,3}$/.test(raw.trim());
    for(const r of MedinaAssets.records()){
      const id=String(r.c||''),code=String(r.e||''),line=String(r.l||''),group=classifyAsset(r);
      if(!allows(group))continue;
      let rank=5;
      const canonical=group==='multi'?tgwCanonicalRef(code):null,query=group==='multi'?tgwCanonicalRef(raw):null;
      if((canonical&&query&&canonical===query)||compact(id)===q||compact(code)===q)rank=0;
      else if(numericShort)continue;
      else if(compact(id).startsWith(q)||compact(code).startsWith(q))rank=1;
      else if(compact(id).includes(q)||compact(code).includes(q))rank=2;
      else if(compact(line).includes(q))rank=3;
      if(rank<=3)items.push(hit(group,code||id,'QR '+id,line||'Activo',()=>showQR(r),rank,{kind:'qr',code:id}));
    }
  }
  function setView(section,tag,ctx){
    const back=el('assetToolBack');if(back)back.hidden=true;
    ChainHighlight.clear();
    document.querySelectorAll('main > section.section').forEach(sectionEl=>sectionEl.classList.toggle('active',sectionEl.id===section));
    el('v71DetailBar').hidden=false;
    el('v71DetailTag').textContent=tag;
    body.classList.add('v71-detail');
    opened=ctx;
    el('v71Home').classList.remove('active');
    el('v71Checklist').classList.remove('active');
    const map={layoutSection:'layout',paqSection:'paq',vanSection:'van',tgwSection:'tgw',qrSection:'qr'};
    applyMakerTheme(map[section]||'layout');
    window.scrollTo(0,0);
  }
  function showAsset(asset,query=activeQuery){
    if(!asset)return;
    setView('qrSection','Activo · QR '+asset.qr,{key:'qr',section:'Activo QR '+asset.qr,query,detail:asset.aliases.join(' · ')+' · '+asset.pages.map(p=>p.label).join(' / ')+(asset.referencePages?.length?' · Planos de referencia pendientes de verificar: '+asset.referencePages.map(p=>p.label).join(' / '):'')});
    showQR(asset.record);
    window.MedinaUsage?.track('asset',{qr:asset.qr});
  }
  window.medinaShowAsset=showAsset;
  window.medinaOpenAssetTool=(asset,tool)=>{
    const section={prc:'layoutSection',dematic:'paqSection',tgw:'tgwSection',van:'vanSection'}[tool.kind];
    const query=opened?.query||activeQuery;
    setView(section,'Herramientas · QR '+asset.qr,{key:section.replace('Section',''),section:'Activo QR '+asset.qr,query,detail:asset.record.e});
    MedinaAssets.runTool(asset,tool);
    window.MedinaUsage?.track('plan',{filter:tool.kind});
    let back=el('assetToolBack');
    if(!back){back=document.createElement('button');back.id='assetToolBack';back.type='button';el('v71DetailBar').appendChild(back);}
    back.hidden=false;back.textContent='← Activo QR '+asset.qr;back.onclick=()=>showAsset(asset,query);
  };
  function openHit(h){
    if(h.asset){showAsset(h.asset);return;}
    window.MedinaUsage?.track('plan',{filter:h.group});
    const section=h.subtitle.startsWith('Durkopp')?'layoutSection':h.subtitle.startsWith('Dematic')?'paqSection':h.subtitle.startsWith('Vanderlande')?'vanSection':h.subtitle.startsWith('TGW')?'tgwSection':'qrSection';
    setView(section, GROUPS[h.group]||'QR instalación', {
      key:section.replace('Section',''),section:GROUPS[h.group]||'QR instalación',
      query:activeQuery,detail:h.title+' · '+h.details
    });
    try{h.open()}catch(error){
      console.error('No se pudo abrir el resultado del buscador unificado',error);
      el('v71DetailTag').textContent='Error al abrir el resultado';
    }
  }
  function groupedOrder(){
    return filter==='all'?['garment','parcel','multi','misc']:[filter];
  }
  function render(items,raw){
    items=MedinaAssets.unifyHits(items);
    window.MedinaUsage?.track('search',{query:raw,filter,results:items.length});
    const box=el('v71Results');box.replaceChildren();
    if(!items.length){
      const em=document.createElement('div');em.className='v71-empty';
      em.textContent='Sin coincidencias para «'+raw+'».';
      box.appendChild(em);
      el('v71Status').textContent='Sin resultados en '+FILTER_LABEL[filter]+'.';
      if(typeof window.showMissingReport==='function')window.showMissingReport('v71Status',raw);
      return;
    }
    if(window.hideMissingReport)hideMissingReport('v71Status');
    items.sort((a,b)=>a.rank-b.rank||a.title.localeCompare(b.title,'es',{numeric:true}));
    el('v71Status').textContent=items.length+(items.length===1?' coincidencia en ':' coincidencias en ')+FILTER_LABEL[filter].toLowerCase()+'.';
    for(const g of groupedOrder()){
      const own=items.filter(h=>h.group===g);if(!own.length)continue;
      const group=document.createElement('section');group.className='v71-group';
      const top=document.createElement('div');top.className='v71-group-heading';
      const title=document.createElement('h3');title.textContent=GROUPS[g];
      const counter=document.createElement('span');counter.className='v71-count';counter.textContent=own.length+' resultado'+(own.length===1?'':'s');
      top.append(title,counter);group.appendChild(top);
      let limit=25;
      function append(start,end){
        for(const h of own.slice(start,end)){
          const b=document.createElement('button');b.type='button';b.className='v71-hit';if(h.qr)b.dataset.qr=h.qr;
          const left=document.createElement('span');
          const strong=document.createElement('b');strong.textContent=h.title;
          const small=document.createElement('small');small.textContent=h.subtitle+' · '+h.details;
          const arrow=document.createElement('span');arrow.className='v71-hit-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='›';
          const refs=h.asset?.refs||[h.loc];
          const isChain=refs.some(ref=>ref?.kind==='prc'&&ref.type==='chain');
          const isBypass=refs.some(ref=>ref?.kind==='prc'&&ref.type==='bypass'&&!CLA_DATA.some(cla=>cla.acc===String(ref.key)));
          const isSorter=refs.some(ref=>ref?.kind==='prc'&&ref.type==='chain'&&CLA_DATA.some(cla=>cla.chain===String(ref.key)));
          const iconName=isSorter?'clasificador':isChain?'valla':isBypass?'bypass':null;
          if(iconName){
            const heading=document.createElement('span');heading.className='v71-hit-heading';
            const icon=document.createElement('img');icon.className='v71-hit-icon';icon.src='./asset-icons/'+iconName+'.webp';
            icon.width=52;icon.height=36;icon.alt='';icon.setAttribute('aria-hidden','true');
            heading.append(icon,strong);left.append(heading,small);
          }else left.append(strong,small);
          b.append(left,arrow);
          b.addEventListener('click',()=>openHit(h));group.appendChild(b);
        }
      }
      append(0,limit);
      if(own.length>limit){
        const more=document.createElement('button');more.type='button';more.className='v71-more';more.textContent='Mostrar más resultados ('+(own.length-limit)+' restantes)';
        more.addEventListener('click',()=>{
          more.remove();let old=limit;limit=Math.min(limit+50,own.length);append(old,limit);
          if(limit<own.length){more.textContent='Mostrar más resultados ('+(own.length-limit)+' restantes)';group.append(more)}
        });
        group.append(more);
      }
      box.append(group);
    }
  }
  async function search(){
    const raw=el('v71Query').value.trim();
    const q=compact(raw).replace(/^QR(?=\d{4,}$)/,'');
    const my=++serial;
    activeQuery=raw;lastSearch=raw;
    el('v71Clear').hidden=!raw;
    if(window.hideMissingReport)hideMissingReport('v71Status');
    if(!q){el('v71Status').textContent='';el('v71Results').replaceChildren();return;}
    el('v71Status').textContent='Buscando en '+FILTER_LABEL[filter].toLowerCase()+'…';
    await MedinaAssets.ensure();if(my!==serial)return;
    const items=[];
    // Una búsqueda CLA se resuelve con su pareja pockets/acumulador, evitando ruido QR.
    if(searchCla(raw,q,items)){
      if(!allows('garment')){
        const area=el('v71Results');area.replaceChildren();
        const note=document.createElement('div');note.className='v71-empty';
        note.textContent='Selecciona Prenda colgada.';
        const change=document.createElement('button');change.type='button';change.className='v71-more';
        change.textContent='Ver en Prenda colgada';
        change.onclick=()=>document.querySelector('.v71-filter-row [data-filter="garment"]').click();
        area.append(note,change);
        el('v71Status').textContent='Prenda colgada';
        window.MedinaUsage?.track('search',{query:raw,filter,results:0});
      }else{
        currentItems=items;render(items,raw);
      }
      return;
    }
    if(searchIndock(raw,q,items)){
      if(!allows('garment')){
        const area=el('v71Results');area.replaceChildren();
        const note=document.createElement('div');note.className='v71-empty';
        note.textContent='Selecciona Prenda colgada.';
        const change=document.createElement('button');change.type='button';change.className='v71-more';
        change.textContent='Ver en Prenda colgada';
        change.onclick=()=>document.querySelector('.v71-filter-row [data-filter="garment"]').click();
        area.append(note,change);
        el('v71Status').textContent='Prenda colgada';
        window.MedinaUsage?.track('search',{query:raw,filter,results:0});
      }else{
        currentItems=items;render(items,raw);
      }
      return;
    }
    // Los alias semánticos se consultan antes de QR y transportes de otras zonas.
    // Se conservan las búsquedas de números, CLA e INDOCK sin modificaciones.
    if(searchGarmentAlias(raw,q,items)){
      if(!allows('garment')){
        const area=el('v71Results');area.replaceChildren();
        const note=document.createElement('div');note.className='v71-empty';
        note.textContent='Este nombre de cadena pertenece a Prenda colgada. Cambia a ese filtro o a Todos.';
        const change=document.createElement('button');change.type='button';change.className='v71-more';
        change.textContent='Ver en Prenda colgada';
        change.onclick=()=>document.querySelector('.v71-filter-row [data-filter="garment"]').click();
        area.append(note,change);
        el('v71Status').textContent='Este elemento pertenece a Prenda colgada.';
        window.MedinaUsage?.track('search',{query:raw,filter,results:0});
      }else{
        currentItems=items;render(items,raw);
      }
      return;
    }
    searchDurkopp(raw,q,items);
    searchDematic(raw,q,items);
    searchTgwIndex(raw,q,items);
    searchVanIndex(q,items);
    if(q.length>=2){
      try{await loadFullAssets()}catch(err){console.warn('Búsqueda limitada a base QR ligera',err)}
      if(my!==serial)return;
      searchQRAssets(raw,q,items);
    }
    if(my!==serial)return;
    currentItems=items;render(items,raw);
  }
  function openHome(){
    el('usageOpen').classList.remove('active');el('usageOpen').removeAttribute('aria-current');el('v71Home').setAttribute('aria-current','page');
    const back=el('assetToolBack');if(back)back.hidden=true;ChainHighlight.clear();
    document.querySelectorAll('main > section.section').forEach(sec=>sec.classList.toggle('active',sec.id==='unifiedSection'));
    body.classList.remove('v71-detail');
    el('v71DetailBar').hidden=true;
    el('v71Home').classList.add('active');el('v71Checklist').classList.remove('active');
    opened=null;body.dataset.theme='durkopp';
    window.scrollTo(0,0);
  }
  window.v71GetReportContext=()=>{
    if(el('checkSection').classList.contains('active'))return {key:'check',section:'Checklist',query:'',detail:''};
    if(opened)return opened;
    return {key:'unified',section:FILTER_LABEL[filter],query:el('v71Query').value.trim(),detail:'Buscador unificado · v0.1.92 BETA'};
  };
  el('v71Form').addEventListener('submit',event=>{event.preventDefault();el('v71Query').blur();search()});
  el('v71Clear').addEventListener('click',()=>{el('v71Query').value='';search();el('v71Query').focus()});
  for(const btn of document.querySelectorAll('.v71-filter-row [data-filter]')){
    btn.addEventListener('click',()=>{
      filter=btn.dataset.filter;
      document.querySelectorAll('.v71-filter-row [data-filter]').forEach(b=>{const yes=b.dataset.filter===filter;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes))});
      if(el('v71Query').value.trim())search();
    });
  }
  el('v71Return').onclick=openHome;
  el('v71Home').onclick=openHome;
  el('v71Checklist').onclick=()=>{
    el('usageOpen').classList.remove('active');el('checkOpen').click();el('unifiedSection').classList.remove('active');el('v71DetailBar').hidden=true;body.classList.remove('v71-detail');
    opened=null;el('v71Home').classList.remove('active');el('v71Checklist').classList.add('active');
  };
  el('checkBack').textContent='← Volver al buscador';
  el('checkBack').onclick=openHome;
  el('qrBack').onclick=openHome;
  openHome();
})();

/* Grupo 5 · v71 BETA · Unifica motores existentes sin modificar sus índices ni sus visores. */
(() => {
  'use strict';
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
  const hit=(group,title,subtitle,details,open,rank=2)=>({group,title,subtitle,details,open,rank});
  function searchDurkopp(raw,q,items){
    if(!allows('garment')||!/^[0-9]{1,4}$/.test(raw))return;
    const key=String(Number(raw));
    if(LAYOUT.chains[key]?.length){
      items.push(hit('garment','Cadena '+key,'Durkopp · Prenda colgada',LAYOUT.chains[key].length+' posiciones en planos',()=>{
        el('layoutQ').value=key;searchLayout();
      },0));
    }
    if(LAYOUT.bypasses[key]?.length){
      items.push(hit('garment','Bypass '+key,'Durkopp · Prenda colgada',LAYOUT.bypasses[key].length+' posiciones en planos',()=>{
        el('layoutQ').value=key;
        if(LAYOUT.chains[key]?.length){
          layoutMatches=LAYOUT.bypasses[key].map(h=>({...h,type:'bypass'}));
          showLayoutMatch(0);
        }else searchLayout();
      },0));
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
      },rank));
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
  function searchTgwIndex(q,items){
    if(!allows('multi'))return;
    const seen=new Set();
    for(const e of TGW.entries){
      const c=compact(e.code),root=compact(e.root);
      if(!c.includes(q)&&!root.includes(q))continue;
      const k=e.code+'|'+e.page;
      if(seen.has(k))continue;seen.add(k);
      items.push(hit('multi',e.code,'TGW · Multishuttle','Plano TGW · Página '+e.page,()=>{
        el('tgwQ').value=activeQuery;
        showTgw(e,null);
      },Math.min(score(e.code,q),score(e.root,q))));
    }
  }
  function searchVanIndex(q,items){
    if(!allows('parcel'))return;
    const seen=new Set();
    for(const h of VANDERLANDE_INDEX){
      const key=compact(h.code);
      if(!key.includes(q))continue;
      const k=h.plc+'|'+h.lcc+'|'+h.code;
      if(seen.has(k))continue; seen.add(k);
      items.push(hit('parcel',h.code,'Vanderlande · PLC'+h.plc,'Plano EM · LCC'+String(h.lcc).padStart(2,'0'),()=>{
        el('vanQ').value=activeQuery;
        vanOpen(h.plc,h.lcc,h.code,null);
      },score(h.code,q)));
    }
  }
  function searchQRAssets(raw,q,items){
    const source=fullAssets||MAPPED_ASSETS;
    const numericShort=/^\d{1,3}$/.test(raw.trim());
    for(const r of source){
      const id=String(r.c||''),code=String(r.e||''),line=String(r.l||'');
      const group=classifyAsset(r);
      if(!allows(group))continue;
      let rank=5;
      if(compact(id)===q||compact(code)===q)rank=0;
      else if(numericShort)continue; // Evita mostrar códigos QR no relacionados con una cadena de 3 cifras.
      else if(compact(id).startsWith(q)||compact(code).startsWith(q))rank=1;
      else if(compact(id).includes(q)||compact(code).includes(q))rank=2;
      else if(compact(line).includes(q))rank=3;
      if(rank>3)continue;
      // Los transportes Vanderlande con QR se abren en su visor específico si tienen PLC asociado.
      if(group==='parcel'&&vanIsQrTransport(r)){
        const v=vanQrHit(r);
        items.push(hit('parcel',code,'Vanderlande · QR '+id,line||'Transporte',()=>{
          el('vanQ').value=activeQuery;
          vanOpen(v.plc,v.lcc,v.code,v.asset);
        },rank));
      }else{
        items.push(hit(group,code||id,'QR instalación · '+id,line||'Equipo de la instalación',()=>{
          el('qrQ').value=activeQuery;
          showQR(r);
        },rank));
      }
    }
  }
  function setView(section,tag,ctx){
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
  function openHit(h){
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
    const box=el('v71Results');box.replaceChildren();
    if(!items.length){
      const em=document.createElement('div');em.className='v71-empty';
      em.textContent='No se ha encontrado la referencia «'+raw+'» en las zonas seleccionadas. Comprueba el código o repórtalo a Medina.';
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
          const b=document.createElement('button');b.type='button';b.className='v71-hit';
          const left=document.createElement('span');
          const strong=document.createElement('b');strong.textContent=h.title;
          const small=document.createElement('small');small.textContent=h.subtitle+' · '+h.details;
          const arrow=document.createElement('span');arrow.className='v71-hit-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='›';
          left.append(strong,small);b.append(left,arrow);
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
    const q=compact(raw);
    const my=++serial;
    activeQuery=raw;lastSearch=raw;
    el('v71Clear').hidden=!raw;
    if(window.hideMissingReport)hideMissingReport('v71Status');
    if(!q){el('v71Status').textContent='Escribe una referencia, PLC o QR para comenzar.';el('v71Results').replaceChildren();return;}
    el('v71Status').textContent='Buscando en '+FILTER_LABEL[filter].toLowerCase()+'…';
    const items=[];
    searchDurkopp(raw,q,items);
    searchDematic(raw,q,items);
    searchTgwIndex(q,items);
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
    return {key:'unified',section:FILTER_LABEL[filter],query:el('v71Query').value.trim(),detail:'Buscador unificado · v71 BETA'};
  };
  el('v71Form').addEventListener('submit',event=>{event.preventDefault();search()});
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
    el('checkOpen').click();el('unifiedSection').classList.remove('active');el('v71DetailBar').hidden=true;body.classList.remove('v71-detail');
    opened=null;el('v71Home').classList.remove('active');el('v71Checklist').classList.add('active');
  };
  el('checkBack').textContent='← Volver al buscador';
  el('checkBack').onclick=openHome;
  el('v71Help').onclick=()=>el('helpBtn').click();
  el('qrBack').onclick=openHome;
  openHome();
})();

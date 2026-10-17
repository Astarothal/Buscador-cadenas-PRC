/* Métricas anónimas. El endpoint solo se usa en la beta privada del mismo origen. */
(function(){
 'use strict';
 const Core=MedinaUsageCore,$=id=>document.getElementById(id),KEY='medina-usage-v1',SESSION='medina-usage-session-v1';
 const hosted=location.hostname==='buscador-medina-beta.redbean7.chatgpt.site',endpoint=hosted?'./api/usage':null;
 let memory={events:[],pending:[],dropped:0},busy=false,flushTask=null,refreshSerial=0,latest=null,storageOK=true,unlocked=false,needsSetup=false,lockTimer=null,gateSerial=0;
 const uid=()=>globalThis.crypto?.randomUUID?.()||'m'+Date.now().toString(36)+Math.random().toString(36).slice(2);
 function read(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return v&&Array.isArray(v.events)&&Array.isArray(v.pending)?v:memory;}catch{storageOK=false;return memory;}}
 function write(s){memory=s;try{localStorage.setItem(KEY,JSON.stringify(s));}catch{storageOK=false;}}
 let session;try{session=JSON.parse(sessionStorage.getItem(SESSION)||'null');}catch{}
 function track(type,data={}){
  const now=Date.now();if(!session||now-session.last>1800000)session={id:uid(),last:now};session.last=now;
  try{sessionStorage.setItem(SESSION,JSON.stringify(session));}catch{}
  const device=matchMedia('(max-width: 600px)').matches?'mobile':matchMedia('(max-width: 1024px)').matches?'tablet':'desktop';
  const e=Core.normalize({...data,id:uid(),session:session.id,ts:now,type,device,offline:navigator.onLine===false},now);if(!e)return;
  const state=read();state.events=state.events.filter(e=>e.ts>=now-90*86400000).slice(-19999);state.events.push(e);
  state.pending=state.pending.filter(e=>e.ts>=now-90*86400000);if(endpoint){if(state.pending.length>=1000){state.pending.shift();state.dropped=(state.dropped||0)+1;}state.pending.push(e);}write(state);
  if(endpoint)void flush();
 }
 function flush(){if(flushTask)return flushTask;flushTask=send().finally(()=>{flushTask=null;});return flushTask;}
 async function send(){
  if(!endpoint||busy||navigator.onLine===false)return false;busy=true;
  try{for(let n=0;n<10;n++){
   const pending=read().pending.slice(0,100);if(!pending.length)return true;
   const r=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:pending}),cache:'no-store',keepalive:true,signal:AbortSignal.timeout(12000)});
   if(!r.ok||!r.headers.get('content-type')?.includes('json'))return false;
   const data=await r.json();if(!Array.isArray(data.accepted))return false;
   const ids=new Set(data.accepted),s=read();s.pending=s.pending.filter(e=>!ids.has(e.id));write(s);
   if(!pending.every(e=>ids.has(e.id)))return false;
  }return !read().pending.length;}catch{return false;}finally{busy=false;}
 }
 const fmt=n=>Number(n||0).toLocaleString('es-ES'),date=ts=>ts?new Date(ts).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}):'sin actividad';
 const labels={all:'Todas las zonas',garment:'Prenda colgada',parcel:'Paquetería',multi:'Multishuttle',misc:'Otros',mobile:'Móvil',tablet:'Tableta',desktop:'Escritorio'};
 function empty(node,text='Sin datos en este periodo'){const p=document.createElement('p');p.className='usage-muted';p.textContent=text;node.replaceChildren(p);}
 function bars(id,rows){const node=$(id);node.replaceChildren();if(!rows?.length){empty(node);return;}
  const max=Math.max(...rows.map(r=>r.value),1);for(const r of rows){const row=document.createElement('div');row.className='usage-bar-row';const label=document.createElement('span');label.textContent=labels[r.label]||r.label;const rail=document.createElement('div');rail.className='usage-bar-rail';const fill=document.createElement('i');fill.style.width=(r.value/max*100)+'%';rail.append(fill);const value=document.createElement('b');value.textContent=fmt(r.value);row.append(label,rail,value);node.append(row);}}
 function table(id,rows,qr=false){const node=$(id);node.replaceChildren();if(!rows?.length){empty(node);return;}
  const table=document.createElement('table');table.className='usage-table';const head=document.createElement('tr');for(const text of [qr?'Activo':'Consulta','Veces']){const th=document.createElement('th');th.scope='col';th.textContent=text;head.append(th);}table.append(head);
  for(const r of rows){const tr=document.createElement('tr'),td=document.createElement('td'),count=document.createElement('td');td.textContent=(qr?'QR ':'')+(r.label||'(vacía)');count.textContent=fmt(r.value);tr.append(td,count);table.append(tr);}node.append(table);}
 function daily(rows,days){
  const node=$('usageDays');node.replaceChildren();const points=[],map=new Map(rows.map(r=>[r.label,r.value]));
  for(let i=days-1;i>=0;i--){const [y,m,d]=Core.day(Date.now()).split('-').map(Number);const label=new Date(Date.UTC(y,m-1,d-i,12)).toISOString().slice(0,10);points.push({label,value:map.get(label)||0});}
  if(!points.some(p=>p.value)){empty(node);return;}
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 600 180');svg.setAttribute('role','img');svg.setAttribute('aria-label','Búsquedas diarias; desglose disponible debajo');
  const max=Math.max(...points.map(p=>p.value),1),step=560/points.length;
  for(let i=0;i<points.length;i++){const p=points[i],rect=document.createElementNS(ns,'rect');rect.setAttribute('x',String(25+i*step));rect.setAttribute('y',String(145-p.value/max*125));rect.setAttribute('width',String(Math.max(2,step-2)));rect.setAttribute('height',String(p.value/max*125));rect.setAttribute('rx','2');const title=document.createElementNS(ns,'title');title.textContent=p.label+': '+p.value;rect.append(title);svg.append(rect);}
  for(const [x,text] of [[25,points[0].label.slice(5)],[520,points.at(-1).label.slice(5)]]){const t=document.createElementNS(ns,'text');t.setAttribute('x',String(x));t.setAttribute('y','170');t.textContent=text;svg.append(t);}
  node.append(svg);const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Ver datos diarios';details.append(summary);const list=document.createElement('div');for(const p of points){const row=document.createElement('p');row.textContent=p.label+' · '+fmt(p.value);list.append(row);}details.append(list);node.append(details);
 }
 function render(data,fallback=false){
  latest=data;const s=read(),shared=data.scope==='shared';
  $('usageScope').textContent=shared?'Datos compartidos de la beta privada · todos sus dispositivos autorizados':hosted?'Datos de este dispositivo · servidor no disponible':'Datos de este dispositivo · GitHub Pages / modo estático';
  const pending=endpoint?s.pending.length:0;
  $('usageUpdated').textContent='Actualizado: '+date(data.updated)+' · Registro disponible desde: '+date(data.collectionStart)+(pending?' · '+pending+' eventos pendientes de sincronizar.':'')+(s.dropped?' · '+s.dropped+' eventos antiguos no enviados por límite de cola.':'')+(!storageOK?' · El navegador no permite guardar datos; solo se conserva esta sesión.':'')+(fallback?' · Pulsa Actualizar cuando vuelva la conexión.':'');
  const success=data.searches?Math.round((data.searches-data.misses)/data.searches*100):null;
  const metrics=[['Sesiones activas',data.sessions],['Búsquedas',data.searches],['Con resultados',success===null?'—':success+' %'],['Sin resultados',data.misses],['Aperturas de activos',data.assets],['Búsquedas sin conexión',data.offline],['Aperturas de planos',data.plans],['Borradores de reporte',data.reports]];
  $('usageMetrics').replaceChildren();for(const [label,value] of metrics){const card=document.createElement('div'),n=document.createElement('strong'),l=document.createElement('span');card.className='usage-metric';n.textContent=typeof value==='number'?fmt(value):value;l.textContent=label;card.append(n,l);$('usageMetrics').append(card);}
  $('usageEmpty').hidden=!!data.events;daily(data.daysData||[],data.days);bars('usageDevices',data.devices);bars('usageFilters',data.filters);
  const h=new Map((data.hours||[]).map(r=>[Number(r.label),r.value])),max=Math.max(...h.values(),1);$('usageHours').replaceChildren();for(let i=0;i<24;i++){const box=document.createElement('div'),label=document.createElement('span'),value=document.createElement('b');box.className='usage-hour';box.style.background=`rgba(15,105,115,${.05+(h.get(i)||0)/max*.3})`;label.textContent=String(i).padStart(2,'0')+':00';value.textContent=fmt(h.get(i)||0);box.append(label,value);$('usageHours').append(box);}
  table('usageQueries',data.queries);table('usageMissing',data.missing);table('usageAssets',data.assetsData,true);
 }
 async function refresh(){
  if(!unlocked)return;
  const serial=++refreshSerial,days=Number($('usageRange').value);$('usageUpdated').textContent='Actualizando…';
  await flush();if(serial!==refreshSerial)return;
  if(endpoint&&navigator.onLine!==false){try{const r=await fetch(endpoint+'?days='+days,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const data=await r.json();if(data.scope!=='shared')throw Error();if(serial===refreshSerial&&unlocked)render(data);return;}catch{}}
  if(serial===refreshSerial&&unlocked){clearStats();$('v71Home').click();void showGate('No se ha podido leer el panel. Revisa la conexión e introduce de nuevo tu clave.');}
 }
 function open(){if(!unlocked)return;document.querySelectorAll('main > section.section').forEach(sec=>sec.classList.toggle('active',sec.id==='usageSection'));document.body.classList.remove('v71-detail');$('v71DetailBar').hidden=true;document.querySelectorAll('.v71-nav-button').forEach(b=>{b.classList.remove('active');b.removeAttribute('aria-current');});window.scrollTo(0,0);void refresh();}
 function clearStats(){unlocked=false;latest=null;++refreshSerial;clearTimeout(lockTimer);for(const id of ['usageMetrics','usageDays','usageHours','usageDevices','usageFilters','usageQueries','usageMissing','usageAssets'])$(id).replaceChildren();$('usageScope').textContent='Acceso privado bloqueado';$('usageUpdated').textContent='';}
 async function access(body){const r=await fetch(endpoint+'/access',{method:body?'POST':'GET',cache:'no-store',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body),keepalive:true}:{}),signal:AbortSignal.timeout(12000)});const data=await r.json();if(!r.ok)throw Error(data.error||'Acceso no disponible');return data;}
 function closeGate(){++gateSerial;$('usageGate').hidden=true;document.body.style.overflow='';$('usagePassword').value='';$('usageConfirm').value='';$('usageLoginError').textContent='';$('helpBtn').focus();}
 async function showGate(message=''){
  const n=++gateSerial;clearStats();$('helpClose').click();$('usageGate').hidden=false;document.body.style.overflow='hidden';$('usageLoginForm').hidden=true;$('usageGateIntro').textContent='Comprobando acceso privado…';$('usageLoginError').textContent=message;$('usagePassword').value='';$('usageConfirm').value='';$('usageGateClose').focus();
  if(!endpoint){$('usageGateIntro').textContent='Las estadísticas privadas se consultan en la beta alojada, con tu cuenta y tu clave. Esta versión estática no permite acceder al panel.';return;}
  try{await access({action:'logout'});const state=await access();if(n!==gateSerial)return;needsSetup=state.needsSetup;$('usageGateTitle').textContent=needsSetup?'Crea tu clave privada':'Acceso privado';$('usageGateIntro').textContent=needsSetup?'Solo el propietario puede configurar este acceso. Elige una clave de al menos 12 caracteres. Se guardará protegida en el servidor.':'Introduce tu clave para ver las estadísticas. Acceso exclusivo del propietario.';$('usageConfirmWrap').hidden=!needsSetup;$('usageConfirm').required=needsSetup;$('usagePassword').autocomplete=needsSetup?'new-password':'current-password';$('usageLoginSubmit').textContent=needsSetup?'Crear clave y entrar':'Entrar';$('usageLoginForm').hidden=false;$('usagePassword').focus();}catch(error){if(n===gateSerial)$('usageGateIntro').textContent=error.message;}
 }
 async function login(event){event.preventDefault();const n=gateSerial,password=$('usagePassword').value;if(needsSetup&&password!==$('usageConfirm').value){$('usageLoginError').textContent='Las claves no coinciden';return;}$('usageLoginSubmit').disabled=true;$('usageLoginError').textContent='Verificando…';try{await access({action:needsSetup?'setup':'login',password});if(n!==gateSerial){void access({action:'logout'}).catch(()=>{});return;}closeGate();unlocked=true;lockTimer=setTimeout(()=>{clearStats();$('v71Home').click();},1800000);open();}catch(error){if(n===gateSerial){$('usageLoginError').textContent=error.message;$('usagePassword').value='';$('usagePassword').focus();}}finally{$('usageLoginSubmit').disabled=false;}}
 function lock(){clearStats();$('v71Home').click();if(endpoint)void access({action:'logout'}).catch(()=>{});}
 function exportCSV(){if(!unlocked||!latest)return;const rows=[['Ámbito',latest.scope==='shared'?'Beta privada compartida':'Solo este dispositivo'],['Periodo',latest.days+' días'],['Actualizado',date(latest.updated)],['Métrica','Valor'],...['sessions','searches','misses','assets','plans','reports','offline'].map((key,i)=>[['Sesiones activas','Búsquedas','Sin resultados','Aperturas de activos','Aperturas de planos','Borradores','Búsquedas sin conexión'][i],latest[key]||0])];
  for(const [key,label] of [['daysData','Día'],['hours','Hora Madrid'],['devices','Dispositivo'],['filters','Zona'],['queries','Consulta'],['missing','Sin resultados'],['assetsData','QR']]){rows.push([], [label,'Veces']);for(const r of latest[key]||[])rows.push([r.label,r.value]);}
  const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const blob=new Blob(['\ufeff'+rows.map(row=>row.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='medina-estadisticas-'+Core.day(Date.now())+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 $('usageOpen').onclick=e=>{e.preventDefault();void showGate();};$('usageBack').textContent='Cerrar estadísticas';$('usageBack').onclick=lock;$('usageLoginForm').onsubmit=login;$('usageGateClose').onclick=closeGate;
 $('usageGate').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeGate();}if(e.key==='Tab'){const fields=[...$('usageGate').querySelectorAll('button,input')].filter(x=>!x.disabled&&!x.closest('[hidden]'));const first=fields[0],last=fields.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 for(const id of ['v71Home','v71Checklist'])$(id).addEventListener('click',()=>{if(unlocked){clearStats();if(endpoint)void access({action:'logout'}).catch(()=>{});}});
 window.addEventListener('pagehide',()=>{if(unlocked){clearStats();if(endpoint)void access({action:'logout'}).catch(()=>{});}});$('usageRange').onchange=refresh;$('usageRefresh').onclick=refresh;$('usageExport').onclick=exportCSV;
 window.addEventListener('online',()=>{void flush();if($('usageSection').classList.contains('active'))void refresh();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void flush();});
 window.MedinaUsage=Object.freeze({track,flush,refresh,summary:(days=30)=>Core.summarize(read().events,days),pending:()=>read().pending.length});
 track('session');
})();

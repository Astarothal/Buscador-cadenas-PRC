/* Contrato compartido por la app y el servidor. No contiene identidad personal. */
(function(root){
 'use strict';
 const DAY=86400000,TYPES=['session','search','asset','plan','report'];
 const dateFmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
 const hourFmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',hour:'2-digit',hourCycle:'h23'});
 const day=ts=>dateFmt.format(new Date(ts));
 function since(days,now=Date.now()){
  const d=day(now),[y,m,n]=d.split('-').map(Number),utc=Date.UTC(y,m-1,n-(days-1));
  return utc-Number(hourFmt.format(new Date(utc)))*3600000;
 }
 function clean(value){return String(value||'').replace(/https?:\/\/\S+/gi,'[ENLACE OMITIDO]').replace(/[^\s@]+@[^\s@]+/g,'[CORREO OMITIDO]').replace(/[\x00-\x1f\x7f]/g,' ').trim().replace(/\s+/g,' ').slice(0,80).toUpperCase();}
 function normalize(e,now=Date.now()){
  if(!e||!TYPES.includes(e.type)||!/^[-\w]{8,80}$/.test(e.id||'')||!/^[-\w]{8,80}$/.test(e.session||''))return null;
  if(!Number.isSafeInteger(e.ts)||e.ts<now-90*DAY||e.ts>now+300000)return null;
  if(!['mobile','tablet','desktop'].includes(e.device))return null;
  if(e.type==='asset'&&!/^\d{4,10}$/.test(String(e.qr||'')))return null;
  return {id:e.id,session:e.session,ts:e.ts,day:day(e.ts),hour:Number(hourFmt.format(new Date(e.ts))),type:e.type,
   query:e.type==='search'?clean(e.query):'',filter:['all','garment','parcel','multi','misc','dematic','prc','tgw','van'].includes(e.filter)?e.filter:'all',
   results:Math.max(0,Math.min(100000,Number.isSafeInteger(e.results)?e.results:0)),qr:e.type==='asset'?String(e.qr):'',device:e.device,offline:e.offline===true};
 }
 function summarize(events,days=30,now=Date.now()){
  const from=since(days,now),all=[...new Map(events.map(e=>[e.id,e])).values()],rows=all.filter(e=>e.ts>=from&&e.ts<=now),search=rows.filter(e=>e.type==='search');
  const group=(data,key,limit=0)=>{const m=new Map();data.forEach(e=>m.set(e[key],(m.get(e[key])||0)+1));const a=[...m].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value||String(a.label).localeCompare(String(b.label)));return limit?a.slice(0,limit):a;};
  const devices=['mobile','tablet','desktop'].map(label=>({label,value:new Set(rows.filter(e=>e.device===label).map(e=>e.session)).size})).filter(e=>e.value);
  return {scope:'local',days,updated:now,events:rows.length,sessions:new Set(rows.map(e=>e.session)).size,searches:search.length,misses:search.filter(e=>!e.results).length,assets:rows.filter(e=>e.type==='asset').length,plans:rows.filter(e=>e.type==='plan').length,reports:rows.filter(e=>e.type==='report').length,offline:search.filter(e=>e.offline).length,first:rows.length?Math.min(...rows.map(e=>e.ts)):null,last:rows.length?Math.max(...rows.map(e=>e.ts)):null,collectionStart:all.length?Math.min(...all.map(e=>e.ts)):null,daysData:group(search,'day').sort((a,b)=>a.label.localeCompare(b.label)),hours:group(search,'hour').sort((a,b)=>a.label-b.label),devices,filters:group(search,'filter'),queries:group(search,'query',10),missing:group(search.filter(e=>!e.results),'query',10),assetsData:group(rows.filter(e=>e.type==='asset'),'qr',10)};
 }
 root.MedinaUsageCore=Object.freeze({normalize,summarize,since,day,clean});
})(globalThis);

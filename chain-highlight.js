/* Beta v44: recorrido verde y puntos negros según las flechas del plano. */
const ChainHighlight=(()=>{
 const layers=new Map();let frame=null,last=0,elapsed=0,moving=true,dimmed=true;
 const reduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 function sample(path){let pts=[];
  for(const [op,...p] of path.commands||[]){
   if(op==='m'||op==='l')pts.push(p[0]);
   else if(op==='c'&&pts.length){const a=pts[pts.length-1];for(let i=1;i<=24;i++){const t=i/24,u=1-t;pts.push([u*u*u*a[0]+3*u*u*t*p[0][0]+3*u*t*t*p[1][0]+t*t*t*p[2][0],u*u*u*a[1]+3*u*u*t*p[0][1]+3*u*t*t*p[1][1]+t*t*t*p[2][1]])}}
  }return pts;
 }
 function arrow(path){
  const p=sample(path);while(p.length>1&&dist(p[0],p[p.length-1])<.1)p.pop();
  if(p.length!==3)return null;
  // La punta de una flecha triangular está enfrente de su lado más corto.
  const bases=p.map((v,i)=>({i,len:dist(p[(i+1)%3],p[(i+2)%3])})).sort((a,b)=>a.len-b.len);
  const i=bases[0].i,tip=p[i],a=p[(i+1)%3],b=p[(i+2)%3],base=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  const length=dist(base,tip);if(length<1)return null;
  return {center:[(base[0]+tip[0])/2,(base[1]+tip[1])/2],vector:[(tip[0]-base[0])/length,(tip[1]-base[1])/length]};
 }
 function nearest(points,q){let best={distance:Infinity};
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)continue;const t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(len*len)));const d=Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy);if(d<best.distance)best={distance:d,tangent:[dx/len,dy/len]};}return best;
 }
 function routes(trace){
  const paths=(trace.drawPaths||[]).filter(p=>!p.fill).map(path=>{const points=sample(path);let lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+dist(points[i-1],points[i]));return {path,points,lengths,total:lengths[lengths.length-1]||0,sign:0}}).filter(p=>p.total>3);
  const arrows=(trace.drawPaths||[]).filter(p=>p.fill).map(arrow).filter(Boolean);
  for(const points of trace.arrows||[]){const a=arrow({commands:points.map((p,i)=>[i?'l':'m',p])});if(a)arrows.push(a)}
  // Anclamos cada flecha al tramo que está bajo ella, sin usar cadenas vecinas.
  for(const a of arrows){let best=null;
   for(const p of paths){const n=nearest(p.points,a.center);const dot=n.tangent&&(n.tangent[0]*a.vector[0]+n.tangent[1]*a.vector[1]);if(n.distance<3&&Math.abs(dot)>.75&&(!best||n.distance<best.distance))best={p,distance:n.distance,sign:dot>0?1:-1};}
   if(best){if(best.p.sign&&best.p.sign!==best.sign)best.p.conflict=true;else best.p.sign=best.sign;}
  }
  const nodes=[];function node(q){let n=nodes.find(n=>dist(n.q,q)<.9);if(!n){n={q,ends:[]};nodes.push(n)}return n;}
  for(const p of paths){p.start=node(p.points[0]);p.end=node(p.points[p.points.length-1]);p.start.ends.push({p,start:true});p.end.ends.push({p,start:false});}
  // Propagamos el sentido únicamente en uniones sin bifurcaciones.
  for(let pass=0;pass<paths.length;pass++){let changed=false;
   for(const n of nodes){if(n.ends.length!==2)continue;const [a,b]=n.ends;
    if(a.p===b.p)continue;
    const known=a.p.sign&&!a.p.conflict?a:b.p.sign&&!b.p.conflict?b:null;if(!known)continue;
    const other=known===a?b:a;const outward=known.p.sign*(known.start?1:-1);const expected=-outward*(other.start?1:-1);
    if(!other.p.sign){other.p.sign=expected;changed=true;}else if(other.p.sign!==expected){a.p.conflict=b.p.conflict=true;}
   }if(!changed)break;
  }
  for(const p of paths)if(p.conflict)p.sign=0;
  return paths;
 }
 function clear(){if(frame!==null)cancelAnimationFrame(frame);frame=null;last=0;elapsed=0;for(const [c] of layers)c.remove();layers.clear();}
 function drawPath(ctx,path){ctx.beginPath();for(const [op,...p] of path.commands){if(op==='m')ctx.moveTo(...p[0]);else if(op==='l')ctx.lineTo(...p[0]);else if(op==='c')ctx.bezierCurveTo(...p.flat());else if(op==='h')ctx.closePath();}}
 function pointAt(p,d){let i=1;while(i<p.lengths.length-1&&p.lengths[i]<d)i++;const a=p.points[i-1],b=p.points[i],len=p.lengths[i]-p.lengths[i-1],t=len?(d-p.lengths[i-1])/len:0;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
 function paint(entry){const {canvas,img,trace,page,paths}=entry,ctx=canvas.getContext('2d');if(!ctx||!img.complete||!img.naturalWidth)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);if(dimmed){ctx.fillStyle='rgba(255,255,255,0.72)';ctx.fillRect(0,0,canvas.width,canvas.height);}ctx.save();ctx.scale(canvas.width/page.w,canvas.height/page.h);ctx.strokeStyle='#00c853';ctx.fillStyle='#00c853';
  for(const p of trace.drawPaths||[]){ctx.lineWidth=p.width||.25;ctx.lineCap=['butt','round','square'][p.cap||0];ctx.lineJoin=['miter','round','bevel'][p.join||0];ctx.setLineDash(p.dash||[]);ctx.lineDashOffset=p.phase||0;drawPath(ctx,p);if(p.fill)ctx.fill(p.evenOdd?'evenodd':'nonzero');else ctx.stroke();}
  ctx.setLineDash([]);
  for(const pts of trace.arrows||[]){if(!pts.length)continue;ctx.beginPath();ctx.moveTo(...pts[0]);for(const p of pts.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fill();}
  ctx.fillStyle='#111111';
  for(const p of paths){if(!p.sign)continue;const gap=12,offset=((elapsed*14*p.sign)%gap+gap)%gap;for(let d=offset;d<p.total;d+=gap){const q=pointAt(p,d);ctx.beginPath();ctx.arc(q[0],q[1],Math.max(.7,Math.min(1.15,(p.path.width||2.16)*.52)),0,Math.PI*2);ctx.fill();}}
  ctx.globalAlpha=dimmed?.28:1;
  for(const [x0,y0,x1,y1] of trace.labelMasks||[]){ctx.drawImage(img,x0*img.naturalWidth/page.w,y0*img.naturalHeight/page.h,(x1-x0)*img.naturalWidth/page.w,(y1-y0)*img.naturalHeight/page.h,x0,y0,x1-x0,y1-y0);}
  ctx.restore();
 }
 function tick(now){frame=null;for(const [c] of layers)if(!c.isConnected)layers.delete(c);if(!layers.size){last=0;return;}
  if(!last)last=now;const delta=Math.min((now-last)/1000,.1);last=now;
  if(!document.hidden){if(moving&&!reduced())elapsed+=delta;for(const e of layers.values())paint(e);}
  frame=requestAnimationFrame(tick);
 }
 function attach(parent,img,key,pageNum,page){for(const [c] of layers)if(c.parentNode===parent){c.remove();layers.delete(c)}
  const trace=key&&typeof CT_LINES!=='undefined'&&CT_LINES['CT'+key]?.[pageNum];if(!trace)return false;
  const canvas=document.createElement('canvas');canvas.className='chain-trace-canvas';canvas.setAttribute('aria-hidden','true');canvas.width=img.naturalWidth||Math.round(page.w*2);canvas.height=img.naturalHeight||Math.round(page.h*2);parent.insertBefore(canvas,img.nextSibling);
  const entry={canvas,img,trace,page,paths:routes(trace)};layers.set(canvas,entry);paint(entry);if(frame===null)frame=requestAnimationFrame(tick);return true;
 }
 return {attach,clear,setDim(value){dimmed=!!value;for(const e of layers.values())paint(e);return dimmed},setMotion(value){moving=!!value},analyze:routes};
})();

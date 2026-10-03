/* Adaptación para Medina: geometría original de la referencia PRC por cadena/página. */
const ChainHighlight=(()=>{
 const layers=new Map();let timer=null,red=false;
 const reduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function clear(){if(timer)clearInterval(timer);timer=null;red=false;for(const [c] of layers)c.remove();layers.clear();}
 function paint(entry,color){
  const {canvas,img,trace,page}=entry,ctx=canvas.getContext('2d');
  if(!ctx||!img.complete||!img.naturalWidth)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();ctx.scale(canvas.width/page.w,canvas.height/page.h);
  ctx.strokeStyle=color;ctx.fillStyle=color;
  for(const path of trace.drawPaths||[]){
   ctx.beginPath();ctx.lineWidth=path.width||0.25;ctx.lineCap=['butt','round','square'][path.cap||0];ctx.lineJoin=['miter','round','bevel'][path.join||0];ctx.setLineDash(path.dash||[]);ctx.lineDashOffset=path.phase||0;
   for(const [op,...points] of path.commands){
    if(op==='m')ctx.moveTo(...points[0]);else if(op==='l')ctx.lineTo(...points[0]);else if(op==='c')ctx.bezierCurveTo(...points.flat());else if(op==='h')ctx.closePath();
   }
   if(path.fill)ctx.fill(path.evenOdd?'evenodd':'nonzero');else ctx.stroke();
  }
  if(!trace.drawPaths){ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(const [a,b] of trace.lines||[]){ctx.moveTo(...a);ctx.lineTo(...b)}ctx.stroke();}
  ctx.setLineDash([]);
  for(const points of trace.arrows||[]){if(!points.length)continue;ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fill();}
  for(const [x0,y0,x1,y1] of trace.labelMasks||[]){
   ctx.drawImage(img,x0*img.naturalWidth/page.w,y0*img.naturalHeight/page.h,(x1-x0)*img.naturalWidth/page.w,(y1-y0)*img.naturalHeight/page.h,x0,y0,x1-x0,y1-y0);
  }
  ctx.restore();
 }
 function tick(){
  for(const [canvas] of layers)if(!canvas.isConnected){layers.delete(canvas)}
  if(!layers.size){clearInterval(timer);timer=null;return;}
  if(document.hidden)return;
  red=!red;const color=!reduced()&&red?'#e00000':'#008a40';
  for(const entry of layers.values())paint(entry,color);
 }
 function attach(parent,img,key,pageNum,page){
  for(const [canvas] of layers)if(canvas.parentNode===parent){canvas.remove();layers.delete(canvas)}
  const trace=key&&typeof CT_LINES!=='undefined'&&CT_LINES['CT'+key]?.[pageNum];
  if(!trace)return false;
  const canvas=document.createElement('canvas');canvas.className='chain-trace-canvas';canvas.setAttribute('aria-hidden','true');
  canvas.width=img.naturalWidth||Math.round(page.w*2);canvas.height=img.naturalHeight||Math.round(page.h*2);
  parent.insertBefore(canvas,img.nextSibling);
  const entry={canvas,img,trace,page};layers.set(canvas,entry);paint(entry,'#008a40');
  if(!timer)timer=setInterval(tick,1000);
  return true;
 }
 return {attach,clear};
})();

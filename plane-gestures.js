const PlaneGestures=(()=>{
 const bindings=new WeakMap();
 function bind(view,canvas,initial=1,onScale=()=>{}){
  let b=bindings.get(view);if(b){b.onScale=onScale;b.set(initial);return;}
  const stage=document.createElement('div');stage.className='plane-gesture-stage';canvas.parentNode.insertBefore(stage,canvas);stage.appendChild(canvas);
  b={scale:initial,onScale,points:new Map(),ratio:parseFloat(canvas.style.height)/parseFloat(canvas.style.width)};
  function size(){b.width=view.clientWidth;canvas.style.width=b.width+'px';canvas.style.height=b.width*b.ratio+'px';const img=canvas.querySelector('img');if(img)img.style.width=b.width+'px';canvas.style.transform='scale('+b.scale+')';stage.style.width=b.width*b.scale+'px';stage.style.height=b.width*b.ratio*b.scale+'px';}
  b.set=(value,oldCenter,newCenter)=>{const old=b.scale;b.scale=Math.max(1,Math.min(7,value));const x=oldCenter||[view.clientWidth/2,view.clientHeight/2],y=newCenter||x;const sx=(view.scrollLeft+x[0])/old,sy=(view.scrollTop+x[1])/old;size();view.scrollLeft=sx*b.scale-y[0];view.scrollTop=sy*b.scale-y[1];b.onScale(b.scale);};
  const pair=()=>{const ps=[...b.points.values()];return ps.length>1?{center:[(ps[0][0]+ps[1][0])/2,(ps[0][1]+ps[1][1])/2],distance:Math.hypot(ps[0][0]-ps[1][0],ps[0][1]-ps[1][1])}:null;};
  const point=e=>{const r=view.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
  view.style.touchAction='none';view.setAttribute('aria-label','Plano: arrastra para desplazarte; separa o junta dos dedos para ampliar o reducir');
  view.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;b.points.set(e.pointerId,point(e));view.setPointerCapture(e.pointerId);e.preventDefault();});
  view.addEventListener('pointermove',e=>{if(!b.points.has(e.pointerId))return;const old=pair(),previous=b.points.get(e.pointerId),next=point(e);b.points.set(e.pointerId,next);const now=pair();if(old&&now&&old.distance>0)b.set(b.scale*now.distance/old.distance,old.center,now.center);else{view.scrollLeft+=previous[0]-next[0];view.scrollTop+=previous[1]-next[1];}e.preventDefault();});
  const end=e=>{b.points.delete(e.pointerId);};view.addEventListener('pointerup',end);view.addEventListener('pointercancel',end);view.addEventListener('lostpointercapture',end);
  view.addEventListener('dblclick',e=>{b.set(b.scale>1?1:3,point(e));e.preventDefault();});
  view.addEventListener('wheel',e=>{if(!e.ctrlKey)return;b.set(b.scale*Math.exp(-e.deltaY*.005),point(e));e.preventDefault();},{passive:false});
  if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(()=>{if(view.clientWidth&&canvas.isConnected&&Math.abs(view.clientWidth-b.width)>.5)size();});observer.observe(view);}
  bindings.set(view,b);size();
 }
 function set(view,value){const b=bindings.get(view);if(b)b.set(value);}
 function focus(view,x,y){const b=bindings.get(view);if(!b)return false;
   b.set(b.scale);view.scrollLeft=Math.max(0,x*b.width*b.scale-view.clientWidth/2);view.scrollTop=Math.max(0,y*b.width*b.scale-view.clientHeight/2);return true;
 }
 return {bind,set,focus};
})();

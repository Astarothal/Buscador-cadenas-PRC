/* Acumuladores 801–806: ramal largo y retorno superior contrastados en P05.
   Se añade sobre BP_LINES sin modificar los trazados originales de otras cadenas o bypass. */
(() => {
 const source = [{"key":"801","cla":1,"page":5,"paths":[[[1638.0,105.5],[1628.5,115],[1628.5,604.5],[1638.5,614]],[[1649.0,105.5],[1639.5,115],[1639.5,221],[1628.5,232]]]},{"key":"802","cla":2,"page":5,"paths":[[[1381.0,105.5],[1371.5,115],[1371.5,604.5],[1381.5,614]],[[1392.0,105.5],[1382.5,115],[1382.5,221],[1371.5,232]]]},{"key":"803","cla":3,"page":5,"paths":[[[1081.2,126],[1071.7,136],[1071.7,605],[1081.7,614.5]],[[1092.0,126],[1082.5,136],[1082.5,221],[1071.7,232]]]},{"key":"804","cla":4,"page":5,"paths":[[[823.7,126],[814.2,136],[814.2,605],[824.2,614.5]],[[834.5,126],[825.0,136],[825.0,221],[814.2,232]]]},{"key":"805","cla":5,"page":5,"paths":[[[463.0,168],[453.5,178],[453.5,608],[465,617.5]],[[486.0,168],[476.5,178],[476.5,228],[453.5,251]]]},{"key":"806","cla":6,"page":5,"paths":[[[221.5,168],[212.0,178],[212.0,605],[224,615]],[[244.5,168],[235.0,178],[235.0,228],[212.0,251]]]}];
 const sx=1190.25/1800, sy=841.5/1273;
 for(const item of source){
  const drawPaths=item.paths.map(points=>({commands:points.map((p,i)=>[i?'l':'m',[p[0]*sx,p[1]*sy]]),width:1.65,dash:[],phase:0,cap:1,join:1}));
  // Flechas sobre cada ramal: el mismo motor de los bypass determina así
  // el sentido de sus puntos negros, sin crear otra animación independiente.
  const arrows=item.paths.map(points=>{
   const a=points[1],b=points[2],y=(a[1]+b[1])/2,x=a[0];
   return [[x-2,y-3],[x+2,y-3],[x,y+3]].map(p=>[p[0]*sx,p[1]*sy]);
  });
  const trace={lines:[],arrows,drawPaths,boundsPoints:drawPaths.flatMap(path=>path.commands.map(c=>c[1])),labelMasks:[]};
  BP_LINES['BP'+item.key]={...BP_LINES['BP'+item.key],[item.page]:trace};
 }
 const byKey=new Map(source.map(item=>[item.key,item]));
 window.MedinaAccumulatorTraces=Object.freeze({
  get:key=>byKey.get(String(key))||null,
  fit(key,page,width,height){
   const trace=BP_LINES['BP'+key]?.[page.page], points=trace?.boundsPoints||[];
   if(!points.length||!width||!height)return 1.35;
   const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
   const routeWidth=(Math.max(...xs)-Math.min(...xs))*width/page.w;
   const routeHeight=(Math.max(...ys)-Math.min(...ys))*width/page.w;
   return Math.max(1,Math.min(7,width*.8/Math.max(1,routeWidth),height*.82/Math.max(1,routeHeight)));
  }
 });
})();

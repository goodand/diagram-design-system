// Author: chatgpt_gpt6. CLI-side generation; standalone HTML only receives coordinates.
import { routeView, analyzeRoutes } from './avoid-router.mjs';
export async function routingCache(ir, DDS, level=1) {
  const source=DDS.withAutoFolds(ir);
  const groups=source.nodes.filter(n=>n.expandAt!==undefined).map(n=>n.id);
  if(groups.length>8) throw Error('libavoid routing supports at most eight fold groups per artifact');
  const cache={};
  for(let mask=0;mask<2**groups.length;mask++) {
    const expand=groups.filter((_,i)=>mask&(1<<i)),collapse=groups.filter(id=>!expand.includes(id));
    const view=DDS.view(source,level,{expand,collapse});
    const key=DDS.routingKey(view);
    if(cache[key]) continue;
    const input={nodes:view.nodes.map(n=>({id:n.id,...DDS.box(n)})),edges:view.edges.map((e,i)=>({id:String(i),from:e.from,to:e.to}))};
    const routes=await routeView(input);
    cache[key]=view.edges.map((_,i)=>({pts:routes[String(i)].map(p=>[p.x,p.y])}));
    if(cache[key].some(r=>r.pts.length<2||r.pts.some(p=>p.some(v=>!Number.isFinite(v))))) throw Error('Invalid libavoid routing result');
    const analysis=analyzeRoutes(input,routes);
    if(!analysis.valid) throw Error('Routing geometry did not pass overlap/obstacle/endpoint checks: '+JSON.stringify(analysis));
  }
  return cache;
}

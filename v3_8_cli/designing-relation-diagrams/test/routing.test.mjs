// Author: chatgpt_gpt6. Recompute real regression geometry; do not trust saved verdicts.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {routeView,analyzeRoutes} from '../scripts/lib/avoid-router.mjs';
import {routingCache} from '../scripts/lib/routing-cache.mjs';
import {DDS} from '../scripts/lib/engine.mjs';
const fixtures=JSON.parse(readFileSync(new URL('./routing-fixtures.json',import.meta.url),'utf8'));
for(const [name,view] of Object.entries(fixtures)) test(`libavoid recomputes ${name} without overlap or node penetration`,async()=>{
  const routes=await routeView(view);assert.equal(analyzeRoutes(view,routes).valid,true);
  const wrong=structuredClone(routes);wrong[view.edges[0].id][0]={x:-999,y:-999};
  assert.equal(analyzeRoutes(view,wrong).valid,false);
});
test('route cache preserves edge order and fails for stale geometry',async()=>{
  const v=fixtures.collapsed;
  const ir={nodes:v.nodes.map(n=>({...n,x:n.x+n.w/2,y:n.y+n.h/2,label:n.id,role:'process'})),edges:v.edges.map(e=>({...e,meaning:'execution_flow'})),edge_routing:'libavoid'};
  ir.routing_cache=await routingCache(ir,DDS,1);
  assert.doesNotThrow(()=>DDS.render(ir,{level:1,fit:true}));
  ir.nodes[0].x+=10;assert.throws(()=>DDS.render(ir,{level:1}),/Missing routing cache/);
});

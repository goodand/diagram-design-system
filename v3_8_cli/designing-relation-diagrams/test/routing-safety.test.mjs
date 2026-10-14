// Author: chatgpt_gpt6. Guard the WASM boundary and reject invisible routes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeView,analyzeRoutes} from '../scripts/lib/avoid-router.mjs';
const view=()=>({nodes:[{id:'a',x:0,y:0,w:100,h:60},{id:'b',x:220,y:0,w:100,h:60}],edges:[{id:'ab',from:'a',to:'b'}]});
test('arbitrary string edge IDs survive JSON serialization',async()=>{
  const v=view();v.edges[0].id='__proto__';
  const routes=await routeView(v);
  assert.ok(Object.hasOwn(routes,'__proto__'));
  assert.equal(analyzeRoutes(v,JSON.parse(JSON.stringify(routes))).valid,true);
});
test('invalid graph input is rejected before entering WASM',async()=>{
  for(const change of [v=>v.nodes.push({...v.nodes[0]}),v=>v.edges.push({...v.edges[0]}),v=>v.nodes[0].w=0,v=>v.edges[0].fromSide='invalid']) {
    const v=view();change(v);await assert.rejects(routeView(v),/Invalid routing input/);
  }
});
test('non-finite geometry is rejected by analysis before route comparisons',()=>{
  const v=view();v.nodes[0].x=NaN;
  assert.throws(()=>analyzeRoutes(v,{ab:[{x:100,y:30},{x:220,y:30}]}),/Invalid routing input/);
});
test('non-finite and zero-length routes cannot pass geometry validation',()=>{
  const v=view();
  assert.equal(analyzeRoutes(v,{ab:[{x:NaN,y:30},{x:220,y:30}]}).valid,false);
  const self={nodes:[v.nodes[0]],edges:[{id:'self',from:'a',to:'a'}]};
  assert.equal(analyzeRoutes(self,{self:[{x:100,y:30},{x:100,y:30}]}).valid,false);
});
test('a self-loop has visible length and leaves the node exterior',async()=>{
  const v={nodes:[view().nodes[0]],edges:[{id:'self',from:'a',to:'a'}]};
  const routes=await routeView(v);
  assert.equal(analyzeRoutes(v,routes).valid,true);
  const length=routes.self.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-routes.self[i].x)+Math.abs(p.y-routes.self[i].y),0);
  assert.ok(length>20,'self-loop must not collapse to an invisible point');
});

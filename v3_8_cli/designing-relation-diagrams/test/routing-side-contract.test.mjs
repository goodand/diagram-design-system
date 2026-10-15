import {test} from 'node:test';import assert from 'node:assert/strict';
import {routingCache} from '../scripts/lib/routing-cache.mjs';
import {DDS as engine} from '../scripts/lib/engine.mjs';
test('cache identity includes explicit endpoint sides',()=>{
 const graph={nodes:[],edges:[{id:'e',from:'a',to:'b'}]};
 const legacy=engine.routingKey(graph);
 graph.edges[0].fromSide='right';assert.notEqual(engine.routingKey(graph),legacy);
 const right=engine.routingKey(graph);graph.edges[0].fromSide='left';assert.notEqual(engine.routingKey(graph),right);
});
test('CLI routing preserves explicitly chosen endpoint sides',async()=>{
 const ir={nodes:[{id:'a',x:100,y:100,w:160,h:44},{id:'b',x:100,y:400,w:160,h:44}],edges:[{id:'return',from:'b',to:'a',loop:true,fromSide:'right',toSide:'right'}]};
 const DDS={withAutoFolds:x=>x,view:x=>x,box:n=>({x:n.x,y:n.y,w:n.w,h:n.h}),routingKey:()=> 'state'};
 const before=JSON.stringify(ir),cache=await routingCache(ir,DDS,2),pts=cache.state[0].pts;
 assert.equal(pts[0][0],260,'source must attach to right side');
 assert.equal(pts.at(-1)[0],260,'target must attach to right side');
 assert.equal(JSON.stringify(ir),before);
});

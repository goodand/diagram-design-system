import {test} from 'node:test';import assert from 'node:assert/strict';import {DDS} from '../scripts/lib/engine.mjs';
test('visible-state layout is applied without mutating source and missing state fails',()=>{
 const ir={nodes:[{id:'a',role:'process',label:'A',x:0,y:0}],edges:[]};
 const key=JSON.stringify([['a'],[]]);ir.visible_layout_signature=DDS.layoutSignature(ir);ir.visible_layout_cache={[key]:{positions:{a:[300,200]}}};
 const before=JSON.stringify(ir),v=DDS.view(ir,2,{});assert.equal(v.nodes[0].x,300);assert.equal(v.nodes[0].y,200);assert.equal(JSON.stringify(ir),before);
 ir.visible_layout_cache={};assert.throws(()=>DDS.view(ir,2,{}),/Missing visible layout/);
});

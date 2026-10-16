import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DDS} from '../scripts/lib/engine.mjs';
function fixture(){
 const ir={nodes:[{id:'a',role:'process',label:'A',x:0,y:0,w:176,h:44}],edges:[],layout_options:{spacing:80}};
 ir.visible_layout_signature=DDS.layoutSignature?.(ir)||'legacy';
 ir.visible_layout_cache={[JSON.stringify([['a'],[]])]:{positions:{a:[300,200]}}};
 return ir;
}
for(const [name,change] of [
 ['label',ir=>ir.nodes[0].label='긴 문구'],
 ['width',ir=>ir.nodes[0].w=430],
 ['height',ir=>ir.nodes[0].h=76],
 ['options',ir=>ir.layout_options.spacing=120],
 ['font',ir=>ir.font_size=19.6]
])test('reject stale layout after '+name,()=>{const ir=fixture();change(ir);assert.throws(()=>DDS.view(ir,2,{}),/Stale visible layout/);});
test('unmodified cached source remains immutable',()=>{const ir=fixture(),before=JSON.stringify(ir);assert.equal(DDS.view(ir,2,{}).nodes[0].x,300);assert.equal(JSON.stringify(ir),before);});
test('invalid position length rejected',()=>{const ir=fixture();Object.values(ir.visible_layout_cache)[0].positions.a=[10];assert.throws(()=>DDS.view(ir,2,{}),/Invalid visible layout/);});

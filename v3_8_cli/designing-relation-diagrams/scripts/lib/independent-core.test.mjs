// Author: chatgpt_gpt6
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderIndependentCoreSvg} from './render.mjs';
const core={diagram_type:'Process_Core',id:'core',nodes:[
 {id:'in',role:'entity',label:'입력',x:200,y:60},
 {id:'task',role:'process',label:'처리',x:200,y:180},
 {id:'out',role:'entity',label:'출력',x:200,y:300}],
 edges:[{id:'a',from:'in',to:'task'},{id:'b',from:'task',to:'out'}]};
test('independent source rendering preserves content without UI folds or source mutation',async()=>{
 const source=structuredClone(core);source.l0_ref={snapshot:{nodes:[]}};
 const before=JSON.stringify(source);const svg=await renderIndependentCoreSvg(source);
 for(const n of core.nodes)assert(svg.includes(`data-id="${n.id}"`));
 assert.equal((svg.match(/class="dds-edge"/g)||[]).length,2);
 assert(!/dds-plus|data-expand|__l0fold:|<script|<button/.test(svg));
 assert.equal(JSON.stringify(source),before);
});
test('non-Core and authored folding structures are not silently flattened',async()=>{
 await assert.rejects(()=>renderIndependentCoreSvg({...core,diagram_type:'Process_Full'}),/Core/);
 await assert.rejects(()=>renderIndependentCoreSvg({...core,nodes:core.nodes.map(n=>({...n,expandAt:2}))}),/hierarchy/);
});
test('actual existing Core renders all source content',async()=>{
 const file=process.env.CORE_FIXTURE;if(!file)return;
 const ir=JSON.parse(readFileSync(file));const svg=await renderIndependentCoreSvg(ir);
 for(const n of ir.nodes)assert(svg.includes(`data-id="${n.id}"`),n.id);
 assert.equal((svg.match(/class="dds-edge"/g)||[]).length,ir.edges.length);
 assert(!/dds-plus|data-expand|__l0fold:/.test(svg));
});

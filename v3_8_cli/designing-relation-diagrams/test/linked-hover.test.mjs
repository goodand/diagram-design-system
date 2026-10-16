// Author: chatgpt_gpt6. Nested focus must not promote ancestor membership.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/workflow-runtime.js';
const nodes=[{id:'in'},{id:'detail',linked_detail:true,expandAt:2},{id:'a',parent:'detail'},{id:'shared',parent:'detail'},{id:'b',parent:'detail'},{id:'handoff'},{id:'other'},{id:'out'}].map(n=>({...n,role:['in','shared','out'].includes(n.id)?'entity':'process'}));
const edges=[['ia','in','a'],['as','a','shared'],['sb','shared','b'],['bo','b','handoff'],['ho','handoff','other'],['oo','other','out']].map(([id,from,to])=>({id,from,to,meaning:'execution_flow'}));
const ir={nodes,edges,e2e:{inputs:['in'],outputs:['out']},partials:[
 {id:'parent',nodes:['in','detail','other','out'],edges:['oo']},
 {id:'child-a',scope_depth:1,owner_node:'detail',parent_partial_id:'parent',nodes:['in','a','shared'],edges:['ia','as']},
 {id:'child-b',scope_depth:1,owner_node:'detail',parent_partial_id:'parent',nodes:['shared','b','handoff'],edges:['sb','bo']} ]};
test('folded detail activates child union without unrelated parent members',()=>{
 const s=globalThis.DDSWorkflow.scope(ir,'node','detail');
 assert.ok(s.nodes.has('a')&&s.nodes.has('b'));
 // parent-only edge must not be promoted merely through ancestor membership.
 assert.equal(s.edges.has('oo'),false);
});
test('expanded unique/shared nodes and edges use detailed scopes',()=>{
 const unique=globalThis.DDSWorkflow.scope(ir,'node','a');
 assert.ok(unique.nodes.has('a'));assert.equal(unique.nodes.has('b'),false);
 const shared=globalThis.DDSWorkflow.scope(ir,'node','shared');
 assert.ok(shared.nodes.has('a')&&shared.nodes.has('b'));
 const boundary=globalThis.DDSWorkflow.scope(ir,'node','in');
 assert.equal(boundary.nodes.has('other'),false);
 const edge=globalThis.DDSWorkflow.scope(ir,'edge','ia');assert.equal(edge.nodes.has('b'),false);
});

test('linked child cycle keeps finite animation routes through imported states',()=>{
 const cycle={...ir,flow:Object.fromEntries(edges.map(e=>[e.id,'state:'+e.id])),edges:[...edges,{id:'retry',from:'b',to:'a',meaning:'execution_flow',loop:true}]};
 const plan=globalThis.DDSWorkflow.flowPlan(cycle,'in');
 assert.deepEqual(plan.map(p=>p.edge),['ia','as','sb','bo','ho','oo']);
 assert.ok(plan.every(p=>p.label==='state:'+p.edge));
});

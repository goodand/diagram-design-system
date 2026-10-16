import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DDS} from '../scripts/lib/engine.mjs';
import {layoutGraph,buildViewLayouts} from '../scripts/lib/auto-layout.mjs';
test('runtime auto-fold augmentation preserves validated cache freshness',async()=>{
 const source={diagram_type:'l1_partial',id:'p',nodes:[{id:'in',label:'Input',role:'entity'},{id:'a',label:'Detail',role:'process'},{id:'out',label:'Output',role:'entity'}],edges:[{id:'e1',from:'in',to:'a'},{id:'e2',from:'a',to:'out'}],e2e:{inputs:['in'],outputs:['out']},partials:[{id:'p',nodes:['in','a','out'],edges:['e1','e2']}],l0_ref:{node_id:'task',snapshot:{nodes:[{id:'task',label:'Task',role:'process'}]}}};
 const {states,...cache}=await buildViewLayouts(DDS,source);
 const cached={...source,...cache},before=JSON.stringify(cached);
 const augmented=DDS.withAutoFolds(cached);
 for(const state of states)assert.doesNotThrow(()=>DDS.render(augmented,{level:2,...state}));
 assert.equal(JSON.stringify(cached),before);
 cached.nodes[1].label='Changed';assert.throws(()=>DDS.withAutoFolds(cached),/Stale visible layout/);
});
test('projected parallel edge IDs survive layout and libavoid rendering',async()=>{
 const source={diagram_type:'l1_full',edge_routing:'libavoid',nodes:['a','b'].map(id=>({id,label:id,role:'process'})),edges:['e1','e2'].map(id=>({id,from:'a',to:'b'}))};
 const result=await layoutGraph(DDS,source);
 assert.deepEqual(result.edges.map(e=>e.id),['e1','e2']);
 const {states,...cache}=await buildViewLayouts(DDS,source);
 assert.doesNotThrow(()=>DDS.render({...source,...cache},{level:2,expand:[],collapse:[]}));
});
for(const topology of ['linear','diamond','cycle'])test('coordinate-free '+topology+' preserves source and edge directions',async()=>{
 const ids=topology==='diamond'?['s','a','b','t']:['s','a','t'];
 const pairs=topology==='diamond'?[['s','a'],['s','b'],['a','t'],['b','t']]:[['s','a'],['a','t'],...(topology==='cycle'?[['t','a']]:[])];
 const graph={nodes:ids.map(id=>({id,label:id,role:'process'})),edges:pairs.map(([from,to],i)=>({id:'e'+i,from,to,...(topology==='cycle'&&i===2?{loop:true}:{})}))};
 const before=JSON.stringify(graph),result=await layoutGraph(DDS,graph);
 assert.equal(JSON.stringify(graph),before);
 assert.deepEqual(Object.keys(result.positions).sort(),ids.sort());
 assert(result.nodes.every(n=>[n.x,n.y,n.w,n.h].every(Number.isFinite)));
 assert.deepEqual(result.edges.map(e=>[e.id,e.from,e.to]),graph.edges.map(e=>[e.id,e.from,e.to]));
 assert(result.analysis.valid,JSON.stringify(result.analysis));
});
test('fold states generate their own layouts and matching renderer routes',async()=>{
 const source={nodes:[{id:'in',label:'입력',role:'entity'},{id:'g',label:'Core',role:'process',expandAt:2},{id:'p',parent:'g',label:'처리',role:'process'},{id:'out',label:'출력',role:'entity'}],edges:[{id:'a',from:'in',to:'p'},{id:'b',from:'p',to:'out'}]};
 const before=JSON.stringify(source),generated=await buildViewLayouts(DDS,source);
 assert.equal(JSON.stringify(source),before);assert.equal(generated.states.length,2);
 const {states,...cache}=generated,ir={...source,...cache};
 for(const state of states){const view=DDS.view(ir,2,state);assert.deepEqual(view.nodes.map(n=>n.id),state.nodeIds);assert(ir.routing_cache[DDS.routingKey(view)]);assert(DDS.render(ir,{level:2,...state}).svg.includes('<svg'));}
});

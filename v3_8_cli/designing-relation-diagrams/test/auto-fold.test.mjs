// Regression coverage for L0-keyed automatic folding. Author: chatgpt_gpt6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DDS } from '../scripts/lib/engine.mjs';
import { validateWorkflow } from '../scripts/lib/workflow.mjs';

const edge = (id,from,to) => ({id,from,to,meaning:'execution_flow'});
function linkedPartial() {
  const snapshot={id:'overview',version:'3',diagram_type:'l0_summary',nodes:[
    {id:'source',label:'예산서 원문',role:'entity',x:300,y:60},
    {id:'budget-task',label:'사업정보 분석',role:'process',x:300,y:180},
    {id:'result',label:'분석 결과',role:'entity',x:300,y:300}],
    edges:[edge('in','source','budget-task'),edge('out','budget-task','result')],
    e2e:{inputs:['source'],outputs:['result']},flow:{in:'예산서 원문',out:'분석 결과'}};
  const nodes=[['source','예산서 원문','entity'],['parse','문서 파싱','process'],['middle','파싱된 자료','entity'],['classify','사업 구획 분류','process'],['result','사업별 구획','entity']]
    .map(([id,label,role],i)=>({id,label,role,x:300,y:60+i*90}));
  const edges=[edge('e1','source','parse'),edge('e2','parse','middle'),edge('e3','middle','classify'),edge('e4','classify','result')];
  return { id:'parse-section',version:'1',diagram_type:'l1_partial',nodes,edges,
    e2e:{inputs:['source'],outputs:['result']},flow:{e1:'예산서 원문',e2:'파싱된 자료',e3:'파싱된 자료',e4:'사업별 구획'},
    partials:[{id:'parse-section',nodes:nodes.map(n=>n.id),edges:edges.map(e=>e.id),e2e:{inputs:['source'],outputs:['result']}}],
    l0_ref:{node_id:'budget-task',snapshot} };
}
test('L0 reference automatically folds and expands partial without changing approved content',()=>{
  const ir=linkedPartial(), before=JSON.stringify(ir);
  validateWorkflow(ir);
  const foldId='__l0fold:'+('budget-task'.length)+':budget-task';
  const folded=DDS.view(ir,1), expanded=DDS.view(ir,1,{expand:[foldId]});
  assert.ok(folded.nodes.some(n=>n.label==='사업정보 분석'&&n.autoFold));
  assert.ok(folded.nodes.some(n=>n.id==='source'));
  assert.ok(folded.nodes.some(n=>n.id==='result'));
  assert.ok(!folded.nodes.some(n=>n.id==='parse'||n.id==='classify'));
  assert.ok(folded.edges.some(e=>e.from==='source'&&e.to.startsWith('__l0fold:')));
  assert.ok(folded.edges.some(e=>e.from.startsWith('__l0fold:')&&e.to==='result'));
  assert.ok(expanded.nodes.some(n=>n.id==='parse'&&n.label==='문서 파싱'));
  assert.ok(expanded.nodes.some(n=>n.id==='classify'));
  assert.ok(!expanded.nodes.some(n=>n.autoFold));
  assert.equal(JSON.stringify(ir),before,'derived folding must not mutate the approved IR');
});
test('l1_full derives one L0 unit for partials that reference the same stable Task key',()=>{
  const a=linkedPartial(), b=structuredClone(a); b.id='other-part'; b.version='2'; b.partials[0].id='other-part';
  b.nodes=b.nodes.map(n=>n.id==='source'||n.id==='result'?n:{...n,id:'b-'+n.id});
  const bId=new Map([['source','source'],['result','result'],['parse','b-parse'],['middle','b-middle'],['classify','b-classify']]);
  b.edges=b.edges.map(e=>({...e,id:'b-'+e.id,from:bId.get(e.from),to:bId.get(e.to)}));
  b.flow=Object.fromEntries(Object.entries(b.flow).map(([id,label])=>['b-'+id,label]));
  b.partials[0].nodes=b.nodes.map(n=>n.id); b.partials[0].edges=b.edges.map(e=>e.id);
  const full={...a,id:'full',version:'1',diagram_type:'l1_full',
    l0_ref:undefined,
    partials:[a.partials[0],b.partials[0]],
    l0_refs:[{...a.l0_ref,partial_id:a.id,partial:{...a.partials[0],e2e:a.e2e}},{...b.l0_ref,partial_id:b.id,partial:{...b.partials[0],e2e:b.e2e}}],
    nodes:[...a.nodes,...b.nodes.filter(n=>!['source','result'].includes(n.id))],
    edges:[...a.edges,...b.edges]};
  assert.equal(full.diagram_type,'l1_full');
  const foldKey='__l0fold:'+('budget-task'.length)+':budget-task';
  const view=DDS.view(full,1), fold=view.nodes.filter(n=>n.autoFold);
  assert.equal(fold.length,1);
  assert.equal(fold[0].label,'사업정보 분석');
  assert.equal(view.nodes.length,3,'full starts collapsed');
  assert.equal(DDS.view(full,1,{expand:[foldKey]}).nodes.length,full.nodes.length);
});
test('stale L0 node_id and conflicting labels fail before render',()=>{
  const stale=linkedPartial(); stale.l0_ref.node_id='missing-task';
  assert.throws(()=>validateWorkflow(stale),/resolve to the L0 Task/);
  const conflict=linkedPartial(); conflict.l0_ref.snapshot.nodes.find(n=>n.id==='budget-task').label='다른 Task';
  conflict.diagram_type='l1_full'; conflict.l0_ref=undefined; conflict.l0_refs=[
    {...linkedPartial().l0_ref,partial_id:'a',partial:linkedPartial().partials[0]},
    {...linkedPartial().l0_ref,partial_id:'b',partial:linkedPartial().partials[0],snapshot:{...linkedPartial().l0_ref.snapshot,nodes:linkedPartial().l0_ref.snapshot.nodes.map(n=>n.id==='budget-task'?{...n,label:'다른 Task'}:n)}}
  ];
  assert.throws(()=>DDS.view(conflict,1),/conflicting L0 labels/);
});
test('rejects partials whose input-side and output-side Tasks are disconnected',()=>{
  const ir=linkedPartial(); ir.edges[2].from='classify';
  assert.throws(()=>validateWorkflow(ir),/connected partial input-to-Task-to-output flow/);
});

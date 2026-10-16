import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {workflowUnitState,runtimeIr} from '../scripts/lib/workflow-units.mjs';
import {DDS} from '../scripts/lib/engine.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const node=(id,role,label=id,x=0,y=0,extra={})=>({id,role,label,x,y,...extra});
const edge=(id,from,to)=>({id,from,to,meaning:'execution_flow'});
const writeJson=(dir,name,value)=>{const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');writeFileSync(path.join(dir,name),bytes);return bytes;};

function fixture() {
  const dir=mkdtempSync(path.join(tmpdir(),'dds-boundary-normalization-'));
  const fn={id:'boundary-function',version:'1',diagram_type:'Function_Definition',
    nodes:[node('input','entity','Input'),node('function-task','process','Process'),node('output','entity','Output')],
    edges:[edge('function-in','input','function-task'),edge('function-out','function-task','output')],
    e2e:{inputs:['input'],outputs:['output']},flow:{'function-in':'input','function-out':'output'}};
  const fnBytes=writeJson(dir,'function.json',fn);
  const summary={id:'boundary-summary',version:'1',diagram_type:'Process_Summary_Linear',
    definition_ref:{path:'function.json',id:fn.id,version:fn.version,sha256:sha(fnBytes),node_id:'function-task'},
    nodes:[node('input','entity','Input'),node('task-a','process','Task A'),node('task-b','process','Task B'),node('output','entity','Output')],
    edges:[edge('summary-in','input','task-a'),edge('summary-ab','task-a','task-b'),edge('summary-out','task-b','output')],
    e2e:{inputs:['input'],outputs:['output']},flow:{'summary-in':'input','summary-ab':'handoff','summary-out':'output'}};
  const summaryBytes=writeJson(dir,'summary.json',summary);
  const cores=[
    {id:'core-a',task:'task-a',input:'input',inputLabel:'Input',output:'to-b',outputLabel:'Intermediate',edges:[edge('a-in','input','task-a'),edge('a-out','task-a','to-b')]},
    {id:'core-b',task:'task-b',input:'from-a',inputLabel:'Intermediate',output:'output',outputLabel:'Output',edges:[edge('b-in','from-a','task-b'),edge('b-out','task-b','output')]}
  ].map((spec,index)=>{
    const ir={id:spec.id,version:'1',diagram_type:'Process_Core',
      summary_ref:{path:'summary.json',id:summary.id,version:summary.version,sha256:sha(summaryBytes),node_id:spec.task},
      nodes:[node(spec.input,'entity',spec.inputLabel,index?180:160,100,{data_type:spec.inputLabel==='Intermediate'?'record-set':spec.inputLabel.toLowerCase()}),
        node(spec.task,'process',index?'Task B':'Task A',160,210),
        node(spec.output,'entity',spec.outputLabel,index?160:140,320,{data_type:spec.outputLabel==='Intermediate'?'record-set':spec.outputLabel.toLowerCase()})],
      edges:spec.edges,e2e:{inputs:[spec.input],outputs:[spec.output]},
      flow:Object.fromEntries(spec.edges.map(e=>[e.id,e.id.endsWith('in')?'incoming':'outgoing'])),
      animation_states:Object.fromEntries(spec.edges.map(e=>[e.id,e.id.endsWith('in')?'received':'produced'])),
      partials:[{id:`part-${spec.id}`,nodes:[spec.input,spec.task,spec.output],edges:spec.edges.map(e=>e.id)}]};
    return ir;
  });
  const coreRefs=cores.map((core,index)=>{
    const bytes=writeJson(dir,`${core.id}.json`,core);
    return {id:core.id,version:core.version,path:`${core.id}.json`,sha256:sha(bytes),decision_ref:`approve-${index}`};
  });
  const connection=edge('join-a-b','to-b','from-a');
  const full={id:'boundary-full',version:'1',diagram_type:'Process_Full',
    summary_ref:{path:'summary.json',id:summary.id,version:summary.version,sha256:sha(summaryBytes)},
    approved_partials:coreRefs,assembly_decision_ref:'assemble',
    nodes:cores.flatMap(c=>c.nodes),edges:[...cores.flatMap(c=>c.edges),connection],
    e2e:{inputs:['input'],outputs:['output']},
    flow:Object.assign({},...cores.map(c=>c.flow),{'join-a-b':'Intermediate'}),
    animation_states:Object.assign({},...cores.map(c=>c.animation_states),{'join-a-b':'handoff'}),
    partials:cores.flatMap(c=>c.partials),connections:['join-a-b']};
  const coreBytes=coreRefs.map(ref=>readFileSync(path.join(dir,ref.path)));
  const decisions=coreRefs.map((ref,index)=>({id:ref.decision_ref,topic:'partial_approval',subject:'Human',status:'decided',outcome:'approved',answer:'SYNTHETIC TEST APPROVAL',answered_at:'2026-10-16T00:00:00Z',ir_sha256:ref.sha256,simulated:true}));
  decisions.push({id:'assemble',topic:'assemble_full',subject:'Human',status:'decided',outcome:'approved',answer:'SYNTHETIC TEST ASSEMBLY',answered_at:'2026-10-16T00:00:00Z',partial_sha256:coreRefs.map(r=>r.sha256),simulated:true});
  full.simulation=true;
  const sourceBytes=Buffer.from(JSON.stringify(full,null,2)+'\n');
  const state=workflowUnitState(full,decisions,dir,sha(sourceBytes));
  assert.deepEqual(state.errors,[],'fixture Full must satisfy current assembly contract');
  return {dir,full,cores,coreRefs,coreBytes,decisions,state,sourceBytes};
}

test('Full boundary connections become one render boundary in both fold states, preserving source approvals',()=>{
  const f=fixture();
  try {
    const projected=runtimeIr({...f.full,l0_refs:f.state.l0_refs,
      visible_layout_cache:{stale:true},visible_layout_signature:'stale',routing_cache:{stale:true}});
    assert.equal(projected.diagram_type,'l1_full');
    assert.ok(projected.nodes.some(n=>n.id==='to-b'));
    assert.ok(!projected.nodes.some(n=>n.id==='from-a'));
    assert.deepEqual(JSON.parse(JSON.stringify(projected.boundary_projection)),{schema:'dds-full-boundary-projection/v1',aliases:{'from-a':'to-b'},removed_connection_edges:['join-a-b'],
      removed_connection_metadata:{'join-a-b':{edge:edge('join-a-b','to-b','from-a'),flow:'Intermediate',animation_state:'handoff'}}});
    assert.equal(projected.edges.some(e=>e.id==='join-a-b'),false);
    assert.equal(projected.flow['join-a-b'],undefined);
    assert.equal(projected.animation_states['join-a-b'],undefined);
    assert.deepEqual(projected.partials.map(p=>p.nodes.includes('to-b')),[true,true]);
    assert.deepEqual(projected.l0_refs.map(r=>r.partial.nodes.includes('to-b')),[true,true]);
    assert.deepEqual(projected.e2e,f.full.e2e);
    assert.equal(projected.visible_layout_cache,undefined);
    assert.equal(projected.visible_layout_signature,undefined);
    assert.equal(projected.routing_cache,undefined);
    const collapsed=DDS.view(projected,1,{});
    const expanded=DDS.view(projected,1,{expand:collapsed.nodes.filter(n=>n.autoFold).map(n=>n.id)});
    assert.equal(collapsed.nodes.filter(n=>n.id==='to-b').length,1);
    assert.equal(expanded.nodes.filter(n=>n.id==='to-b').length,1);
    assert.ok(expanded.edges.some(e=>e.from==='task-a'&&e.to==='to-b'));
    assert.ok(expanded.edges.some(e=>e.from==='to-b'&&e.to==='task-b'));
    assert.deepEqual(JSON.parse(JSON.stringify(f.full)),JSON.parse(f.sourceBytes.toString()),'caller source object remains unchanged');
    f.coreRefs.forEach((ref,index)=>assert.deepEqual(readFileSync(path.join(f.dir,ref.path)),f.coreBytes[index],'approved Core bytes remain unchanged'));
  } finally { rmSync(f.dir,{recursive:true,force:true}); }
});

test('same labels without a declared connection do not trigger a boundary merge',()=>{
  const f=fixture();
  try {
    const withoutConnection={...f.full,connections:[],edges:f.full.edges.filter(e=>e.id!=='join-a-b'),
      nodes:f.full.nodes.map(n=>({...n}))};
    const projected=runtimeIr(withoutConnection);
    assert.ok(projected.nodes.some(n=>n.id==='to-b'));
    assert.ok(projected.nodes.some(n=>n.id==='from-a'));
    assert.equal(projected.boundary_projection,undefined);
  } finally { rmSync(f.dir,{recursive:true,force:true}); }
});

test('a declared connection with conflicting semantic Entity fields is rejected',()=>{
  const f=fixture();
  try {
    const changedCore=structuredClone(f.cores[1]);
    changedCore.nodes.find(n=>n.id==='from-a').data_type='different-record';
    const coreBytes=writeJson(f.dir,'core-b.json',changedCore), bad=structuredClone(f.full);
    bad.nodes=bad.nodes.map(n=>n.id==='from-a'?{...n,data_type:'different-record'}:n);
    bad.approved_partials[1].sha256=sha(coreBytes);
    bad.flow=structuredClone(bad.flow);
    const refs=bad.approved_partials;
    const decisions=f.decisions.map(d=>d.id==='approve-1'?{...d,ir_sha256:refs[1].sha256}:d.id==='assemble'?{...d,partial_sha256:refs.map(r=>r.sha256)}:d);
    const bytes=Buffer.from(JSON.stringify(bad,null,2)+'\n');
    const state=workflowUnitState(bad,decisions,f.dir,sha(bytes));
    assert.ok(state.errors.some(message=>message.includes('conflicting boundary Entity semantics')));
    assert.throws(()=>runtimeIr(bad),/conflicting Entity semantics/);
  } finally { rmSync(f.dir,{recursive:true,force:true}); }
});

test('projection preserves unrelated edge IDs and rewrites endpoints while deleting only the declared connection',()=>{
  const f=fixture();
  try {
    const source={...f.full,nodes:f.full.nodes.map(n=>({...n})),edges:[...f.full.edges.map(e=>({...e})),edge('parallel-a-out','task-a','to-b')],
      flow:{...f.full.flow,'parallel-a-out':'outgoing'},animation_states:{...f.full.animation_states,'parallel-a-out':'produced'}};
    const projected=runtimeIr(source);
    assert.ok(projected.edges.some(e=>e.id==='parallel-a-out'&&e.to==='to-b'));
    assert.deepEqual(projected.boundary_projection.removed_connection_edges,['join-a-b']);
  } finally { rmSync(f.dir,{recursive:true,force:true}); }
});

test('display IDs are stable if independent connection pairs are reordered',()=>{
  const f=fixture();
  try {
    const source={...f.full,
      nodes:[...f.full.nodes.map(n=>({...n})),node('from-c','entity','Intermediate',50,100,{data_type:'record-set'}),node('to-d','entity','Intermediate',50,320,{data_type:'record-set'})],
      edges:[...f.full.edges.map(e=>({...e})),edge('join-c-d','to-d','from-c')],
      connections:['join-a-b','join-c-d'],flow:{...f.full.flow,'join-c-d':'Output D'},
      animation_states:{...f.full.animation_states,'join-c-d':'handoff'}};
    const forward=runtimeIr(source), reversed=runtimeIr({...source,connections:[...source.connections].reverse()});
    assert.deepEqual(forward.boundary_projection.aliases,reversed.boundary_projection.aliases);
    assert.equal(forward.boundary_projection.aliases['from-a'],'to-b');
    assert.equal(forward.boundary_projection.aliases['from-c'],'to-d');
  } finally { rmSync(f.dir,{recursive:true,force:true}); }
});

test('fan-in and fan-out identity connections fail closed',()=>{
  const f=fixture();
  try {
    const fanIn={...f.full,nodes:[...f.full.nodes.map(n=>({...n})),node('to-c','entity','Intermediate',50,320,{data_type:'record-set'})],
      edges:[...f.full.edges.map(e=>({...e})),edge('join-c-b','to-c','from-a')],connections:['join-a-b','join-c-b'],
      flow:{...f.full.flow,'join-c-b':'Intermediate'}};
    assert.throws(()=>runtimeIr(fanIn),/one-to-one/);
    const fanOut={...f.full,nodes:[...f.full.nodes.map(n=>({...n})),node('from-c','entity','Intermediate',50,100,{data_type:'record-set'})],
      edges:[...f.full.edges.map(e=>({...e})),edge('join-a-c','to-b','from-c')],connections:['join-a-b','join-a-c'],
      flow:{...f.full.flow,'join-a-c':'Intermediate'}};
    assert.throws(()=>runtimeIr(fanOut),/one-to-one/);
  } finally { rmSync(f.dir,{recursive:true,force:true}); }
});

test('unsupported semantic connection annotations fail closed',()=>{
  const f=fixture();
  try {
    const labeled={...f.full,nodes:f.full.nodes.map(n=>({...n})),edges:f.full.edges.map(e=>e.id==='join-a-b'?{...e,label:'handoff'}:{...e})};
    assert.throws(()=>runtimeIr(labeled),/additional edge semantics/);
  } finally { rmSync(f.dir,{recursive:true,force:true}); }
});

test('contraction that would create an unmarked cycle fails closed',()=>{
  const f=fixture();
  try {
    const source={...f.full,nodes:[...f.full.nodes.map(n=>({...n})),node('bridge','process','Bridge',300,200)],
      edges:[...f.full.edges.map(e=>({...e})),edge('path-a','to-b','bridge'),edge('path-b','bridge','from-a')],
      flow:{...f.full.flow,'path-a':'temporary','path-b':'temporary'}};
    assert.throws(()=>runtimeIr(source),/introduce an unmarked cycle/);
  } finally { rmSync(f.dir,{recursive:true,force:true}); }
});

test('prototype-like node IDs are not mistaken for boundary aliases',()=>{
  const f=fixture();
  try {
    const source={...f.full,nodes:[...f.full.nodes.map(n=>({...n})),node('constructor','process','Constructor')],
      edges:f.full.edges.map(e=>({...e}))};
    const projected=runtimeIr(source);
    assert.ok(projected.nodes.some(n=>n.id==='constructor'));
    assert.equal(Object.getPrototypeOf(projected.boundary_projection.aliases),null);
  } finally { rmSync(f.dir,{recursive:true,force:true}); }
});

test('identity connections cannot erase a loop; unrelated authored loop edges remain',()=>{
  const f=fixture();
  try {
    const loopConnection={...f.full,nodes:f.full.nodes.map(n=>({...n})),edges:f.full.edges.map(e=>e.id==='join-a-b'?{...e,loop:true}:{...e})};
    assert.throws(()=>runtimeIr(loopConnection),/non-loop Entity-to-Entity/);
    const unrelatedLoop={...f.full,nodes:f.full.nodes.map(n=>({...n})),
      edges:[...f.full.edges.map(e=>({...e})),{...edge('authored-loop','task-a','task-a'),loop:true}],
      flow:{...f.full.flow,'authored-loop':'repeat'},animation_states:{...f.full.animation_states,'authored-loop':'retry'}};
    const projected=runtimeIr(unrelatedLoop);
    assert.deepEqual(projected.edges.find(e=>e.id==='authored-loop'),{...edge('authored-loop','task-a','task-a'),loop:true});
  } finally { rmSync(f.dir,{recursive:true,force:true}); }
});

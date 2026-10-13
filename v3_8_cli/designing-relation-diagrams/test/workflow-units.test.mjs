import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateWorkflow, workflowState, context, schema } from '../scripts/lib/workflow.mjs';
import { runtimeType, runtimeIr } from '../scripts/lib/workflow-units.mjs';

const clone = x => structuredClone(x);
const node = (id, role, label=id, x=0, y=0) => ({id,role,label,x,y});
const edge = (id,from,to) => ({id,from,to,meaning:'execution_flow'});
function functionDefinition() {
  return {id:'fd',version:'1',diagram_type:'Function_Definition',nodes:[node('in','entity'),node('task','process'),node('out','entity')],edges:[edge('a','in','task'),edge('b','task','out')],e2e:{inputs:['in'],outputs:['out']},flow:{a:'원문',b:'결과'}};
}
function summary() {
  return {id:'sum',version:'1',diagram_type:'Process_Summary_Linear',definition_ref:{path:'function.json',id:'fd',version:'1',sha256:'0'.repeat(64),node_id:'task'},nodes:[node('in','entity'),node('p1','process'),node('p2','process'),node('out','entity')],edges:[edge('a','in','p1'),edge('b','p1','p2'),edge('c','p2','out')],e2e:{inputs:['in'],outputs:['out']},flow:{a:'원문',b:'자료',c:'결과'}};
}
test('workflow unit types validate their required structures',()=>{
  const f=functionDefinition(), s=summary();
  assert.doesNotThrow(()=>validateWorkflow(f)); assert.doesNotThrow(()=>validateWorkflow(s));
  assert.equal(runtimeType(f.diagram_type),'l0_summary');
  assert.equal(runtimeType(s.diagram_type),'l0_summary');
  s.workflow_unit=s.diagram_type; const converted=runtimeIr(s); assert.equal(converted.diagram_type,'l0_summary');assert.equal(converted.workflow_unit,undefined); assert.equal(s.diagram_type,'Process_Summary_Linear');
  for (const type of ['Process_Core','Process_Full']) assert.equal(runtimeType(type), type==='Process_Core'?'l1_partial':'l1_full');
});
test('canonical defaults expose sequential workflow contract and typed schema',()=>{
  assert.equal(context().diagram_type,'Function_Definition');
  assert.equal(context().runtime.mapping.Process_Core,'l1_partial');
  assert.equal(schema().properties.diagram_type.const,'Function_Definition');
  assert.equal(schema('Process_Full').properties.diagram_type.const,'Process_Full');
});
test('Function_Definition rejects anything other than one input, one process and one output',()=>{
  const bad=clone(functionDefinition()); bad.nodes.push(node('p2','process')); bad.edges.push(edge('c','task','p2'),edge('d','p2','out')); bad.flow.c='x'; bad.flow.d='y';
  assert.throws(()=>validateWorkflow(bad),/Function_Definition/);
});
test('animation_states requires one nonempty state label for every known execution edge',()=>{
  const valid=functionDefinition(); valid.animation_states={a:'원문 구조화',b:'검색 인덱스 생성'};
  assert.doesNotThrow(()=>validateWorkflow(valid));
  for (const states of [{a:'ok'}, {a:'ok',b:'  '}, {a:'ok',b:'ok',unknown:'bad'}, []]) {
    const bad=clone(valid); bad.animation_states=states; assert.throws(()=>validateWorkflow(bad),/animation_states/);
  }
});
test('canonical workflow_unit metadata cannot be attached to a legacy rendering type',()=>{
  const bad=functionDefinition(); bad.diagram_type='l0_summary'; bad.workflow_unit='Function_Definition';
  assert.throws(()=>validateWorkflow(bad),/must match/);
});
test('Process Summary rejects intermediate data nodes, edge labels, and more than three processes',()=>{
  for (const mutate of [s=>{s.nodes.push(node('mid','entity'));s.edges[1].to='mid';s.edges.push(edge('x','mid','p2'));s.flow.x='x';},s=>{s.edges[0].label='visible data';},s=>{s.nodes.push(node('p3','process'),node('p4','process'));s.edges[2].to='p3';s.edges.push(edge('d','p3','p4'),edge('e','p4','out'));s.flow.d='d';s.flow.e='e';}]) {
    const bad=summary(); mutate(bad); assert.throws(()=>validateWorkflow(bad),/Process_Summary/);
  }
});
test('Process_Summary_Router requires explicit routing semantics and a branch',()=>{
  const s=summary(); s.diagram_type='Process_Summary_Router'; s.routing='exclusive';
  s.nodes.push(node('p3','process')); s.edges[1].to='p3'; s.edges[2].from='p2'; s.edges.push(edge('d','p1','p2'),edge('e','p3','out')); s.flow.d='d';s.flow.e='e';
  assert.doesNotThrow(()=>validateWorkflow(s));
  delete s.routing; assert.throws(()=>validateWorkflow(s),/routing/);
  const dead=summary(); dead.diagram_type='Process_Summary_Router'; dead.routing='parallel'; dead.nodes.push(node('p3','process')); dead.edges[1].to='p3'; dead.edges.push(edge('d','p1','p2')); dead.flow.d='d';
  assert.throws(()=>validateWorkflow(dead),/reach an E2E output/);
});
test('Summary and Core references bind exact parent bytes and Core maps to its Summary task',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'dds-units-'));
  const f=functionDefinition(), fbytes=JSON.stringify(f,null,2)+'\n'; writeFileSync(path.join(dir,'function.json'),fbytes);
  const s=summary(); s.definition_ref.sha256=createHash('sha256').update(fbytes).digest('hex');
  const sbytes=JSON.stringify(s,null,2)+'\n'; writeFileSync(path.join(dir,'summary.json'),sbytes);
  const core={id:'core-a',version:'1',diagram_type:'Process_Core',summary_ref:{path:'summary.json',id:s.id,version:s.version,sha256:createHash('sha256').update(sbytes).digest('hex'),node_id:'p1'},nodes:[node('in','entity','in'),node('parse','process','추출'),node('out','entity','자료')],edges:[edge('x','in','parse'),edge('y','parse','out')],e2e:{inputs:['in'],outputs:['out']},flow:{x:'원문',y:'자료'},partials:[{id:'part-a',nodes:['in','parse','out'],edges:['x','y']}]};
  assert.deepEqual(workflowState(core,[],dir).errors,[]);
  const wrong=clone(core); wrong.summary_ref.sha256='f'.repeat(64); assert.ok(workflowState(wrong,[],dir).errors.some(e=>e.includes('SHA-256')));
  const wrongBoundary=clone(core); wrongBoundary.nodes[0].label='Something else'; assert.ok(workflowState(wrongBoundary,[],dir).errors.some(e=>e.includes('global Summary input')));
  writeFileSync(path.join(dir,'function.json'),fbytes+' ');assert.ok(workflowState(core,[],dir).errors.some(e=>e.includes('Function_Definition SHA-256 mismatch')));
});
test('Router Summary accepts separately approved cores in Full and rejects semantic drift or wrong assembly hashes',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'dds-router-full-'));
  const f=functionDefinition(), fbytes=JSON.stringify(f,null,2)+'\n'; writeFileSync(path.join(dir,'function.json'),fbytes);
  const s={id:'route',version:'1',diagram_type:'Process_Summary_Router',routing:'parallel',definition_ref:{path:'function.json',id:f.id,version:f.version,sha256:createHash('sha256').update(fbytes).digest('hex'),node_id:'task'},nodes:[node('in','entity','in'),node('alpha','process'),node('beta','process'),node('out','entity','out')],edges:[edge('ia','in','alpha'),edge('ib','in','beta'),edge('ao','alpha','out'),edge('bo','beta','out')],e2e:{inputs:['in'],outputs:['out']},flow:{ia:'in',ib:'in',ao:'out',bo:'out'}};
  const sbytes=JSON.stringify(s,null,2)+'\n';writeFileSync(path.join(dir,'summary.json'),sbytes);const summaryHash=createHash('sha256').update(sbytes).digest('hex');
  const cores=['alpha','beta'].map((task,index)=>({id:'core-'+task,version:'1',diagram_type:'Process_Core',summary_ref:{path:'summary.json',id:s.id,version:s.version,sha256:summaryHash,node_id:task},nodes:[node('in','entity','in',10,10),node(task,'process',task,10,30),node('out','entity','out',10,50)],edges:[edge(task+'-in','in',task),edge(task+'-out',task,'out')],e2e:{inputs:['in'],outputs:['out']},flow:{[task+'-in']:'source',[task+'-out']:'result'},animation_states:{[task+'-in']:'입력 확인',[task+'-out']:'결과 생성'},partials:[{id:'part-'+task,nodes:['in',task,'out'],edges:[task+'-in',task+'-out']}]}));
  const refs=cores.map((c,i)=>{const bytes=JSON.stringify(c,null,2)+'\n';writeFileSync(path.join(dir,`core${i}.json`),bytes);return{id:c.id,version:c.version,path:`core${i}.json`,sha256:createHash('sha256').update(bytes).digest('hex'),decision_ref:`approve${i}`};});
  const decisions=refs.map((r,i)=>({id:r.decision_ref,topic:'partial_approval',subject:'Human',status:'decided',answer:'synthetic test approval',answered_at:'2026-10-13T00:00:00Z',ir_sha256:r.sha256,simulated:true}));
  decisions.push({id:'assemble',topic:'assemble_full',subject:'Human',status:'decided',answer:'synthetic assembly',answered_at:'2026-10-13T00:00:00Z',partial_sha256:refs.map(r=>r.sha256),simulated:true});
  const full={id:'full-route',version:'1',diagram_type:'Process_Full',simulation:true,summary_ref:{path:'summary.json',id:s.id,version:s.version,sha256:summaryHash},approved_partials:refs,assembly_decision_ref:'assemble',nodes:[...new Map(cores.flatMap(c=>c.nodes).map(n=>[n.id,n])).values()],edges:cores.flatMap(c=>c.edges),e2e:{inputs:['in'],outputs:['out']},flow:Object.assign({},...cores.map(c=>c.flow)),animation_states:Object.assign({},...cores.map(c=>c.animation_states)),partials:cores.flatMap(c=>c.partials),connections:[]};
  const good=workflowState(full,decisions,dir);assert.deepEqual(good.errors,[]);assert.equal(good.simulation,true);assert.equal(good.l0_refs.length,2);
  const indexed=decisions.slice(0,2).map((d,i)=>({...d,ir_path:`core${i}.json`}));
  const coreState=workflowState({...cores[0],simulation:true},indexed,dir,refs[0].sha256);assert.equal(coreState.current_version_approved,true);assert.equal(coreState.eligible_to_propose_full,true);assert.equal(coreState.approved_cores.length,2);
  const changed=clone(full);changed.nodes.find(n=>n.id==='alpha').label='renamed';assert.ok(workflowState(changed,decisions,dir).errors.some(e=>e.includes('changed approved')));
  const driftFlow=clone(full);driftFlow.flow['alpha-in']='rewritten';assert.ok(workflowState(driftFlow,decisions,dir).errors.some(e=>e.includes('flow data')));
  const driftState=clone(full);driftState.animation_states['alpha-in']='다른 상태';assert.ok(workflowState(driftState,decisions,dir).errors.some(e=>e.includes('animation state')));
  const driftMembership=clone(full);driftMembership.partials[0].nodes.pop();assert.ok(workflowState(driftMembership,decisions,dir).errors.some(e=>e.includes('partial memberships')));
  const wrongDecision=clone(decisions);wrongDecision.at(-1).partial_sha256.pop();assert.ok(workflowState(full,wrongDecision,dir).errors.some(e=>e.includes('exact approved Core hashes')));
  const duplicate=clone(full);duplicate.approved_partials=[duplicate.approved_partials[0],duplicate.approved_partials[0]];assert.ok(workflowState(duplicate,decisions,dir).errors.some(e=>e.includes('duplicate Process_Core')));
  const noSimulation={...full,simulation:false};assert.ok(workflowState(noSimulation,decisions,dir).errors.some(e=>e.includes('Human approval')));
});
test('Linear Process_Full projects the Summary relation through a declared matching data connection',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'dds-linear-full-'));
  const f=functionDefinition(), fbytes=JSON.stringify(f,null,2)+'\n';writeFileSync(path.join(dir,'function.json'),fbytes);
  const s={id:'linear',version:'1',diagram_type:'Process_Summary_Linear',definition_ref:{path:'function.json',id:f.id,version:f.version,sha256:createHash('sha256').update(fbytes).digest('hex'),node_id:'task'},nodes:[node('in','entity','in'),node('a','process'),node('b','process'),node('out','entity','out')],edges:[edge('ia','in','a'),edge('ab','a','b'),edge('bo','b','out')],e2e:{inputs:['in'],outputs:['out']},flow:{ia:'input',ab:'middle',bo:'output'}};
  const sbytes=JSON.stringify(s,null,2)+'\n';writeFileSync(path.join(dir,'summary.json'),sbytes);const summaryHash=createHash('sha256').update(sbytes).digest('hex');
  const cores=[{id:'core-a',task:'a',input:'in',inputLabel:'in',output:'to-b',outputLabel:'중간자료'},{id:'core-b',task:'b',input:'from-a',inputLabel:'중간자료',output:'out',outputLabel:'out'}].map((x,i)=>({id:x.id,version:'1',diagram_type:'Process_Core',summary_ref:{path:'summary.json',id:s.id,version:s.version,sha256:summaryHash,node_id:x.task},nodes:[node(x.input,'entity',x.inputLabel,10,10),node(x.task,'process',x.task,10,30),node(x.output,'entity',x.outputLabel,10,50)],edges:[edge(x.task+'-in',x.input,x.task),edge(x.task+'-out',x.task,x.output)],e2e:{inputs:[x.input],outputs:[x.output]},flow:{[x.task+'-in']:'input',[x.task+'-out']:'output'},partials:[{id:'part-'+x.task,nodes:[x.input,x.task,x.output],edges:[x.task+'-in',x.task+'-out']}]}));
  const refs=cores.map((c,i)=>{const bytes=JSON.stringify(c,null,2)+'\n';writeFileSync(path.join(dir,`core${i}.json`),bytes);return{id:c.id,version:c.version,path:`core${i}.json`,sha256:createHash('sha256').update(bytes).digest('hex'),decision_ref:`approve${i}`};});
  const decisions=refs.map((r,i)=>({id:r.decision_ref,topic:'partial_approval',subject:'Human',status:'decided',answer:'approval',answered_at:'2026-10-13T00:00:00Z',ir_sha256:r.sha256}));decisions.push({id:'assemble',topic:'assemble_full',subject:'Human',status:'decided',answer:'assembly',answered_at:'2026-10-13T00:00:00Z',partial_sha256:refs.map(r=>r.sha256)});
  const connection=edge('join','to-b','from-a');
  const full={id:'full-linear',version:'1',diagram_type:'Process_Full',summary_ref:{path:'summary.json',id:s.id,version:s.version,sha256:summaryHash},approved_partials:refs,assembly_decision_ref:'assemble',nodes:[...new Map(cores.flatMap(c=>c.nodes).map(n=>[n.id,n])).values()],edges:[...cores.flatMap(c=>c.edges),connection],e2e:{inputs:['in'],outputs:['out']},flow:{...Object.assign({},...cores.map(c=>c.flow)),join:'중간자료'},partials:cores.flatMap(c=>c.partials),connections:['join']};
  assert.deepEqual(workflowState(full,decisions,dir).errors,[]);
  const displayStates=clone(full);displayStates.animation_states=Object.fromEntries(displayStates.edges.map(e=>[e.id,`상태: ${e.id}`]));assert.deepEqual(workflowState(displayStates,decisions,dir).errors,[]);
  const missing=clone(full);missing.connections=[];assert.ok(workflowState(missing,decisions,dir).errors.some(e=>e.includes('connections must list exactly')));
  const wrongProjection=clone(full);wrongProjection.edges.find(e=>e.id==='join').from='in';assert.ok(workflowState(wrongProjection,decisions,dir).errors.length);
});

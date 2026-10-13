import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture } from './workflow-fixture.mjs';
import { workflowState, validateWorkflow } from '../scripts/lib/workflow.mjs';
import { loadIr } from '../scripts/lib/engine.mjs';
import { parseArgs } from '../scripts/_args.mjs';
import '../scripts/workflow-runtime.js';
const base = () => { const dir=mkdtempSync(path.join(tmpdir(),'dds-workflow-')); return {dir,...fixture(dir)}; };
const clone = x=>structuredClone(x);
const cli = fileURLToPath(new URL('../scripts/drd.mjs',import.meta.url));
const run=(dir,args)=>spawnSync(process.execPath,[cli,...args],{cwd:dir,encoding:'utf8',env:{...process.env,DRD_NO_PNG:'1'}});
test('two approved snapshots allow proposal but no automatic assembly',()=>{
  const {dir,parts,full,decisions}=base(), p={...parts[0],approved_partials:full.approved_partials};
  const state=workflowState(p,decisions,dir); assert.equal(state.eligible_to_propose_full,true); assert.ok(state.next_actions.includes('propose_full_to_human'));
  const noHuman=workflowState(full,decisions.filter(d=>d.topic!=='assemble_full'),dir); assert.ok(noHuman.errors.some(e=>e.includes('Human assembly')));
});
test('full >9 nodes passes with approved content and geometry changes',()=>{
  const {dir,full,decisions}=base(); assert.ok(full.nodes.length>9); full.nodes[0].x+=30;
  assert.deepEqual(workflowState(full,decisions,dir).errors,[]);
  const result=run(dir,['finalize','full.json','--out','out']); assert.equal(result.status,0,result.stdout+result.stderr);
  const receipt=JSON.parse(readFileSync(path.join(dir,'out/receipt.json'))); assert.equal(receipt.workflow.stage,'l1_full'); assert.equal(receipt.options.level,1);
});
test('manual copies cannot alter or omit approved semantics',()=>{
  const {dir,full,decisions}=base();
  for(const change of [p=>p.nodes[0].label='changed',p=>p.edges[0].to='ready',p=>p.flow.in='changed',p=>p.nodes.pop(),p=>p.partials[0].nodes.pop()]) {
    const p=clone(full); change(p); assert.throws(()=>{ const result=workflowState(p,decisions,dir); if(result.errors.length) throw Error(result.errors.join()); });
  }
});
test('snapshot tampering, Agent decisions, repeated partials and wrong selected versions fail',()=>{
  const {dir,full,decisions}=base();
  const wrong=clone(decisions); wrong[0].subject='Agent'; assert.ok(workflowState(full,wrong,dir).errors.length);
  const selected=clone(decisions); selected.at(-1).partial_sha256.pop(); assert.ok(workflowState(full,selected,dir).errors.length);
  const dup=clone(full); dup.approved_partials=[dup.approved_partials[0],dup.approved_partials[0]]; assert.ok(workflowState(dup,decisions,dir).errors.length);
  writeFileSync(path.join(dir,'a.json'),readFileSync(path.join(dir,'a.json'),'utf8')+' '); assert.ok(workflowState(full,decisions,dir).errors.some(e=>e.includes('SHA-256')));
});
test('shared hover activates union; unique hover excludes sibling branch',()=>{
  const {full}=base(); const runtime=globalThis.DDSWorkflow;
  const common=runtime.scope(full,'node','ready'); assert.ok(common.nodes.has('a3')&&common.nodes.has('b3'));
  const single=runtime.scope(full,'node','a1'); assert.ok(single.nodes.has('input')&&single.nodes.has('aout')); assert.equal(single.nodes.has('b1'),false);
  const edge=runtime.scope(full,'edge','prepared'); assert.ok(edge.nodes.has('a3')&&edge.nodes.has('b3'));
});
test('flow tokens carry explicit transformed artifact and never follow unrelated input',()=>{
  const {full}=base(); const plan=globalThis.DDSWorkflow.flowPlan(full,'input'); assert.equal(plan[0].label,'원천 자료'); assert.equal(plan[1].label,'준비된 자료'); assert.ok(plan.some(p=>p.label==='a 산출물 aout'));
  assert.equal(new Set(plan.map(p=>p.edge)).size,full.edges.length);
});
test('animation tokens prefer state labels and move at a slower readable pace',()=>{
  const {full}=base(); full.animation_states=Object.fromEntries(full.edges.map((e,i)=>[e.id,`상태 ${i+1}`]));
  const plan=globalThis.DDSWorkflow.flowPlan(full,'input'); assert.equal(plan[0].label,'상태 1');
  const runtime=readFileSync(fileURLToPath(new URL('../scripts/workflow-runtime.js',import.meta.url)),'utf8');
  assert.match(runtime,/\/1800\)/);
});
test('L0 defaults to vertical input-Task-output regardless of node order, no folding or focus',()=>{
  const {l0}=base(); l0.nodes.reverse(); const args=parseArgs([]), loaded=loadIr(JSON.stringify(l0),args); assert.equal(loaded.bad,undefined); assert.equal(args.level,0);
  assert.deepEqual(loaded.ir.nodes.map(n=>n.y),[310,190,70]);
  assert.ok(loadIr(JSON.stringify(l0),parseArgs(['--collapse','task'])).bad);
});
test('L0 preserves multiple core Tasks in flow order',()=>{
  const {l0}=base(); l0.nodes.unshift({id:'task2',role:'process',label:'분석'});
  l0.edges.find(e=>e.to==='output').from='task2';
  l0.edges.push({id:'between',from:'task',to:'task2',meaning:'execution_flow'}); l0.flow.between='구조화된 자료';
  const loaded=loadIr(JSON.stringify(l0),parseArgs([])); assert.equal(loaded.bad,undefined);
  assert.deepEqual(['input','task','task2','output'].map(id=>loaded.ir.nodes.find(n=>n.id===id).y),[70,190,310,430]);
  l0.edges.find(e=>e.id==='between').to='output'; assert.throws(()=>validateWorkflow(l0),/chain/);
});

test('typed malformed memberships, cycles and missing token labels are rejected',()=>{
  const {full}=base();
  for(const change of [p=>delete p.flow.in,p=>p.nodes.push(p.nodes[0]),p=>p.nodes[0].parent='input',p=>p.partials[0].edges.push('missing'),p=>p.edges.push({id:'cycle',from:'ready',to:'prepare',meaning:'execution_flow'})]) { const p=clone(full); change(p); assert.throws(()=>validateWorkflow(p)); }
});
test('CLI context and workflow expose machine-readable state',()=>{
  const {dir}=base(); const c=run(dir,['context','l1_full']); assert.equal(c.status,0); assert.equal(JSON.parse(c.stdout).diagram_type,'l1_full');
  const w=run(dir,['workflow','full.json']); assert.equal(w.status,0,w.stdout); assert.equal(JSON.parse(w.stdout).review_version,'full@1');
  const s=run(dir,['schema','l1_full']); assert.equal(s.status,0); assert.equal(JSON.parse(s.stdout).properties.diagram_type.const,'l1_full');
});
test('verify rechecks external approval snapshots and decision evidence',()=>{
  const {dir}=base(); assert.equal(run(dir,['finalize','full.json','--out','out']).status,0);
  assert.equal(run(dir,['verify','out']).status,0);
  writeFileSync(path.join(dir,'a.json'),readFileSync(path.join(dir,'a.json'),'utf8')+' ');
  const stale=run(dir,['verify','out']); assert.equal(stale.status,1); assert.match(stale.stdout,/S5 INCONSISTENT/);
  fixture(dir); writeFileSync(path.join(dir,'decisions.json'),'{"decisions":[]}');
  const changed=run(dir,['verify','out']); assert.equal(changed.status,1); assert.match(changed.stdout,/decisions changed/);
});
test('new semantic content is rejected unless an added edge is declared for assembly review',()=>{
  const {dir,full,decisions}=base(), changed=clone(full);
  changed.nodes.push({id:'new',label:'New task',role:'process',x:200,y:1200}); assert.ok(workflowState(changed,decisions,dir).errors.some(e=>e.includes('new semantic nodes')));
  const connected=clone(full); connected.edges.push({id:'cross',from:'a1',to:'b2',meaning:'execution_flow'}); connected.flow.cross='Shared artifact';
  assert.ok(workflowState(connected,decisions,dir).errors.some(e=>e.includes('connections')));
  connected.connections=['cross']; assert.ok(workflowState(connected,decisions,dir).errors.some(e=>e.includes('boundaries')));
});
test('tokens stay on paths to declared outputs and folded summaries retain partial membership',()=>{
  const {full}=base(); full.nodes.push({id:'dead',label:'Dead end',role:'entity',x:1100,y:300}); full.edges.push({id:'deadEdge',from:'ready',to:'dead',meaning:'execution_flow'}); full.flow.deadEdge='unused';
  assert.equal(globalThis.DDSWorkflow.flowPlan(full,'input').some(p=>p.edge==='deadEdge'),false);
  full.nodes.push({id:'summary',label:'Summary',role:'process',x:200,y:500,expandAt:1}); full.nodes.filter(n=>/^a[0-3]$/.test(n.id)).forEach(n=>n.parent='summary');
  const scope=globalThis.DDSWorkflow.scope(full,'node','summary'); assert.ok(scope.edges.has('a1')); assert.ok(scope.nodes.has('aout')); assert.equal(scope.nodes.has('b3'),false);
});
test('decision path index discovers approved partials without changing snapshots',()=>{
  const {dir,decisions}=base(); decisions[0].ir_path=path.join(dir,'a.json'); decisions[1].ir_path=path.join(dir,'b.json');
  writeFileSync(path.join(dir,'decisions.json'),JSON.stringify({decisions}));
  const result=run(dir,['workflow','a.json']); assert.equal(result.status,0,result.stdout);
  const state=JSON.parse(result.stdout); assert.equal(state.current_version_approved,true); assert.equal(state.eligible_to_propose_full,true); assert.ok(state.next_actions.includes('propose_full_to_human'));
});
test('full cannot omit an unconsumed approved endpoint',()=>{
  const {dir,full,decisions}=base(); full.e2e.outputs=['aout']; assert.ok(workflowState(full,decisions,dir).errors.some(e=>e.includes('preserve every approved endpoint')));
});
test('linear E2E context does not activate intermediate Tasks in another partial',()=>{
  const ir={nodes:['src','t1','mid','t2','out'].map(id=>({id})),edges:[['src','t1'],['t1','mid'],['mid','t2'],['t2','out']].map(([from,to],i)=>({id:'e'+i,from,to,meaning:'execution_flow'})),e2e:{inputs:['src'],outputs:['out']},partials:[{id:'first',nodes:['src','t1','mid'],edges:['e0','e1']},{id:'second',nodes:['mid','t2','out'],edges:['e2','e3']}]};
  const a=globalThis.DDSWorkflow.scope(ir,'node','t1'); assert.ok(a.nodes.has('out')); assert.equal(a.nodes.has('t2'),false); assert.equal(a.edges.has('e2'),false);
  const shared=globalThis.DDSWorkflow.scope(ir,'node','mid'); assert.ok(shared.nodes.has('t1')&&shared.nodes.has('t2'));
});

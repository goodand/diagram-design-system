// WF-01/WF-03 contract coverage. Uses the existing workflowState/CLI contracts;
// decisions created below are deliberately synthetic test fixtures only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {workflowState} from '../scripts/lib/workflow.mjs';

const cli=fileURLToPath(new URL('../scripts/drd.mjs',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env:{...process.env,DRD_NO_PNG:'1'}});
const node=(id,role,label=id)=>({id,role,label});
const edge=(id,from,to)=>({id,from,to,meaning:'execution_flow'});
const functionUnit=()=>({id:'fd',version:'1',diagram_type:'Function_Definition',nodes:[node('in','entity','Input'),node('task','process','Work'),node('out','entity','Output')],edges:[edge('fi','in','task'),edge('fo','task','out')],e2e:{inputs:['in'],outputs:['out']},flow:{fi:'input',fo:'output'}});
function summaryUnit(type='Process_Summary_Linear',f=functionUnit(),fBytes=Buffer.from(JSON.stringify(f,null,2)+'\n')) {
  const router=type==='Process_Summary_Router';
  const nodes=[node('in','entity','Input'),node('p1','process','Prepare'),node('p2','process','Classify'),node('out','entity','Output')];
  const edges=router?[edge('a','in','p1'),edge('b','in','p2'),edge('c','p1','out'),edge('d','p2','out')]:[edge('a','in','p1'),edge('b','p1','p2'),edge('c','p2','out')];
  return {id:'sum-'+(router?'router':'linear'),version:'1',diagram_type:type,...(router?{routing:'parallel'}:{}),definition_ref:{path:'function.json',id:f.id,version:f.version,sha256:sha(fBytes),node_id:'task'},nodes,edges,e2e:{inputs:['in'],outputs:['out']},flow:Object.fromEntries(edges.map(e=>[e.id,e.id]))};
}
function coreUnit(summary,summaryPath='summary.json',summaryBytes=Buffer.from(JSON.stringify(summary,null,2)+'\n'),processId='p1') {
  const router=summary.diagram_type==='Process_Summary_Router';
  const input=!router&&processId==='p2'?'middle-p1':'in', output=router||processId==='p2'?'out':'middle-p1';
  const nodes=[node(input,'entity',input==='in'?'Input':'Intermediate'),node(processId,'process',processId),node(output,'entity',output==='out'?'Output':'Intermediate')];
  const edges=[edge('ci-'+processId,input,processId),edge('co-'+processId,processId,output)];
  return {id:'core-'+processId,version:'1',diagram_type:'Process_Core',summary_ref:{path:summaryPath,id:summary.id,version:summary.version,sha256:sha(summaryBytes),node_id:processId},nodes,edges,e2e:{inputs:[input],outputs:[output]},flow:Object.fromEntries(edges.map(e=>[e.id,e.id])),partials:[{id:'part-'+processId,nodes:nodes.map(n=>n.id),edges:edges.map(e=>e.id)}]};
}
function fullBundle(summary,summaryBytes,dir) {
  const cores=['p1','p2'].map(processId=>coreUnit(summary,'summary.json',summaryBytes,processId));
  const refs=cores.map((core,index)=>{const bytes=writeJson(dir,`core-${index}.json`,core);return{id:core.id,version:core.version,path:`core-${index}.json`,sha256:sha(bytes),decision_ref:`D-SIM-CORE-${index}`};});
  const decisions=refs.map(ref=>({id:ref.decision_ref,topic:'partial_approval',subject:'Human',status:'decided',outcome:'approved',answer:'SIMULATED TEST APPROVAL',answered_at:'2026-10-15T00:00:00Z',ir_sha256:ref.sha256,ir_path:ref.path,simulated:true}));
  decisions.push({id:'D-SIM-ASSEMBLE',topic:'assemble_full',subject:'Human',status:'decided',outcome:'approved',answer:'SIMULATED TEST ASSEMBLY',answered_at:'2026-10-15T00:00:00Z',partial_sha256:refs.map(ref=>ref.sha256),simulated:true});
  writeJson(dir,'decisions.json',{decisions});
  return {id:'full',version:'1',diagram_type:'Process_Full',simulation:true,summary_ref:{path:'summary.json',id:summary.id,version:summary.version,sha256:sha(summaryBytes)},approved_partials:refs,assembly_decision_ref:'D-SIM-ASSEMBLE',nodes:[...new Map(cores.flatMap(core=>core.nodes).map(item=>[item.id,item])).values()],edges:[...new Map(cores.flatMap(core=>core.edges).map(item=>[item.id,item])).values()],e2e:{inputs:['in'],outputs:['out']},flow:Object.assign({},...cores.map(core=>core.flow)),partials:cores.flatMap(core=>core.partials),connections:[]};
}
function parentFixture(type) {
  if(type==='Function_Definition') return functionUnit();
  if(type==='Process_Summary_Linear'||type==='Process_Summary_Router') {
    const s=summaryUnit(type); return s;
  }
  const nodes=[node('in','entity'),node('p','process'),node('out','entity')], edges=[edge('a','in','p'),edge('b','p','out')];
  if(type==='Process_Core') return {id:'parent-core',version:'1',diagram_type:type,summary_ref:{path:'unused.json',id:'unused',version:'1',sha256:'0'.repeat(64),node_id:'p'},nodes,edges,e2e:{inputs:['in'],outputs:['out']},flow:{a:'input',b:'output'},partials:[{id:'part',nodes:nodes.map(n=>n.id),edges:edges.map(e=>e.id)}]};
  return {id:'parent-full',version:'1',diagram_type:type,summary_ref:{path:'unused.json',id:'unused',version:'1',sha256:'0'.repeat(64)},nodes,edges,e2e:{inputs:['in'],outputs:['out']},flow:{a:'input',b:'output'},partials:[{id:'part',nodes:nodes.map(n=>n.id),edges:edges.map(e=>e.id)}],approved_partials:[{id:'a',version:'1',path:'a.json',sha256:'1'.repeat(64),decision_ref:'D-a'},{id:'b',version:'1',path:'b.json',sha256:'2'.repeat(64),decision_ref:'D-b'}],assembly_decision_ref:'D-assemble'};
}
function writeJson(dir,name,value) { const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n'); writeFileSync(path.join(dir,name),bytes); return bytes; }
function stateFor(child,dir,bytes) { return workflowState(child,[],dir,sha(bytes)); }

test('WF-01 allows only Function->Summary, Summary->Core, and Summary->Full parent stage links',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'dds-wf01-allowed-'));
  try {
    const f=functionUnit(), fb=writeJson(dir,'function.json',f);
    for(const type of ['Process_Summary_Linear','Process_Summary_Router']) {
      const s=summaryUnit(type,f,fb), sb=writeJson(dir,'summary.json',s);
      const summaryState=stateFor(s,dir,sb);
      assert.deepEqual(summaryState.errors,[],`${type} must resolve to exact Function bytes`);
      for(const processId of ['p1','p2']) {
        const c=coreUnit(s,'summary.json',sb,processId), cb=writeJson(dir,`${type}-${processId}.json`,c);
        assert.deepEqual(stateFor(c,dir,cb).errors,[],`${type} -> Core ${processId} must be allowed`);
      }
    }
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('WF-01 rejects every wrong parent type for Summary, Core, and Full links',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'dds-wf01-forbidden-'));
  try {
    const f=functionUnit(); writeJson(dir,'function.json',f);
    const parentTypes=['Function_Definition','Process_Summary_Linear','Process_Summary_Router','Process_Core','Process_Full'];
    const expected={
      Process_Summary_Linear:new Set(['Function_Definition']),
      Process_Summary_Router:new Set(['Function_Definition']),
      Process_Core:new Set(['Process_Summary_Linear','Process_Summary_Router']),
      Process_Full:new Set(['Process_Summary_Linear','Process_Summary_Router'])
    };
    for(const childType of Object.keys(expected)) for(const parentType of parentTypes) {
      const parent=parentFixture(parentType), parentBytes=writeJson(dir,`parent-${childType}-${parentType}.json`,parent);
      let child;
      if(childType.startsWith('Process_Summary')) {
        child=summaryUnit(childType,f,readFileSync(path.join(dir,'function.json')));
        child.definition_ref={path:`parent-${childType}-${parentType}.json`,id:parent.id,version:parent.version,sha256:sha(parentBytes),node_id:parentType==='Function_Definition'?'task':'p1'};
      } else if(childType==='Process_Core') {
        const summary=parentType.startsWith('Process_Summary')?parent:summaryUnit('Process_Summary_Linear',f,readFileSync(path.join(dir,'function.json')));
        child=coreUnit(summary,`parent-${childType}-${parentType}.json`,parentBytes,'p1');
        child.summary_ref.id=parent.id;child.summary_ref.version=parent.version;
      } else {
        child={id:'candidate-full',version:'1',diagram_type:'Process_Full',summary_ref:{path:`parent-${childType}-${parentType}.json`,id:parent.id,version:parent.version,sha256:sha(parentBytes)},nodes:[node('in','entity'),node('p','process'),node('out','entity')],edges:[edge('a','in','p'),edge('b','p','out')],e2e:{inputs:['in'],outputs:['out']},flow:{a:'input',b:'output'},partials:[{id:'part',nodes:['in','p','out'],edges:['a','b']}],approved_partials:[{id:'a',version:'1',path:'a.json',sha256:'1'.repeat(64),decision_ref:'D-a'},{id:'b',version:'1',path:'b.json',sha256:'2'.repeat(64),decision_ref:'D-b'}],assembly_decision_ref:'D-assemble'};
      }
      const childBytes=Buffer.from(JSON.stringify(child,null,2)+'\n');
      const state=stateFor(child,dir,childBytes);
      if(expected[childType].has(parentType)) {
        if(childType==='Process_Full') {
          assert.ok(!state.errors.some(e=>e.includes('must identify its Summary')),`${childType} must accept ${parentType} as its Summary parent: ${state.errors}`);
          continue; // Complete Linear and Router Full assemblies are exercised in workflow-units.test.mjs.
        }
        assert.deepEqual(state.errors,[],`${childType} -> ${parentType} should be valid`);
      } else {
        assert.ok(state.errors.length,`${childType} -> ${parentType} should be rejected`);
        const reason=childType.startsWith('Process_Summary')?/Function_Definition id\/version\/type mismatch/:childType==='Process_Core'?/summary_ref must identify a process in its exact Summary/:/summary_ref must identify its Summary/;
        assert.match(state.errors.join('\n'),reason,`${childType} -> ${parentType} must fail for the parent stage, not an unrelated missing approval or file`);
      }
    }
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('WF-03 finalize requires receipt, IR, SVG and HTML while PNG remains optional',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'dds-wf03-output-'));
  try {
    const src=path.join(dir,'function.json'),out=path.join(dir,'rendered');
    writeJson(dir,'function.json',functionUnit());
    const finalized=run('finalize',src,'--out',out);
    assert.equal(finalized.status,0,finalized.stdout+finalized.stderr);
    const receiptPath=path.join(out,'receipt.json');
    assert.ok(existsSync(receiptPath),'receipt.json is required');
    const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
    for(const key of ['ir','svg','html']) {
      const item=receipt.outputs[key];
      assert.ok(item?.path&&item.sha256,`receipt.outputs.${key} is required`);
      const target=path.join(out,item.path);
      assert.ok(existsSync(target),`${item.path} must exist`);
      assert.equal(sha(readFileSync(target)),item.sha256,`${item.path} receipt hash must match`);
    }
    assert.equal(receipt.outputs.png,null,'PNG is optional when conversion is disabled');
    const verified=run('verify',out);
    assert.equal(verified.status,0,verified.stdout+verified.stderr);
    assert.match(verified.stdout,/S7 UNKNOWN: no PNG produced/);
    for(const check of ['S1 CONSISTENT','S6 CONSISTENT','S8 CONSISTENT']) assert.ok(verified.stdout.includes(check),check);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('WF-03 every new Workflow Unit stage generates required receipt artifacts',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'dds-wf03-stages-'));
  try {
    const f=functionUnit(), fb=writeJson(dir,'function.json',f);
    const linear=summaryUnit('Process_Summary_Linear',f,fb), linearBytes=writeJson(dir,'summary.json',linear);
    const router=summaryUnit('Process_Summary_Router',f,fb); writeJson(dir,'router.json',router);
    const core=coreUnit(linear,'summary.json',linearBytes,'p1'), full=fullBundle(linear,linearBytes,dir);
    const cases=[['Function_Definition',f,'function.json'],['Process_Summary_Linear',linear,'summary.json'],['Process_Summary_Router',router,'router.json'],['Process_Core',core,'core-stage.json'],['Process_Full',full,'full.json']];
    writeJson(dir,'core-stage.json',core); writeJson(dir,'full.json',full);
    for(const [type,ir,file] of cases) {
      const output=path.join(dir,`out-${type}`), finalized=run('finalize',path.join(dir,file),'--out',output);
      assert.equal(finalized.status,0,`${type}: ${finalized.stdout}${finalized.stderr}`);
      const receipt=JSON.parse(readFileSync(path.join(output,'receipt.json'),'utf8'));
      assert.equal(receipt.workflow.stage,type);
      for(const key of ['ir','svg','html']) {
        const item=receipt.outputs[key];
        assert.ok(item?.path&&item.sha256,`${type}: receipt.outputs.${key} required`);
        const artifact=path.join(output,item.path);
        assert.ok(existsSync(artifact),`${type}: ${item.path} exists`);
        assert.equal(sha(readFileSync(artifact)),item.sha256,`${type}: ${item.path} hash`);
      }
      assert.equal(receipt.outputs.png,null,`${type}: PNG may be absent`);
      const verified=run('verify',output);
      assert.equal(verified.status,0,`${type}: ${verified.stdout}${verified.stderr}`);
      assert.match(verified.stdout,/S6 CONSISTENT:/,`${type}: receipt artifact hashes`);
      assert.match(verified.stdout,/S8 CONSISTENT:/,`${type}: HTML embeds SVG`);
      assert.match(verified.stdout,/S1 CONSISTENT:/,`${type}: source IR hash`);
      assert.match(verified.stdout,/S7 UNKNOWN: no PNG produced/);
      assert.match(verified.stdout,/S5 CONSISTENT:/);
      for(const key of ['ir','svg','html']){
        const artifact=path.join(output,receipt.outputs[key].path),saved=readFileSync(artifact);
        try{
          rmSync(artifact);
          const missing=run('verify',output);
          assert.notEqual(missing.status,0,`${type}: missing ${key} must fail`);
          assert.match(missing.stdout,/S6 INCONSISTENT:/);
        }finally{writeFileSync(artifact,saved);}
      }
      const receiptFile=path.join(output,'receipt.json'),receiptBytes=readFileSync(receiptFile);
      try{
        rmSync(receiptFile);
        const missing=run('verify',output);
        assert.equal(missing.status,2);assert.match(missing.stderr,/no receipt.json/);
      }finally{writeFileSync(receiptFile,receiptBytes);}
      const inputFile=path.join(dir,file),inputBytes=readFileSync(inputFile);
      try{
        rmSync(inputFile);
        const missing=run('verify',output);
        assert.notEqual(missing.status,0);assert.match(missing.stdout,/S5 INCONSISTENT: source IR unavailable/);
      }finally{writeFileSync(inputFile,inputBytes);}
      if(type==='Process_Full'){
        const decisionFile=path.join(dir,'decisions.json'),saved=readFileSync(decisionFile);
        try{
          rmSync(decisionFile);
          const missing=run('verify',output);
          assert.notEqual(missing.status,0);assert.match(missing.stdout,/S5 INCONSISTENT:/);
        }finally{writeFileSync(decisionFile,saved);}
      }
    }
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('WF-05 workflow is read-only and finalize emits only the requested Unit outputs',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'dds-wf05-'));
  try {
    const f=functionUnit(), fb=writeJson(dir,'function.json',f);
    const linear=summaryUnit('Process_Summary_Linear',f,fb), linearBytes=writeJson(dir,'summary.json',linear);
    const router=summaryUnit('Process_Summary_Router',f,fb); writeJson(dir,'router.json',router);
    const core=coreUnit(linear,'summary.json',linearBytes,'p1');
    const full=fullBundle(linear,linearBytes,dir);
    const cases=[['Function_Definition',f,'function.json'],['Process_Summary_Linear',linear,'summary.json'],['Process_Summary_Router',router,'router.json'],['Process_Core',core,'core-stage.json'],['Process_Full',full,'full.json']];
    writeJson(dir,'core-stage.json',core); writeJson(dir,'full.json',full);
    for(const [type,ir,file] of cases) {
      const src=path.join(dir,file), beforeFiles=readdirSync(dir).sort(), beforeHash=sha(readFileSync(src));
      const result=run('workflow',src);
      assert.equal(result.status,0,`${type}: ${result.stdout}${result.stderr}`);
      const workflow=JSON.parse(result.stdout);
      assert.equal(workflow.stage,type);
      assert.ok(Array.isArray(workflow.next_actions),`${type}: workflow reports next action`);
      assert.deepEqual(readdirSync(dir).sort(),beforeFiles,`${type}: workflow must not create next-stage files/directories`);
      assert.equal(sha(readFileSync(src)),beforeHash,`${type}: workflow must not modify its input`);

      const out=path.join(dir,`only-${type}`), finalized=run('finalize',src,'--out',out);
      assert.equal(finalized.status,0,`${type}: ${finalized.stdout}${finalized.stderr}`);
      const receipt=JSON.parse(readFileSync(path.join(out,'receipt.json'),'utf8'));
      const expected=['receipt.json',receipt.outputs.ir.path,receipt.outputs.svg.path,receipt.outputs.html.path].sort();
      assert.equal(receipt.outputs.png,null,`${type}: configured optional PNG is absent`);
      assert.deepEqual(readdirSync(out).sort(),expected,`${type}: finalize must create only current-unit View/receipt outputs`);
      assert.ok(!readdirSync(out).some(name=>/^(function|summary|core|full)\.json$/i.test(name)),`${type}: no next-stage source Unit may appear in output`);
    }
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

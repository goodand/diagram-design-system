// Author: chatgpt_gpt6. Canonical source identity must survive CLI rendering.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateWorkflow,workflowState} from '../scripts/lib/workflow.mjs';
import {loadIr} from '../scripts/lib/engine.mjs';
const cli=fileURLToPath(new URL('../scripts/drd.mjs',import.meta.url));
const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env:{...process.env,DRD_NO_PNG:'1'}});
test('canonical Function_Definition CLI preserves source type and renders static runtime',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'dds-unit-cli-'));
 try {
  const ir={id:'function',version:'1',diagram_type:'Function_Definition',nodes:[
   {id:'in',role:'entity',label:'Input'},{id:'work',role:'process',label:'Transform'},{id:'out',role:'entity',label:'Output'}],
   edges:[{id:'e1',from:'in',to:'work',meaning:'execution_flow'},{id:'e2',from:'work',to:'out',meaning:'execution_flow'}],
   e2e:{inputs:['in'],outputs:['out']},flow:{e1:'Input',e2:'Output'}};
  const src=path.join(dir,'source.json'),out=path.join(dir,'out'); writeFileSync(src,JSON.stringify(ir));
  const result=run('finalize',src,'--out',out); assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(JSON.parse(readFileSync(path.join(out,'ir.json'))).diagram_type,'Function_Definition');
  const receipt=JSON.parse(readFileSync(path.join(out,'receipt.json')));
  assert.equal(receipt.workflow.stage,'Function_Definition'); assert.equal(receipt.options.level,0);
  const html=readFileSync(path.join(out,'diagram.html'),'utf8'); assert.match(html,/"diagram_type":"l0_summary"/);
  assert.equal(run('verify',out).status,0);
  ir.nodes.push({id:'extra',role:'process',label:'Too early'}); writeFileSync(src,JSON.stringify(ir));
  assert.notEqual(run('finalize',src,'--out',out).status,0); assert.equal(existsSync(path.join(out,'diagram.html')),false);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
test('context and schema default to Function_Definition; version is v3.92-cli',()=>{
 const context=run('context'); assert.equal(context.status,0,context.stdout+context.stderr);
 assert.equal(JSON.parse(context.stdout).diagram_type,'Function_Definition');
 const schema=run('schema'); assert.equal(schema.status,0,schema.stdout+schema.stderr);
 assert.equal(JSON.parse(schema.stdout).properties.diagram_type.const,'Function_Definition');
 assert.match(run('version').stdout,/v3\.92-cli/);
});
function coreWithCount(count) {
 const nodes=Array.from({length:count},(_,i)=>({id:'n'+i,role:i===0||i===count-1?'entity':'process',label:'Node '+i,x:200,y:50+i*100}));
 const edges=nodes.slice(1).map((n,i)=>({id:'e'+i,from:nodes[i].id,to:n.id,meaning:'execution_flow'}));
 return {id:'core',version:'1',diagram_type:'Process_Core',nodes,edges,e2e:{inputs:[nodes[0].id],outputs:[nodes.at(-1).id]},flow:Object.fromEntries(edges.map(e=>[e.id,'data'])),
  partials:[{id:'core-part',nodes:nodes.map(n=>n.id),edges:edges.map(e=>e.id)}],summary_ref:{path:'parent.json',id:'parent',version:'1',sha256:'0'.repeat(64),node_id:'task'}};
}
test('Core source-node cap applies before folding: nine accepted, ten rejected',()=>{
 assert.doesNotThrow(()=>validateWorkflow(coreWithCount(9)));
 assert.throws(()=>validateWorkflow(coreWithCount(10)),/nine source nodes/);
});
test('Core cannot skip Summary by referencing a valid Function_Definition',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'dds-skip-stage-'));
 try {
  const parent={...coreWithCount(3),id:'parent',diagram_type:'Function_Definition'};
  delete parent.partials; delete parent.summary_ref;
  const bytes=JSON.stringify(parent); writeFileSync(path.join(dir,'parent.json'),bytes);
  const core=coreWithCount(3);core.summary_ref.sha256=createHash('sha256').update(bytes).digest('hex');core.summary_ref.node_id='n1';
  const result=workflowState(core,[],dir);
  assert.ok(result.errors.some(e=>e.includes('exact Summary')),JSON.stringify(result));
 } finally {rmSync(dir,{recursive:true,force:true});}
});
test('automatic Summary layout also sizes its default canvas',()=>{
 const ir=coreWithCount(4);ir.diagram_type='Process_Summary_Linear';delete ir.summary_ref;delete ir.partials;
 ir.definition_ref={path:'function.json',id:'function',version:'1',sha256:'0'.repeat(64),node_id:'task'};
 ir.nodes.forEach(n=>{delete n.x;delete n.y;});
 const result=loadIr(JSON.stringify(ir),{level:null,expand:[],collapse:[],focus:null});
 assert.equal(result.bad,undefined);assert.ok(result.ir.h>=result.ir.nodes.at(-1).y+22,'default canvas must include the final output');
});
test('Core with explicit node positions and omitted canvas gets sufficient default bounds',()=>{
 const result=loadIr(JSON.stringify(coreWithCount(7)),{level:null,expand:[],collapse:[],focus:null});
 assert.equal(result.bad,undefined);assert.ok(result.ir.h>=672);
});

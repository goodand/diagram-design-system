// Author: chatgpt_gpt6. Regression coverage for the v3.91 Summary contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateWorkflowUnit } from '../scripts/lib/workflow-units.mjs';

const entity = id => ({ id, role:'entity', label:id });
const process = id => ({ id, role:'process', label:id });
const edge = (id, from, to) => ({ id, from, to, meaning:'execution_flow' });
function summary(type, count) {
  const nodes=[entity('in'),...Array.from({length:count},(_,i)=>process(`p${i+1}`)),entity('out')];
  let edges;
  if(type==='Process_Summary_Linear') {
    edges=Array.from({length:nodes.length-1},(_,i)=>edge(`e${i}`,nodes[i].id,nodes[i+1].id));
  } else if(count===1) {
    // This is a valid router under the current topology check: input fans out
    // to the sole process and directly to output, then both paths converge.
    edges=[edge('in-process','in','p1'),edge('in-output','in','out'),edge('process-output','p1','out')];
  } else {
    edges=[edge('in-p1','in','p1'),edge('in-p2','in','p2'),edge('p1-out','p1','out'),edge('p2-out','p2','out')];
    for(let i=2;i<count;i++) edges.push(edge(`in-p${i+1}`,'in',`p${i+1}`),edge(`p${i+1}-out`,`p${i+1}`,'out'));
  }
  return {id:'summary',version:'1',diagram_type:type,...(type==='Process_Summary_Router'?{routing:'parallel'}:{}),definition_ref:{path:'function.json',id:'fd',version:'1',sha256:'0'.repeat(64),node_id:'task'},nodes,edges,e2e:{inputs:['in'],outputs:['out']},flow:Object.fromEntries(edges.map(e=>[e.id,'data']))};
}

test('Linear and Router summaries require at least two processes',()=>{
  for(const type of ['Process_Summary_Linear','Process_Summary_Router']) {
    assert.throws(()=>validateWorkflowUnit(summary(type,1)),/Process_Summary.*2\.\.3/);
  }
});

test('Linear and Router summaries accept two or three processes and reject four',()=>{
  for(const type of ['Process_Summary_Linear','Process_Summary_Router']) {
    for(const count of [2,3]) assert.doesNotThrow(()=>validateWorkflowUnit(summary(type,count)),`${type} ${count}`);
    assert.throws(()=>validateWorkflowUnit(summary(type,4)),/Process_Summary.*2\.\.3/);
  }
});

test('workflow unit schema constrains both Summary types to two or three process nodes',()=>{
  const schema=JSON.parse(readFileSync(new URL('../references/workflow-units.schema.json',import.meta.url),'utf8'));
  const processRule=schema.$defs.summaryNodes.allOf.find(rule=>rule.contains?.properties?.role?.const==='process');
  assert.equal(processRule.minContains,2);
  assert.equal(processRule.maxContains,3);
  assert.equal(schema.$defs.processSummaryLinear.allOf[1].properties.edges.minItems,3);
  assert.equal(schema.$defs.processSummaryRouter.allOf[1].properties.edges.minItems,4);
});

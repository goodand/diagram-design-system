import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const node = (id, role, label=id, x=0, y=0) => ({ id, role, label, x, y });
const edge = (id, from, to) => ({ id, from, to, meaning:'execution_flow' });
const save = (dir, file, value) => {
  const bytes = JSON.stringify(value, null, 2) + '\n';
  writeFileSync(path.join(dir, file), bytes);
  return { path:file, id:value.id, version:value.version, sha256:sha(bytes) };
};

function workflow(dir, prefix, functionLabel, inputLabel, middleLabel, outputLabel, {internalTarget=false}={}) {
  const f = { id:`${prefix}-function`, version:'1', diagram_type:'Function_Definition',
    nodes:[node(`${prefix}-in`,'entity',inputLabel),node(`${prefix}-task`,'process',functionLabel),node(`${prefix}-out`,'entity',outputLabel)],
    edges:[edge(`${prefix}-fi`,`${prefix}-in`,`${prefix}-task`),edge(`${prefix}-fo`,`${prefix}-task`,`${prefix}-out`)],
    e2e:{inputs:[`${prefix}-in`],outputs:[`${prefix}-out`]},flow:{[`${prefix}-fi`]:'input',[`${prefix}-fo`]:'result'} };
  const fref = save(dir,`${prefix}-function.json`,f);
  const s = { id:`${prefix}-summary`, version:'1', diagram_type:'Process_Summary_Linear',
    definition_ref:{...fref,node_id:`${prefix}-task`},
    nodes:[node(`${prefix}-in`,'entity',inputLabel),node(`${prefix}-a`,'process','Prepare'),node(`${prefix}-b`,'process','Finish'),node(`${prefix}-out`,'entity',outputLabel)],
    edges:[edge(`${prefix}-ia`,`${prefix}-in`,`${prefix}-a`),edge(`${prefix}-ab`,`${prefix}-a`,`${prefix}-b`),edge(`${prefix}-bo`,`${prefix}-b`,`${prefix}-out`)],
    e2e:{inputs:[`${prefix}-in`],outputs:[`${prefix}-out`]},flow:{[`${prefix}-ia`]:'input',[`${prefix}-ab`]:'middle',[`${prefix}-bo`]:'result'} };
  const sref=save(dir,`${prefix}-summary.json`,s);
  const specs=[
    {task:`${prefix}-a`,in:`${prefix}-in`,inLabel:inputLabel,out:`${prefix}-mid`,outLabel:middleLabel},
    {task:`${prefix}-b`,in:`${prefix}-mid`,inLabel:middleLabel,out:`${prefix}-out`,outLabel:outputLabel},
  ];
  const cores=specs.map((x,i)=>{const taskNode=internalTarget&&i===0?`${prefix}-a-detail`:x.task;return {id:`${prefix}-core-${i}`,version:'1',diagram_type:'Process_Core',
    summary_ref:{...sref,node_id:x.task},
    nodes:[node(x.in,'entity',x.inLabel,120,80),node(taskNode,'process',i===0?functionLabel:'Finishing',300,80),node(x.out,'entity',x.outLabel,480,80)],
    edges:[edge(`${prefix}-ce${i}a`,x.in,taskNode),edge(`${prefix}-ce${i}b`,taskNode,x.out)],
    e2e:{inputs:[x.in],outputs:[x.out]},flow:{[`${prefix}-ce${i}a`]:'input',[`${prefix}-ce${i}b`]:'output'},
    partials:[{id:`${prefix}-partial-${i}`,nodes:[x.in,taskNode,x.out],edges:[`${prefix}-ce${i}a`,`${prefix}-ce${i}b`]}]};});
  const coreRefs=cores.map((c,i)=>{
    const ref=save(dir,`${prefix}-core-${i}.json`,c);
    return {...ref,decision_ref:`${prefix}-approve-${i}`};
  });
  const decisions=coreRefs.map(r=>({id:r.decision_ref,topic:'partial_approval',subject:'Human',status:'decided',answer:'approved',answered_at:'2026-10-13T00:00:00Z',ir_sha256:r.sha256}));
  decisions.push({id:`${prefix}-assemble`,topic:'assemble_full',subject:'Human',status:'decided',answer:'assembled',answered_at:'2026-10-13T00:00:00Z',partial_sha256:coreRefs.map(r=>r.sha256)});
  const full={id:`${prefix}-full`,version:'1',diagram_type:'Process_Full',summary_ref:sref,
    approved_partials:coreRefs,assembly_decision_ref:`${prefix}-assemble`,
    nodes:[...new Map(cores.flatMap(c=>c.nodes).map(n=>[n.id,n])).values()],
    edges:cores.flatMap(c=>c.edges),e2e:{inputs:[`${prefix}-in`],outputs:[`${prefix}-out`]},
    flow:Object.assign({},...cores.map(c=>c.flow)),partials:cores.flatMap(c=>c.partials),connections:[]};
  const fullRef=save(dir,`${prefix}-full.json`,full);
  return {f,s,cores,full,fullRef,decisions,targetNodeId:internalTarget?`${prefix}-a-detail`:`${prefix}-a`};
}

export function linkedFixture({simulation=false,internalTarget=false}={}) {
  const dir=mkdtempSync(path.join(tmpdir(),'dds-linked-diagrams-'));
  const parent=workflow(dir,'parent','Optimize','Current state','Optimization evidence','Goal state',{internalTarget});
  const child=workflow(dir,'child','Optimize','Current state','Prepared candidates','Optimization evidence');
  const parentPartial=parent.full.partials.find(p=>p.nodes.includes(parent.targetNodeId));
  const link={node_id:parent.targetNodeId,definition_ref:{...save(dir,'child-function.json',child.f),node_id:'child-task'},full_ref:child.fullRef,
    decision_ref:'link-approved',boundary_map:{'child-in':'parent-in','child-out':'parent-mid'}};
  // Both refs point at the same exact Function bytes; this also checks that the separately declared
  // definition reference agrees with the function reached through the child's Full -> Summary chain.
  const parentFull={...parent.full,simulation,
    linked_diagrams:[link]};
  const parentBytes=JSON.stringify(parentFull,null,2)+'\n';
  const parentPath=path.join(dir,'parent-full.json');writeFileSync(parentPath,parentBytes);
  const decisions=[...parent.decisions,...child.decisions,
    {id:'link-approved',topic:'linked_diagram_approval',subject:'Human',status:'decided',answer:'approved',answered_at:'2026-10-13T00:00:00Z',ir_sha256:link.full_ref.sha256,parent_node_id:parent.targetNodeId}];
  return {dir,parentFull,parentBytes,parentPath,parent,child,link,decisions,parentPartial};
}



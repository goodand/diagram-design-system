import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const UNIT_TYPES = ['Function_Definition','Process_Summary_Linear','Process_Summary_Router','Process_Core','Process_Full'];
const PROCESS_SUMMARIES = new Set(['Process_Summary_Linear','Process_Summary_Router']);
const TYPE_MAP = {Function_Definition:'l0_summary',Process_Summary_Linear:'l0_summary',Process_Summary_Router:'l0_summary',Process_Core:'l1_partial',Process_Full:'l1_full'};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const human = (decs,id,topic,allowSimulation=false) => decs.find(d=>d.id===id&&d.topic===topic&&d.subject==='Human'&&d.status==='decided'&&typeof d.answer==='string'&&d.answer.trim()&&d.answered_at&&(!d.simulated||allowSimulation));
const layoutKeys=new Set(['x','y','w','h','pos','parent','expandAt','route','busX','midY','sdx','tdx','bend','labelAt']);
const semantic=x=>Object.fromEntries(Object.entries(x).filter(([key])=>!layoutKeys.has(key)));

export function runtimeType(type) { return TYPE_MAP[type] || type; }
export function runtimeIr(ir) {
  const out=structuredClone(ir);
  if (TYPE_MAP[out.diagram_type]) { out.diagram_type=TYPE_MAP[out.diagram_type]; delete out.workflow_unit; }
  if (out.definition_ref?.snapshot) out.definition_ref.snapshot=runtimeIr(out.definition_ref.snapshot);
  if (out.summary_ref?.snapshot) out.summary_ref.snapshot=runtimeIr(out.summary_ref.snapshot);
  if (out.l0_ref?.snapshot) out.l0_ref.snapshot=runtimeIr(out.l0_ref.snapshot);
  return out;
}
export function isWorkflowUnit(ir) { return UNIT_TYPES.includes(ir?.diagram_type); }

function fail(message) { throw Error(message); }
function graph(ir) {
  if(typeof ir.id!=='string'||!ir.id||typeof ir.version!=='string'||!ir.version) fail('workflow unit needs a nonempty string id and version');
  if(!Array.isArray(ir.nodes)||!Array.isArray(ir.edges)||!ir.e2e||!ir.flow||typeof ir.flow!=='object'||Array.isArray(ir.flow)) fail('workflow unit needs nodes, edges, E2E endpoints and a flow object');
  const nodes=new Map(ir.nodes.map(n=>[n.id,n])), edges=ir.edges;
  const safe=id=>typeof id==='string'&&/^[A-Za-z0-9_.:-]+$/.test(id);
  if (nodes.size!==ir.nodes.length||ir.nodes.some(n=>!safe(n.id)||typeof n.label!=='string'||!n.label||!['entity','process'].includes(n.role))) fail('workflow unit nodes need unique safe IDs, labels and roles');
  if (new Set(edges.map(e=>e.id)).size!==edges.length||edges.some(e=>!safe(e.id)||!nodes.has(e.from)||!nodes.has(e.to)||e.meaning!=='execution_flow'||(e.loop!==undefined&&typeof e.loop!=='boolean'))) fail('workflow unit needs unique execution_flow edges with known endpoints');
  for(const e of edges) if(typeof ir.flow?.[e.id]!=='string'||!ir.flow[e.id].trim()) fail(`workflow unit flow.${e.id} must name carried data`);
  if(Object.keys(ir.flow||{}).some(id=>!edges.some(e=>e.id===id))) fail('workflow unit flow references unknown edge');
  if(ir.animation_states!==undefined) {
    const states=ir.animation_states, edgeIds=new Set(edges.map(e=>e.id));
    if(!states||typeof states!=='object'||Array.isArray(states)||Object.keys(states).length!==edges.length||edges.some(e=>typeof states[e.id]!=='string'||!states[e.id].trim())||Object.keys(states).some(id=>!edgeIds.has(id))) fail('workflow unit animation_states must provide a nonempty state label for every known execution edge');
  }
  for(const n of ir.nodes) {
    if(['x','y','w','h'].some(k=>n[k]!==undefined&&!Number.isFinite(n[k]))) fail('workflow unit node geometry must be finite');
    if(n.pos&&(!Object.keys(n.pos).length||Object.values(n.pos).some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v))))) fail('workflow unit pos must contain coordinate pairs');
    if(n.expandAt!==undefined&&(!Number.isFinite(n.expandAt)||!Number.isInteger(n.expandAt))) fail('workflow unit expandAt must be an integer');
    if(['Process_Core','Process_Full'].includes(ir.diagram_type)&&!n.pos&&(!Number.isFinite(n.x)||!Number.isFinite(n.y))&&n.expandAt===undefined) fail('Process_Core and Process_Full nodes need layout coordinates');
    if(n.parent!==undefined&&typeof n.parent!=='string') fail('workflow unit parent must reference a node ID');
  }
  for(const n of ir.nodes){const seen=new Set([n.id]);let p=n.parent;while(p){if(!nodes.has(p)||seen.has(p))fail('workflow unit has a missing or cyclic parent');seen.add(p);p=nodes.get(p).parent;}}
  const inputs=ir.e2e.inputs, outputs=ir.e2e.outputs;
  if(!Array.isArray(inputs)||!inputs.length||new Set(inputs).size!==inputs.length||!Array.isArray(outputs)||!outputs.length||new Set(outputs).size!==outputs.length||inputs.some(id=>outputs.includes(id))) fail('workflow unit needs distinct E2E input and output entities');
  if([...inputs,...outputs].some(id=>nodes.get(id)?.role!=='entity')) fail('workflow unit E2E endpoints must be entities');
  if(edges.some(e=>inputs.includes(e.to)&&!e.loop||outputs.includes(e.from)&&!e.loop)) fail('workflow unit inputs must be initial and outputs terminal');
  const flowEdges=edges.filter(e=>!e.loop), state=new Map();
  const checkCycle=id=>{if(state.get(id)===1)fail('workflow unit unmarked flow cycle');if(state.get(id)===2)return;state.set(id,1);for(const e of flowEdges.filter(x=>x.from===id))checkCycle(e.to);state.set(id,2);};
  ir.nodes.forEach(n=>checkCycle(n.id));
  const reachable=new Set(inputs), todo=[...inputs];
  while(todo.length){const id=todo.pop(); for(const e of flowEdges.filter(x=>x.from===id)) if(!reachable.has(e.to)){reachable.add(e.to);todo.push(e.to);}}
  if(!outputs.some(id=>reachable.has(id))||reachable.size!==nodes.size) fail('workflow unit nodes must all be on a path from E2E input to output');
  const reachesOutput=new Set(outputs), backwards=[...outputs];
  while(backwards.length){const id=backwards.pop();for(const e of flowEdges.filter(x=>x.to===id))if(!reachesOutput.has(e.from)){reachesOutput.add(e.from);backwards.push(e.from);}}
  if(reachesOutput.size!==nodes.size) fail('every workflow unit node must reach an E2E output');
  if(ir.nodes.filter(n=>n.role==='process').some(n=>!reachable.has(n.id))) fail('workflow unit has an unreachable process');
  return {nodes,edges,inputs,outputs};
}
function refShape(ref,withNode) {
  const required=['path','id','version','sha256',...(withNode?['node_id']:[])];
  if(!ref||required.some(k=>typeof ref[k]!=='string'||!ref[k])||!/^[a-f0-9]{64}$/.test(ref.sha256)) fail(`workflow reference needs ${required.join(', ')}`);
}
export function validateWorkflowUnit(ir) {
  const type=ir.diagram_type;
  if(!isWorkflowUnit(ir)) return;
  if(!ir.id||!ir.version) fail('workflow unit needs id and version');
  if(ir.simulation!==undefined&&typeof ir.simulation!=='boolean') fail('simulation must be boolean');
  const {nodes,edges,inputs,outputs}=graph(ir), processes=ir.nodes.filter(n=>n.role==='process');
  if(type==='Function_Definition') {
    if(inputs.length!==1||outputs.length!==1||processes.length!==1||ir.nodes.length!==3||edges.length!==2) fail('Function_Definition requires exactly one input, one process and one output');
    if(ir.nodes.some(n=>n.parent||n.expandAt!==undefined)||edges.some(e=>e.label||e.loop)) fail('Function_Definition has no folding, edge labels, or loops');
    return;
  }
  if(PROCESS_SUMMARIES.has(type)) {
    if(inputs.length!==1||outputs.length!==1) fail('Process_Summary requires exactly one E2E input and output');
    if(processes.length<2||processes.length>3||ir.nodes.length!==processes.length+2||edges.some(e=>e.label||e.loop)||ir.nodes.some(n=>n.parent||n.expandAt!==undefined)) fail('Process_Summary requires 2..3 processes, E2E entities only, no edge labels, loops, or folding');
    refShape(ir.definition_ref,true);
    if(type==='Process_Summary_Linear') {
      if(edges.length!==processes.length+1||edges.some(e=>e.meaning!=='execution_flow')) fail('Process_Summary_Linear must be a single chain');
      for(const n of ir.nodes) if(edges.filter(e=>e.to===n.id).length!==(n.id===inputs[0]?0:1)||edges.filter(e=>e.from===n.id).length!==(n.id===outputs[0]?0:1)) fail('Process_Summary_Linear must be a single chain');
    } else {
      if(!['exclusive','parallel'].includes(ir.routing)) fail('Process_Summary_Router needs explicit routing: exclusive or parallel');
      if(!edges.some(e=>edges.filter(x=>x.from===e.from).length>1)) fail('Process_Summary_Router needs at least one branch');
      const indegree=new Map(ir.nodes.map(n=>[n.id,0])); edges.forEach(e=>indegree.set(e.to,indegree.get(e.to)+1));
      const ready=ir.nodes.filter(n=>indegree.get(n.id)===0).map(n=>n.id); let visited=0;
      while(ready.length){const id=ready.shift();visited++;for(const e of edges.filter(x=>x.from===id)){indegree.set(e.to,indegree.get(e.to)-1);if(indegree.get(e.to)===0)ready.push(e.to);}}
      if(visited!==ir.nodes.length) fail('Process_Summary_Router must be an acyclic route graph');
    }
    return;
  }
  if(type==='Process_Core') {
    refShape(ir.summary_ref,true);
    if(ir.nodes.length>9) fail('Process_Core is limited to nine source nodes');
    if(!processes.length) fail('Process_Core needs at least one process');
    if(!Array.isArray(ir.partials)||ir.partials.length!==1||!same([...ir.partials[0].nodes].sort(),ir.nodes.map(n=>n.id).sort())||!same([...ir.partials[0].edges].sort(),edges.map(e=>e.id).sort())) fail('Process_Core needs one partial membership covering every node and edge');
    return;
  }
  refShape(ir.summary_ref,false);
  if(!Array.isArray(ir.approved_partials)||ir.approved_partials.length<2||ir.approved_partials.length>3) fail('Process_Full needs two or three approved Process_Core references');
  if(!Array.isArray(ir.partials)||!ir.partials.length) fail('Process_Full needs merged Core memberships');
  if(!ir.assembly_decision_ref) fail('Process_Full needs a Human assembly decision reference');
}

function readRef(ref,baseDir,type) {
  refShape(ref,!!ref.node_id);
  const bytes=readFileSync(path.resolve(baseDir,ref.path));
  if(hash(bytes)!==ref.sha256) fail(`${type} SHA-256 mismatch`);
  const ir=JSON.parse(bytes);
  if(ir.id!==ref.id||ir.version!==ref.version||(type && ir.diagram_type!==type)) fail(`${type||'referenced'} id/version/type mismatch`);
  validateWorkflowUnit(ir);
  return ir;
}
function refDir(baseDir,ref) { return path.dirname(path.resolve(baseDir,ref.path)); }
function verifyChain(ir,baseDir,decs=[],allowSimulation=false,seen=new Set(),depth=0) {
  if(depth>3) fail('workflow reference chain exceeds supported depth');
  const key=`${ir.diagram_type}:${ir.id}@${ir.version}`;
  if(seen.has(key)) fail('workflow reference cycle');
  seen.add(key);
  if(PROCESS_SUMMARIES.has(ir.diagram_type)) {
    const f=readRef(ir.definition_ref,baseDir,'Function_Definition');
    if(!f.nodes.some(n=>n.id===ir.definition_ref.node_id&&n.role==='process')) fail('Process_Summary definition_ref must identify the Function_Definition process');
    for(const key of ['inputs','outputs']) { const a=f.nodes.find(n=>n.id===f.e2e[key][0]), b=ir.nodes.find(n=>n.id===ir.e2e[key][0]); if(a.id!==b.id||a.label!==b.label) fail(`Process_Summary must preserve Function_Definition E2E ${key} ID and label`); }
  } else if(ir.diagram_type==='Process_Core') {
    const s=readRef(ir.summary_ref,baseDir,null);
    if(!PROCESS_SUMMARIES.has(s.diagram_type)||!s.nodes.some(n=>n.id===ir.summary_ref.node_id&&n.role==='process')) fail('Process_Core summary_ref must identify a process in its exact Summary');
    const globalInputs=s.edges.filter(e=>e.to===ir.summary_ref.node_id&&s.e2e.inputs.includes(e.from)).map(e=>s.nodes.find(n=>n.id===e.from));
    const globalOutputs=s.edges.filter(e=>e.from===ir.summary_ref.node_id&&s.e2e.outputs.includes(e.to)).map(e=>s.nodes.find(n=>n.id===e.to));
    for(const n of globalInputs) if(!ir.e2e.inputs.some(id=>id===n.id&&ir.nodes.find(x=>x.id===id)?.label===n.label)) fail('Process_Core must preserve its global Summary input ID and label');
    for(const n of globalOutputs) if(!ir.e2e.outputs.some(id=>id===n.id&&ir.nodes.find(x=>x.id===id)?.label===n.label)) fail('Process_Core must preserve its global Summary output ID and label');
    verifyChain(s,refDir(baseDir,ir.summary_ref),decs,allowSimulation,seen,depth+1);
  } else if(ir.diagram_type==='Process_Full') {
    const s=readRef(ir.summary_ref,baseDir,null);
    if(!PROCESS_SUMMARIES.has(s.diagram_type)) fail('Process_Full summary_ref must identify its Summary');
    verifyChain(s,refDir(baseDir,ir.summary_ref),decs,allowSimulation,seen,depth+1);
    const refs=ir.approved_partials, ids=new Set(), covered=new Set(), cores=[];
    for(const ref of refs){
      if(ids.has(ref.id)) fail('Process_Full has duplicate Process_Core references'); ids.add(ref.id);
      const c=readRef(ref,baseDir,'Process_Core');
      if(c.summary_ref.sha256!==ir.summary_ref.sha256||c.summary_ref.id!==ir.summary_ref.id||c.summary_ref.version!==ir.summary_ref.version||c.summary_ref.node_id==null) fail('Process_Core must link to the exact Process_Full Summary');
      if(covered.has(c.summary_ref.node_id)) fail('Process_Full has multiple cores for one Summary process'); covered.add(c.summary_ref.node_id);
      const approval=human(decs,ref.decision_ref,'partial_approval',allowSimulation);
      if(!approval||approval.ir_sha256!==ref.sha256) fail('Process_Full needs Human approval for each exact Process_Core hash');
      cores.push(c);
      verifyChain(c,refDir(baseDir,ref),decs,allowSimulation,seen,depth+1);
    }
    const tasks=s.nodes.filter(n=>n.role==='process').map(n=>n.id);
    if(tasks.length!==covered.size||tasks.some(id=>!covered.has(id))) fail('Process_Full must cover every Summary process exactly once');
    const assembly=human(decs,ir.assembly_decision_ref,'assemble_full',allowSimulation), selected=refs.map(r=>r.sha256).sort();
    if(!assembly||!Array.isArray(assembly.partial_sha256)||!same([...assembly.partial_sha256].sort(),selected)) fail('Process_Full Human assembly decision must select the exact approved Core hashes');
    for(const key of ['inputs','outputs']) {
      if(!same([...ir.e2e[key]].sort(),[...s.e2e[key]].sort())) fail(`Process_Full must preserve Summary E2E ${key} IDs`);
      for(const id of s.e2e[key]) if(ir.nodes.find(n=>n.id===id)?.label!==s.nodes.find(n=>n.id===id)?.label) fail(`Process_Full must preserve Summary E2E ${key} labels`);
    }
    const sourceNodes=new Map(),sourceEdges=new Map(),sourceParts=new Map();
    for(const c of cores) {
      for(const n of c.nodes){if(sourceNodes.has(n.id)&&!same(semantic(sourceNodes.get(n.id)),semantic(n)))fail(`Process_Core node semantics conflict: ${n.id}`);sourceNodes.set(n.id,n);}
      for(const e of c.edges){if(sourceEdges.has(e.id)&&!same(semantic(sourceEdges.get(e.id)),semantic(e)))fail(`Process_Core edge semantics conflict: ${e.id}`);sourceEdges.set(e.id,e);}
      for(const p of c.partials||[]){const normalized={...p,nodes:[...p.nodes].sort(),edges:[...p.edges].sort()};if(sourceParts.has(p.id)&&!same(sourceParts.get(p.id),normalized))fail(`Process_Core partial memberships conflict: ${p.id}`);sourceParts.set(p.id,normalized);}
    }
    const fullParts=(ir.partials||[]).map(p=>({...p,nodes:[...p.nodes].sort(),edges:[...p.edges].sort()})).sort((a,b)=>a.id.localeCompare(b.id));
    const expectedParts=[...sourceParts.values()].sort((a,b)=>a.id.localeCompare(b.id));
    if(!same(fullParts,expectedParts)) fail('Process_Full partial memberships must match approved Process_Core memberships');
    if(!same([...ir.nodes.map(n=>n.id)].sort(),[...sourceNodes.keys()].sort())) fail('Process_Full nodes must be the union of approved Process_Core nodes');
    for(const [id,n] of sourceNodes) if(!same(semantic(ir.nodes.find(x=>x.id===id)),semantic(n))) fail(`Process_Full changed approved Process_Core node semantics: ${id}`);
    for(const [id,e] of sourceEdges) if(!ir.edges.some(x=>x.id===id&&same(semantic(x),semantic(e)))) fail(`Process_Full changed or omitted approved Process_Core edge: ${id}`);
    for(const c of cores) for(const [id,label] of Object.entries(c.flow||{})) if(ir.flow?.[id]!==label) fail(`Process_Full changed approved Process_Core flow data: ${id}`);
    for(const c of cores) for(const [id,label] of Object.entries(c.animation_states||{})) if(ir.animation_states?.[id]!==label) fail(`Process_Full changed approved Process_Core animation state: ${id}`);
    for(const c of cores) for(const [id,item] of Object.entries(c.legend||{})) if(!same(ir.legend?.[id],item)) fail(`Process_Full changed approved Process_Core legend: ${id}`);
    const added=ir.edges.filter(e=>!sourceEdges.has(e.id));
    if(!same((ir.connections||[]).slice().sort(),added.map(e=>e.id).sort())) fail('Process_Full connections must list exactly the added inter-Core edges');
    for(const e of added) {
      const from=cores.find(c=>c.e2e.outputs.includes(e.from)), to=cores.find(c=>c.e2e.inputs.includes(e.to));
      if(e.meaning!=='execution_flow'||!from||!to||from===to||ir.nodes.find(n=>n.id===e.from)?.role!=='entity'||ir.nodes.find(n=>n.id===e.to)?.role!=='entity'||ir.nodes.find(n=>n.id===e.from)?.label!==ir.nodes.find(n=>n.id===e.to)?.label) fail(`Process_Full connection must join matching distinct Core data boundaries: ${e.id}`);
    }
    const relations=new Set();
    for(const a of cores)for(const b of cores)if(a!==b) {
      const shared=a.e2e.outputs.some(id=>b.e2e.inputs.includes(id)), connected=added.some(e=>a.e2e.outputs.includes(e.from)&&b.e2e.inputs.includes(e.to));
      if(shared||connected)relations.add(`${a.summary_ref.node_id}->${b.summary_ref.node_id}`);
    }
    const expected=s.edges.filter(e=>s.nodes.find(n=>n.id===e.from)?.role==='process'&&s.nodes.find(n=>n.id===e.to)?.role==='process').map(e=>`${e.from}->${e.to}`);
    if(!same([...relations].sort(),expected.sort()))fail('Process_Full Core connections must reproduce the Summary process relation graph');
  }
  seen.delete(key);
}

export function workflowUnitState(ir,decs=[],baseDir='.',sourceHash=null) {
  const errors=[];
  try {
    validateWorkflowUnit(ir);
    if(ir.diagram_type==='Function_Definition') {}
    else if(PROCESS_SUMMARIES.has(ir.diagram_type)) verifyChain(ir,baseDir,decs,ir.simulation===true);
    else if(ir.diagram_type==='Process_Core') verifyChain(ir,baseDir,decs,ir.simulation===true);
    else if(ir.diagram_type==='Process_Full') verifyChain(ir,baseDir,decs,ir.simulation===true);
  } catch(e) { errors.push(e.message); }
  const approved=ir.diagram_type==='Process_Full'?ir.approved_partials||[]:[];
  const indexedCores=[];
  if(ir.diagram_type==='Process_Core'&&errors.length===0) for(const d of decs.filter(x=>x.topic==='partial_approval'&&x.subject==='Human'&&x.status==='decided')) {
    if(d.simulated&&ir.simulation!==true) continue;
    if(!d.ir_path) continue;
    try {
      const bytes=readFileSync(path.resolve(baseDir,d.ir_path));
      if(hash(bytes)!==d.ir_sha256) fail(`${d.id}: approved Process_Core SHA-256 mismatch`);
      const core=JSON.parse(bytes); validateWorkflowUnit(core);
      if(core.diagram_type!=='Process_Core'||!core.summary_ref||core.summary_ref.id!==ir.summary_ref.id||core.summary_ref.version!==ir.summary_ref.version||core.summary_ref.sha256!==ir.summary_ref.sha256) continue;
      verifyChain(core,path.dirname(path.resolve(baseDir,d.ir_path)),decs,ir.simulation===true);
      indexedCores.push({id:core.id,version:core.version,path:d.ir_path,sha256:d.ir_sha256,decision_ref:d.id,node_id:core.summary_ref.node_id});
    } catch(e) { errors.push(e.message); }
  }
  if(ir.diagram_type==='Process_Core'&&sourceHash&&decs.some(d=>human(decs,d.id,'partial_approval',ir.simulation===true)&&d.ir_sha256===sourceHash)&&!indexedCores.some(r=>r.sha256===sourceHash)) indexedCores.push({id:ir.id,version:ir.version,sha256:sourceHash,decision_ref:decs.find(d=>human(decs,d.id,'partial_approval',ir.simulation===true)&&d.ir_sha256===sourceHash)?.id,node_id:ir.summary_ref.node_id});
  const distinctCoreNodes=new Set(indexedCores.map(c=>c.node_id));
  let eligibleToPropose=false;
  if(ir.diagram_type==='Process_Core'&&errors.length===0) {
    try {const s=readRef(ir.summary_ref,baseDir,null);eligibleToPropose=distinctCoreNodes.size>=2&&distinctCoreNodes.size===s.nodes.filter(n=>n.role==='process').length;}catch{}
  }
  let l0_refs=[];
  try {
    if(ir.diagram_type==='Process_Core'&&errors.length===0) {
      const summary=readRef(ir.summary_ref,baseDir,null);
      l0_refs=[{...ir.summary_ref,partial_id:ir.id,partial:{...ir.partials[0],e2e:ir.e2e},snapshot:runtimeIr(summary),node_id:ir.summary_ref.node_id}];
    } else if(ir.diagram_type==='Process_Full'&&errors.length===0) {
      const summary=readRef(ir.summary_ref,baseDir,null);
      l0_refs=approved.map(ref=>{const core=readRef(ref,baseDir,'Process_Core');return {...core.summary_ref,partial_id:core.id,partial:{...core.partials[0],e2e:core.e2e},snapshot:runtimeIr(summary),node_id:core.summary_ref.node_id};});
    }
  } catch(e) { errors.push(e.message); }
  const currentApproved=!!sourceHash&&decs.some(d=>human(decs,d.id,'partial_approval',ir.simulation===true)&&d.ir_sha256===sourceHash);
  return {stage:ir.diagram_type,review_version:`${ir.id}@${ir.version}`,current_version_approved:currentApproved,simulation:ir.simulation===true,eligible_to_propose_full:eligibleToPropose,approved_partials:approved.map(r=>({id:r.id,version:r.version,sha256:r.sha256})),approved_cores:indexedCores,l0_refs,feedback_needed:'Review this workflow unit before proceeding to the next stage.',next_actions:errors.length?['fix_workflow_unit_errors']:ir.diagram_type==='Function_Definition'?['author_process_summary']:PROCESS_SUMMARIES.has(ir.diagram_type)?['author_process_cores']:ir.diagram_type==='Process_Core'?eligibleToPropose?['propose_process_full_to_human']:['review_and_approve_core','author_next_core']:['review_full'],errors};
}

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { UNIT_TYPES, isWorkflowUnit, validateWorkflowUnit, workflowUnitState } from './workflow-units.mjs';

export const TYPES = ['l0_summary', 'l1_partial', 'l1_full'];
export { UNIT_TYPES };
const hash = b => createHash('sha256').update(b).digest('hex');
const canonical = x => JSON.stringify(normalize(x));
function normalize(x) {
  if (Array.isArray(x)) return x.map(normalize);
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map(k => [k, normalize(x[k])]));
  return x;
}
// Only geometry and presentation may change when assembling approved content.
const layout = new Set(['x','y','w','h','pos','route','busX','midY','sdx','tdx','bend','labelAt']);
function meaning(x) { return Object.fromEntries(Object.entries(x).filter(([k]) => !layout.has(k))); }
function validateL0Ref(ref, partial) {
  if (!ref || typeof ref.node_id !== 'string' || !ref.node_id || !ref.snapshot) throw Error('l0_ref needs node_id and snapshot');
  validateWorkflow(ref.snapshot);
  if (ref.snapshot.diagram_type !== 'l0_summary') throw Error('l0_ref snapshot must be l0_summary');
  const task = ref.snapshot.nodes.find(n => n.id === ref.node_id);
  if (!task || task.role !== 'process') throw Error('l0_ref.node_id must resolve to the L0 Task');
  for (const key of ['inputs','outputs']) if (partial.e2e[key].some(id => partial.nodes.find(n => n.id === id)?.role !== 'entity')) throw Error(`partial E2E ${key} must be entity nodes`);
  const reaches = (start, target) => { const seen = new Set([start]), todo = [start]; while (todo.length) { const at=todo.pop(); if (at===target) return true; partial.edges.filter(e=>e.from===at&&e.meaning==='execution_flow'&&!e.loop).forEach(e=>{if(!seen.has(e.to)){seen.add(e.to);todo.push(e.to);}}); } return false; };
  const hasTaskPath = (input,output) => partial.nodes.some(n => n.role === 'process' && reaches(input,n.id) && reaches(n.id,output));
  if (partial.e2e.inputs.some(input => !partial.e2e.outputs.some(output => hasTaskPath(input,output))) ||
      partial.e2e.outputs.some(output => !partial.e2e.inputs.some(input => hasTaskPath(input,output)))) throw Error('l0_ref Task must summarize connected partial input-to-Task-to-output flow');
}
function human(decs, ref, topic) {
  return decs.find(d => d.id === ref && d.subject === 'Human' && d.status === 'decided' &&
    d.topic === topic && typeof d.answer === 'string' && d.answer.trim() && d.answered_at);
}
export function validateWorkflow(ir) {
  if (!ir.diagram_type) return;
  if (ir.workflow_unit && ir.workflow_unit !== ir.diagram_type) throw Error('workflow_unit metadata must match the actual diagram_type');
  if (isWorkflowUnit(ir)) { validateWorkflowUnit(ir); return; }
  if (!TYPES.includes(ir.diagram_type)) throw Error('unknown diagram_type');
  if (typeof ir.id !== 'string' || !ir.id || typeof ir.version !== 'string' || !ir.version) throw Error('typed IR needs id and version');
  if (!ir.flow || typeof ir.flow !== 'object' || Array.isArray(ir.flow)) throw Error('flow must be an object');
  if (ir.approved_partials !== undefined && !Array.isArray(ir.approved_partials)) throw Error('approved_partials must be an array');
  for (const key of ['nodes','edges']) {
    const ids = ir[key].map(x => x.id);
    if (ids.some(x => typeof x !== 'string' || !x || !/^[A-Za-z0-9_.:-]+$/.test(x)) || new Set(ids).size !== ids.length) throw Error(`${key} need unique safe ids`);
  }
  const nodes = new Map(ir.nodes.map(n => [n.id,n])), edges = new Map(ir.edges.map(e => [e.id,e]));
  if (ir.edges.some(e => !nodes.has(e.from) || !nodes.has(e.to))) throw Error('unknown edge endpoint');
  if (ir.edges.some(e => !['execution_flow','whole_part','goal_means','is_a'].includes(e.meaning))) throw Error('unknown edge meaning');
  const ids = (xs, map, name) => { if (!Array.isArray(xs) || !xs.length || new Set(xs).size !== xs.length || xs.some(id => !map.has(id))) throw Error(`invalid ${name}`); };
  ids(ir.e2e?.inputs, nodes, 'e2e.inputs'); ids(ir.e2e?.outputs, nodes, 'e2e.outputs');
  if ([...ir.e2e.inputs,...ir.e2e.outputs].some(id => nodes.get(id).role !== 'entity')) throw Error('E2E endpoints must be entities');
  if (ir.e2e.inputs.some(id => ir.edges.some(e => e.to === id && !e.loop))) throw Error('E2E inputs must be initial inputs');
  if (ir.e2e.inputs.some(id => ir.e2e.outputs.includes(id))) throw Error('E2E input/output must differ');
  for (const n of ir.nodes) {
    if (!['entity','process'].includes(n.role) || typeof n.label !== 'string' || !n.label) throw Error('nodes need role and label');
    if (['x','y','w','h'].some(k => n[k] !== undefined && !Number.isFinite(n[k]))) throw Error('node geometry must be finite');
    if (n.pos && (!Object.keys(n.pos).length || Object.values(n.pos).some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v))))) throw Error('pos must contain coordinate pairs');
    if (ir.diagram_type !== 'l0_summary' && !n.pos && n.expandAt === undefined && (!Number.isFinite(n.x) || !Number.isFinite(n.y))) throw Error('partial/full nodes need layout coordinates');
    const seen = new Set([n.id]); let p = n.parent;
    while (p) { if (!nodes.has(p) || seen.has(p)) throw Error('invalid or cyclic parent'); seen.add(p); p = nodes.get(p).parent; }
  }
  if (ir.diagram_type === 'l0_summary') {
    const task = ir.nodes.filter(n => n.role === 'process');
    if (!task.length || ir.nodes.length !== task.length + 2 || ir.e2e.inputs.length !== 1 || ir.e2e.outputs.length !== 1 || ir.edges.length !== ir.nodes.length - 1) throw Error('L0 requires one input -> core Tasks -> one output');
    const chain = new Set(); let at = ir.e2e.inputs[0];
    while (at && !chain.has(at)) {
      chain.add(at); const next = ir.edges.filter(e => e.from === at);
      if (next.length > 1 || next.some(e => e.meaning !== 'execution_flow' || e.loop)) throw Error('L0 requires a connected core Task chain');
      if (!next.length && at !== ir.e2e.outputs[0]) throw Error('L0 chain must end at its output');
      at = next[0]?.to;
    }
    if (at || chain.size !== ir.nodes.length) throw Error('L0 requires a connected core Task chain');
    if (ir.nodes.some(n => n.parent || n.expandAt !== undefined)) throw Error('L0 has no folding');
  } else {
    if (!Array.isArray(ir.partials) || !ir.partials.length) throw Error('partials are required');
    const pids = ir.partials.map(p => p.id);
    if (new Set(pids).size !== pids.length || pids.some(id => typeof id !== 'string' || !id)) throw Error('partial ids must be unique');
    if (ir.diagram_type === 'l1_partial' && ir.partials.length !== 1) throw Error('l1_partial describes exactly one partial');
    for (const p of ir.partials) { ids(p.nodes,nodes,'partial nodes'); ids(p.edges,edges,'partial edges');
      if (p.edges.some(id => !p.nodes.includes(edges.get(id).from) || !p.nodes.includes(edges.get(id).to))) throw Error('partial edge endpoints must belong to partial');
    }
    if (ir.diagram_type === 'l1_partial' && ir.l0_ref) validateL0Ref(ir.l0_ref, ir);
    if (ir.diagram_type === 'l1_full' && ir.l0_refs !== undefined) {
      if (!Array.isArray(ir.l0_refs)) throw Error('l0_refs must be an array');
      ir.l0_refs.forEach(ref => {
        if (typeof ref.partial_id !== 'string' || !ref.partial_id) throw Error('full l0_refs need partial_id');
        if (!ref.partial || typeof ref.partial.id !== 'string' || !Array.isArray(ref.partial.nodes) || !Array.isArray(ref.partial.edges)) throw Error('full l0_refs need the approved partial membership');
        const membership={...ref.partial,nodes:ref.partial.nodes.map(id=>ir.nodes.find(n=>n.id===id)).filter(Boolean),edges:ref.partial.edges.map(id=>ir.edges.find(e=>e.id===id)).filter(Boolean)};
        membership.e2e={inputs:membership.nodes.filter(n=>n.role==='entity'&&!membership.edges.some(e=>e.to===n.id)).map(n=>n.id),outputs:membership.nodes.filter(n=>n.role==='entity'&&!membership.edges.some(e=>e.from===n.id)).map(n=>n.id)};
        validateL0Ref(ref,membership);
      });
      if (new Set(ir.l0_refs.map(ref => ref.partial_id)).size !== ir.l0_refs.length) throw Error('full l0_refs must have unique partial_id values');
      const labelByNode = new Map();
      ir.l0_refs.forEach(ref => {
        const label = ref.snapshot.nodes.find(n => n.id === ref.node_id)?.label;
        if (labelByNode.has(ref.node_id) && labelByNode.get(ref.node_id) !== label) throw Error(`conflicting L0 labels for node_id: ${ref.node_id}`);
        labelByNode.set(ref.node_id,label);
      });
    }
  }
  // Each flow edge carries explicit data. This avoids guessing transformation labels from traversal order.
  for (const e of ir.edges) if (e.meaning === 'execution_flow' && (typeof ir.flow?.[e.id] !== 'string' || !ir.flow[e.id].trim())) throw Error(`flow.${e.id} must name the carried data/artifact`);
  if (Object.keys(ir.flow || {}).some(id => !edges.has(id))) throw Error('flow references unknown edge');
  const visiting = new Set(), visited = new Set();
  function visit(id) { if (visiting.has(id)) throw Error('flow cycles must be marked loop'); if (visited.has(id)) return; visiting.add(id); ir.edges.filter(e => e.from === id && e.meaning === 'execution_flow' && !e.loop).forEach(e => visit(e.to)); visiting.delete(id); visited.add(id); }
  ir.nodes.forEach(n => visit(n.id));
}

export function workflowState(ir, decs, baseDir, sourceHash = null) {
  if (!ir.diagram_type) return null;
  if (isWorkflowUnit(ir)) return workflowUnitState(ir,decs,baseDir,sourceHash);
  validateWorkflow(ir);
  const approved = [], errors = [];
  const refs = ir.approved_partials ? [...ir.approved_partials] : [];
  const unindexed = [];
  // The separate decision file indexes snapshots without modifying their approved bytes.
  if (!ir.approved_partials) for (const d of decs.filter(d => human(decs,d.id,'partial_approval'))) {
    if (!d.ir_path) { unindexed.push(d.id); continue; }
    try { const p = JSON.parse(readFileSync(path.resolve(baseDir,d.ir_path),'utf8')); refs.push({id:p.id,version:p.version,path:d.ir_path,sha256:d.ir_sha256,decision_ref:d.id}); }
    catch(e) { errors.push(`${d.id}: cannot index approved snapshot: ${e.message}`); }
  }
  for (const ref of refs) {
    try {
      const bytes = readFileSync(path.resolve(baseDir, ref.path));
      if (hash(bytes) !== ref.sha256) throw Error('snapshot SHA-256 mismatch');
      const p = JSON.parse(bytes); validateWorkflow(p);
      if (p.diagram_type !== 'l1_partial' || p.id !== ref.id || p.version !== ref.version) throw Error('snapshot id/version/type mismatch');
      const d = human(decs, ref.decision_ref, 'partial_approval');
      if (!d || d.ir_sha256 !== ref.sha256) throw Error('Human approval must reference exact snapshot hash');
      approved.push({ ref, ir:p });
    } catch (e) { errors.push(`${ref.id}: ${e.message}`); }
  }
  const distinctCount = new Set(approved.map(p => p.ref.id)).size;
  if (ir.diagram_type === 'l1_full' && distinctCount !== approved.length) errors.push('duplicate approved partial');
  const eligible = distinctCount >= 2 && !errors.length;
  if (ir.diagram_type === 'l1_full') {
    if (!eligible) errors.push('l1_full needs at least two distinct approved partials');
    const decision = human(decs, ir.assembly_decision_ref, 'assemble_full');
    const hashes = approved.map(p => p.ref.sha256).sort();
    if (!decision || !Array.isArray(decision.partial_sha256) || canonical([...decision.partial_sha256].sort()) !== canonical(hashes)) errors.push('Human assembly decision must select the exact approved snapshots');
    const coveredNodes = new Set(), coveredEdges = new Set();
    for (const { ir:p } of approved) {
      for (const key of ['nodes','edges']) for (const item of p[key]) {
        const actual = ir[key].find(x => x.id === item.id);
        if (!actual || canonical(meaning(actual)) !== canonical(meaning(item))) errors.push(`approved ${key} changed/missing: ${p.id}/${item.id}`);
        (key === 'nodes' ? coveredNodes : coveredEdges).add(item.id);
      }
      for (const part of p.partials) if (!ir.partials.some(x => canonical(x) === canonical(part))) errors.push(`partial membership changed: ${part.id}`);
      for (const [id,label] of Object.entries(p.flow || {})) if (ir.flow?.[id] !== label) errors.push(`approved flow changed: ${id}`);
      for (const [id,entry] of Object.entries(p.legend || {})) if (canonical(ir.legend?.[id]) !== canonical(entry)) errors.push(`approved legend changed: ${id}`);
    }
    const linked = approved.filter(p => p.ir.l0_ref).map(p => p.ir.l0_ref);
    if (linked.length && linked.length !== approved.length) errors.push('all approved partials must use an L0 reference to enable full auto-folding');
    if (linked.length) {
      const labels = new Map();
      for (const ref of linked) {
        const label = ref.snapshot.nodes.find(n => n.id === ref.node_id)?.label;
        if (labels.has(ref.node_id) && labels.get(ref.node_id) !== label) errors.push(`conflicting L0 labels for node_id: ${ref.node_id}`);
        labels.set(ref.node_id,label);
      }
      if (ir.l0_refs !== undefined) {
        const expected = approved.filter(p => p.ir.l0_ref).map(p => ({...p.ir.l0_ref,partial_id:p.ir.id,partial:{...p.ir.partials[0],e2e:p.ir.e2e}})).sort((a,b) => a.partial_id.localeCompare(b.partial_id));
        const actual = [...ir.l0_refs].sort((a,b) => a.partial_id.localeCompare(b.partial_id));
        if (canonical(actual) !== canonical(expected)) errors.push('full l0_refs must match the exact approved partial references');
      }
    }
    if (ir.nodes.some(n => !coveredNodes.has(n.id))) errors.push('new semantic nodes require partial approval; the runtime adds non-semantic animation tokens');
    const connections = ir.connections || [];
    if (ir.edges.some(e => !coveredEdges.has(e.id) && !connections.includes(e.id))) errors.push('new inter-partial edges must be listed in connections');
    if (connections.some(id => !ir.edges.some(e => e.id === id))) errors.push('unknown connection');
    for (const e of ir.edges.filter(e => !coveredEdges.has(e.id))) {
      const from = approved.filter(p => p.ir.e2e.outputs.includes(e.from));
      const to = approved.filter(p => p.ir.e2e.inputs.includes(e.to));
      const sharesPartial = approved.some(p => p.ir.partials.some(s => s.nodes.includes(e.from) && s.nodes.includes(e.to)));
      if (e.meaning !== 'execution_flow' || sharesPartial || !from.some(a => to.some(b => a.ref.id !== b.ref.id))) errors.push(`connection must join distinct approved output/input boundaries: ${e.id}`);
    }
    const expected = approved.flatMap(p => p.ir.partials.map(x => x.id)).sort();
    if (canonical(ir.partials.map(p => p.id).sort()) !== canonical(expected)) errors.push('full partial list must match approved snapshots');
    for (const key of ['inputs','outputs']) {
      const endpoints = new Set(approved.flatMap(p => p.ir.e2e[key]));
      const external = [...endpoints].filter(id => !ir.edges.some(e => !e.loop && e.meaning === 'execution_flow' && (key === 'inputs' ? e.to : e.from) === id)).sort();
      if (canonical([...ir.e2e[key]].sort()) !== canonical(external)) errors.push(`full E2E ${key} must preserve every approved endpoint not internalized by a connection`);
    }
  }
  const currentApproved = !!sourceHash && decs.some(d => human(decs,d.id,'partial_approval') && d.ir_sha256 === sourceHash);
  const l0Refs = ir.diagram_type === 'l1_partial' && ir.l0_ref ? [{...ir.l0_ref,partial_id:ir.id,partial:{...ir.partials[0],e2e:ir.e2e}}] :
    ir.diagram_type === 'l1_full' && approved.length && approved.every(p => p.ir.l0_ref) ? approved.map(p => ({...p.ir.l0_ref,partial_id:p.ir.id,partial:{...p.ir.partials[0],e2e:p.ir.e2e}})) : [];
  return { stage: ir.diagram_type, review_version: `${ir.id}@${ir.version}`, current_version_approved:currentApproved, unindexed_approvals:unindexed, eligible_to_propose_full: eligible, l0_refs:l0Refs,
    approved_partials: approved.map(p => ({id:p.ref.id,version:p.ref.version,sha256:p.ref.sha256})), connections_for_review:ir.connections || [],
    feedback_needed: ir.diagram_type === 'l1_full' ? 'Review assembly connections, layout and interaction; no new approval gate implied.' : currentApproved ? 'This version has a recorded approval. Propose assembly when enough indexed approvals exist.' : 'Review this version before recording Human approval.',
    next_actions: unindexed.length ? ['add_ir_path_to_approval_records'] : eligible && ir.diagram_type !== 'l1_full' ? ['propose_full_to_human','continue_partial_review'] : ir.diagram_type === 'l0_summary' ? ['request_feedback','author_l1_partial'] : currentApproved ? ['author_next_partial'] : ['request_feedback'], errors };
}

export function context(type = 'Function_Definition') {
  if (!type) type='Function_Definition';
  if (UNIT_TYPES.includes(type)) return {diagram_type:type,default_level:['Function_Definition','Process_Summary_Linear','Process_Summary_Router'].includes(type)?0:1,
    guidance:Object.fromEntries(['references/workflow-units.md','references/expression-rules.md','relation_types/execution_flow.md'].map(p=>[p,readFileSync(new URL('../../'+p,import.meta.url),'utf8')])),
    workflow:'Function_Definition -> Process_Summary_Linear or Process_Summary_Router -> one Process_Core per Summary process -> Process_Full after every Core is approved.',
    selection:'The JSON diagram_type is authoritative and must equal the stage being authored. Do not use workflow_unit metadata to bypass validation.',
    flow:'Every execution_flow edge ID needs a nonempty data/artifact label in flow, including Function and Summary. These labels describe carried data, not token states, and are not visible edge labels in static types.',
    animation_states:'For new animated Full diagrams, supply animation_states: edge ID -> concise state or artifact type after the preceding transformation (e.g. received, classified, normalized, draft, delivered). Do not copy input text as token labels. Cover every execution edge; unchanged transfers retain the same state. Semantic quality requires image/Human review. Older inputs without animation_states fall back to flow. Each token edge lasts 1800 ms; Hover changes cancel immediately.',
    layout:'Function and Summary have automatic layout. Core and Full nodes need finite x/y coordinates or pos coordinates. Omitted canvas w/h is derived from node positions; explicit canvas dimensions are retained and checked.',
    units:{Function_Definition:'Exactly one E2E input, one process, one E2E output. No internal data entities.',Process_Summary_Linear:'One E2E input/output, 2..3 process nodes in one chain. No intermediate entities or edge labels.',Process_Summary_Router:'One E2E input/output, 2..3 process nodes in a routed DAG. routing is explicitly exclusive or parallel.',Process_Core:'One expanded Summary process, at most nine source nodes, multiple E2E boundaries allowed. Keep existing node IDs; author exactly one partial membership covering its nodes and edges.',Process_Full:'Merge 2..3 distinct approved Cores, one for each Summary process. Preserve semantic nodes/edges and add only reviewed connections; Full E2E IDs and labels match the Summary.'},
    references:{relativePaths:'Each path is relative to the IR file that contains the reference. SHA-256 covers the exact referenced file bytes. Nested references resolve from their own parent IR directory.',definition_ref:{required:['path','id','version','sha256','node_id'],meaning:'Summary points to the exact Function_Definition process node.'},summary_ref_core:{required:['path','id','version','sha256','node_id'],meaning:'Core points to the exact Summary process node; node_id is the stable key, no process_node_id copy.'},summary_ref_full:{required:['path','id','version','sha256'],meaning:'Full points to the exact Summary.'},approved_partials:{required:['id','version','path','sha256','decision_ref'],meaning:'Each entry points to an exact Human-approved Process_Core. Its summary_ref.node_id identifies the covered Summary process.'}},
    review:{humanApproval:'Only a Human decision bound to the exact Core SHA counts. Assembly decision partial_sha256 must equal the selected Core hashes.',simulation:'Synthetic Human decisions are accepted only when the root IR has simulation:true; workflow state reports simulation:true.'},
    runtime:{mapping:{Function_Definition:'l0_summary',Process_Summary_Linear:'l0_summary',Process_Summary_Router:'l0_summary',Process_Core:'l1_partial',Process_Full:'l1_full'},fold:'Core and Full renderer receives verified Summary snapshot refs. Function and Summary stay static; Core/Full use the existing folding and interaction engine.'},
    schema:'Use drd schema <diagram_type>; for example: drd schema Process_Summary_Linear.',
    required:['id','version','diagram_type','nodes','edges','e2e','flow']};
  if (!TYPES.includes(type)) throw Error('unknown diagram_type');
  return { diagram_type:type, default_level:type === 'l0_summary' ? 0 : 1,
    guidance: Object.fromEntries(['references/expression-rules.md', 'relation_types/execution_flow.md', 'references/workflow.md'].map(p => [p,readFileSync(new URL('../../'+p,import.meta.url),'utf8')])),
    workflow:'l0_summary -> author/review l1_partial -> propose l1_full with >=2 approved partials -> Human selects assembly. L2 only on request.',
    presentation:'Folding starts at l1_partial. Abstraction depth, emphasis, and diagram_type are independent. L0 has no dimming. Full has no nine-node limit.',
    interaction:'Hover union of approved partial memberships plus related E2E input/output endpoints; intermediate nodes of other partials stay dimmed. Only l1_full has token animation: initial E2E input Hover/focus starts it and leaving stops immediately. No Play or Stop buttons; separate playback controls are reserved for example animations. L0 and l1_partial have no animation.',
    contract: {required:['id','version','diagram_type','nodes','edges','e2e','flow'], partial_required:['partials'], full_required:['partials','approved_partials','assembly_decision_ref'],
      partial:{id:'scope-id',nodes:['node-id'],edges:['edge-id']}, approved_partial:{id:'partial-id',version:'1',path:'partial.json',sha256:'64 hex chars',decision_ref:'human-response-id'},
      l0_ref:{node_id:'stable-l0-task-id',snapshot:'complete l0_summary IR'},
      decisions:{partial_approval:['id','topic=partial_approval','subject=Human','status=decided','answer','answered_at','ir_sha256','ir_path (absolute or relative to current IR)'],assemble_full:['id','topic=assemble_full','subject=Human','status=decided','answer','answered_at','partial_sha256']},
      flow:'Object mapping execution_flow edge ids to data/artifact labels; Task output labels may differ from input labels.'} };
}

export function schema(type = 'Function_Definition') {
  if (UNIT_TYPES.includes(type)) {
    const s=JSON.parse(readFileSync(new URL('../../references/workflow-units.schema.json',import.meta.url),'utf8'));
    const schemaName={Function_Definition:'functionDefinition',Process_Summary_Linear:'processSummaryLinear',Process_Summary_Router:'processSummaryRouter',Process_Core:'processCore',Process_Full:'processFull'}[type];
    s.oneOf=[{$ref:`#/$defs/${schemaName}`}]; s.properties={...(s.properties||{}),diagram_type:{const:type}}; return s;
  }
  if (!TYPES.includes(type)) throw Error('unknown diagram_type');
  const s = JSON.parse(readFileSync(new URL('../../references/workflow.schema.json',import.meta.url),'utf8'));
  s.properties.diagram_type = {const:type}; return s;
}

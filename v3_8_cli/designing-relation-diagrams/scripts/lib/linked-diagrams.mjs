import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { validateWorkflowUnit, workflowUnitState } from './workflow-units.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };
const clone = value => structuredClone(value);
const refShape = (ref,withNode=false) => {
  const required=['path','id','version','sha256',...(withNode?['node_id']:[])];
  if (!ref || required.some(key=>typeof ref[key]!=='string'||!ref[key]) || !/^[a-f0-9]{64}$/.test(ref.sha256)) fail(`linked diagram reference needs ${required.join(', ')}`);
};
function readExact(ref,baseDir,type,withNode=false) {
  refShape(ref,withNode);
  const bytes=readFileSync(path.resolve(baseDir,ref.path));
  if(sha256(bytes)!==ref.sha256) fail(`linked diagram ${type} SHA-256 mismatch`);
  let ir;
  try { ir=JSON.parse(bytes); } catch { fail(`linked diagram ${type} is not valid JSON`); }
  if(ir.id!==ref.id||ir.version!==ref.version||(type&&ir.diagram_type!==type)) fail(`linked diagram ${type||'reference'} id/version/type mismatch`);
  validateWorkflowUnit(ir);
  return {ir,bytes,absolutePath:path.resolve(baseDir,ref.path)};
}
function decisionFor(decs,id,fullHash,nodeId,allowSimulation) {
  const decision=decs.find(d=>d.id===id&&d.topic==='linked_diagram_approval'&&d.subject==='Human'&&d.status==='decided'&&typeof d.answer==='string'&&d.answer.trim()&&d.answered_at&&d.ir_sha256===fullHash&&d.parent_node_id===nodeId&&(!d.simulated||allowSimulation));
  if(!decision) fail(`linked diagram needs Human approval for exact Full hash and parent node: ${nodeId}`);
  return decision;
}
function localId(targetId,sourceId) { return `__link_${targetId.length}_${targetId}_${sourceId.length}_${sourceId}`; }
function translated(value,delta) { return Number.isFinite(value)?value+delta:value; }

function verifyLink(parent,link,baseDir,decs) {
  if(!link||typeof link!=='object'||Array.isArray(link)) fail('linked_diagrams entries must be objects');
  if(typeof link.node_id!=='string'||!link.node_id||typeof link.decision_ref!=='string'||!link.decision_ref) fail('linked diagram needs node_id and decision_ref');
  const target=parent.nodes.find(n=>n.id===link.node_id);
  if(!target||target.role!=='process') fail(`linked diagram target must be an existing process node: ${link.node_id}`);
  const memberships=(parent.partials||[]).filter(p=>Array.isArray(p.nodes)&&p.nodes.includes(target.id));
  if(memberships.length!==1) fail(`linked diagram target must belong to exactly one parent partial: ${target.id}`);
  const ownerPartial=memberships[0];
  const incoming=parent.edges.filter(e=>e.to===target.id).map(e=>parent.nodes.find(n=>n.id===e.from));
  const outgoing=parent.edges.filter(e=>e.from===target.id).map(e=>parent.nodes.find(n=>n.id===e.to));
  if(!incoming.length||!outgoing.length||incoming.some(n=>n?.role!=='entity')||outgoing.some(n=>n?.role!=='entity')) fail(`linked diagram target needs adjacent entity input and output boundaries: ${target.id}`);

  const functionRef=readExact(link.definition_ref,baseDir,'Function_Definition',true);
  const fn=functionRef.ir, functionProcess=fn.nodes.find(n=>n.id===link.definition_ref.node_id);
  if(!functionProcess||functionProcess.role!=='process'||functionProcess.label!==target.label) fail(`linked diagram Function process must match parent target label: ${target.id}`);
  const childFullRef=readExact(link.full_ref,baseDir,'Process_Full');
  const child=childFullRef.ir;
  if(child.linked_diagrams!==undefined&&(!Array.isArray(child.linked_diagrams)||child.linked_diagrams.length)) fail('linked diagrams cannot contain a second nested linked-diagram level');
  if(child.simulation===true&&parent.simulation!==true) fail('simulated linked child is allowed only when the root Full is simulated');
  const summaryRef=child.summary_ref;
  const summaryFile=readExact(summaryRef,path.dirname(childFullRef.absolutePath),null);
  const childDefinition=summaryFile.ir.definition_ref;
  refShape(childDefinition,true);
  if(childDefinition.id!==link.definition_ref.id||childDefinition.version!==link.definition_ref.version||childDefinition.sha256!==link.definition_ref.sha256||childDefinition.node_id!==link.definition_ref.node_id||path.resolve(path.dirname(summaryFile.absolutePath),childDefinition.path)!==path.resolve(baseDir,link.definition_ref.path)) fail('linked diagram Function reference must match the Function in its Full -> Summary chain');
  const childFunctionFile=readExact(childDefinition,path.dirname(summaryFile.absolutePath),'Function_Definition',true);
  if(childFunctionFile.ir.nodes.find(n=>n.id===childDefinition.node_id)?.label!==target.label) fail(`linked diagram Function process must match parent target label: ${target.id}`);

  const allowedDecisions=decs.filter(d=>!d.simulated||parent.simulation===true);
  const childState=workflowUnitState({...child,simulation:parent.simulation===true},allowedDecisions,path.dirname(childFullRef.absolutePath),sha256(childFullRef.bytes));
  if(childState.errors.length) fail(`linked diagram child Full is invalid: ${childState.errors.join('; ')}`);
  decisionFor(decs,link.decision_ref,link.full_ref.sha256,target.id,parent.simulation===true);

  const childBoundary=[...child.e2e.inputs,...child.e2e.outputs];
  const mapping=link.boundary_map;
  if(!mapping||typeof mapping!=='object'||Array.isArray(mapping)||Object.keys(mapping).length!==childBoundary.length||Object.keys(mapping).some(id=>!childBoundary.includes(id))) fail(`linked diagram boundary_map must cover every child E2E endpoint exactly: ${target.id}`);
  const expectedInputs=new Set(incoming.map(n=>n.id)), expectedOutputs=new Set(outgoing.map(n=>n.id));
  const mappedInputs=[],mappedOutputs=[];
  for(const childId of child.e2e.inputs) {
    const mapped=parent.nodes.find(n=>n.id===mapping[childId]);
    const source=child.nodes.find(n=>n.id===childId);
    if(!mapped||mapped.role!=='entity'||source?.role!=='entity'||mapped.label!==source.label) fail(`linked diagram input boundary must map to an adjacent parent entity with the same role and label: ${childId}`);
    mappedInputs.push(mapped.id);
  }
  for(const childId of child.e2e.outputs) {
    const mapped=parent.nodes.find(n=>n.id===mapping[childId]);
    const source=child.nodes.find(n=>n.id===childId);
    if(!mapped||mapped.role!=='entity'||source?.role!=='entity'||mapped.label!==source.label) fail(`linked diagram output boundary must map to an adjacent parent entity with the same role and label: ${childId}`);
    mappedOutputs.push(mapped.id);
  }
  if(mappedInputs.length!==expectedInputs.size||mappedInputs.some(id=>!expectedInputs.has(id))||mappedOutputs.length!==expectedOutputs.size||mappedOutputs.some(id=>!expectedOutputs.has(id))) fail(`linked diagram boundaries must map exactly to the parent target's adjacent entities: ${target.id}`);
  if(new Set(mappedInputs).size!==mappedInputs.length||new Set(mappedOutputs).size!==mappedOutputs.length) fail(`linked diagram boundary_map cannot collapse distinct child endpoints onto one parent entity: ${target.id}`);
  return {link,target,ownerPartial,child,childFullRef,functionFile:functionRef.ir,childFullDir:path.dirname(childFullRef.absolutePath),mapping};
}

/**
 * Build a presentation-only clone of a Process_Full with one-level approved linked diagrams.
 * Paths in linked_diagrams refs are relative to baseDir (the parent Full's directory).
 */
export function composeLinkedDiagrams(ir,baseDir='.',decs=[]) {
  if(ir?.diagram_type!=='Process_Full') fail('linked diagram composition requires Process_Full');
  const parentState=workflowUnitState(ir,decs,baseDir);
  if(parentState.errors.length) fail(`parent Full is invalid: ${parentState.errors.join('; ')}`);
  const links=ir.linked_diagrams||[];
  if(!Array.isArray(links)) fail('linked_diagrams must be an array');
  if(!links.length) return clone(ir);
  const targets=new Set();
  const verified=links.map(link=>{
    if(targets.has(link?.node_id)) fail(`linked diagram target appears more than once: ${link.node_id}`);
    targets.add(link?.node_id);
    return verifyLink(ir,link,baseDir,decs);
  });
  const out=clone(ir), rootRefs=clone(parentState.l0_refs||[]);
  for(const item of verified) {
    const {link,target,ownerPartial,child,childFullRef,mapping}=item;
    const targetNode=out.nodes.find(n=>n.id===target.id);
    targetNode.expandAt=2; targetNode.drawRegion=false; targetNode.linked_detail=true; targetNode.source='human'; targetNode.decision_ref=link.decision_ref;
    const childNodeIds=new Map(), childEdgeIds=new Map(), childPartialIds=new Map();
    child.nodes.filter(n=>!n.autoFold&&!Object.hasOwn(mapping,n.id)).forEach(n=>childNodeIds.set(n.id,localId(target.id,n.id)));
    child.edges.forEach(e=>childEdgeIds.set(e.id,localId(target.id,e.id)));
    (child.partials||[]).forEach(p=>childPartialIds.set(p.id,localId(target.id,p.id)));
    const existingNodeIds=new Set(out.nodes.map(n=>n.id)), existingEdgeIds=new Set(out.edges.map(e=>e.id)), existingPartialIds=new Set(out.partials.map(p=>p.id));
    if([...childNodeIds.values()].some(id=>existingNodeIds.has(id))||[...childEdgeIds.values()].some(id=>existingEdgeIds.has(id))||[...childPartialIds.values()].some(id=>existingPartialIds.has(id))) fail(`linked diagram generated IDs collide with parent IDs: ${target.id}`);

    // Anchor the imported layout to its mapped input endpoint while preserving all relative geometry.
    const childInput=child.e2e.inputs[0], parentInput=out.nodes.find(n=>n.id===mapping[childInput]);
    const sourceInput=child.nodes.find(n=>n.id===childInput);
    const dx=(Number.isFinite(parentInput?.x)&&Number.isFinite(sourceInput?.x))?parentInput.x-sourceInput.x:0;
    const dy=(Number.isFinite(parentInput?.y)&&Number.isFinite(sourceInput?.y))?parentInput.y-sourceInput.y:0;
    child.nodes.filter(n=>childNodeIds.has(n.id)).forEach(n=>{
      const copy=clone(n); copy.id=childNodeIds.get(n.id);
      copy.parent=n.parent&&childNodeIds.has(n.parent)?childNodeIds.get(n.parent):target.id;
      if(Number.isFinite(copy.x)) copy.x=translated(copy.x,dx);
      if(Number.isFinite(copy.y)) copy.y=translated(copy.y,dy);
      if(copy.pos) for(const [level,point] of Object.entries(copy.pos)) copy.pos[level]=[translated(point[0],dx),translated(point[1],dy)];
      out.nodes.push(copy);
    });
    const replacedEdges=out.edges.filter(e=>e.from===target.id||e.to===target.id).map(e=>e.id);
    out.edges=out.edges.filter(e=>e.from!==target.id&&e.to!==target.id);
    for(const e of child.edges) {
      const copy=clone(e); copy.id=childEdgeIds.get(e.id);
      copy.from=mapping[e.from]||childNodeIds.get(e.from);
      copy.to=mapping[e.to]||childNodeIds.get(e.to);
      if(!copy.from||!copy.to) fail(`linked diagram edge has an unmapped endpoint: ${e.id}`);
      out.edges.push(copy);
      if(out.flow) out.flow[copy.id]=child.flow[e.id];
      if(child.animation_states?.[e.id]) { out.animation_states ||= {}; out.animation_states[copy.id]=child.animation_states[e.id]; }
    }
    if(child.legend) {
      out.legend ||= {};
      for(const [key,value] of Object.entries(child.legend)) {
        if(out.legend[key]&&JSON.stringify(out.legend[key])!==JSON.stringify(value)) fail(`linked diagram legend conflicts with parent key: ${key}`);
        out.legend[key]=clone(value);
      }
    }
    // Source Full flow/animation records for replaced target edges remain in source files only.
    if(out.flow) for(const e of ir.edges.filter(e=>e.from===target.id||e.to===target.id)) delete out.flow[e.id];
    if(out.animation_states) for(const e of ir.edges.filter(e=>e.from===target.id||e.to===target.id)) delete out.animation_states[e.id];
    for(const partial of child.partials||[]) {
      out.partials.push({...clone(partial),id:childPartialIds.get(partial.id),
        nodes:partial.nodes.map(id=>mapping[id]||childNodeIds.get(id)).filter(Boolean),
        edges:partial.edges.map(id=>childEdgeIds.get(id)),scope_depth:1,owner_node:target.id,parent_partial_id:ownerPartial.id});
    }
    // Extend the owning Core scope with imported details. A child scope points back
    // to this partial, so Hover can suppress only this ancestor while retaining peers.
    const presentationOwner=out.partials.find(partial=>partial.id===ownerPartial.id);
    presentationOwner.nodes=[...new Set([...presentationOwner.nodes,...childNodeIds.values()])];
    presentationOwner.edges=[...new Set([...presentationOwner.edges.filter(id=>!replacedEdges.includes(id)),...childEdgeIds.values()])];
    const rootRef=rootRefs.find(ref=>ref.partial?.id===ownerPartial.id);
    if(!rootRef) fail(`linked diagram target owner partial has no Full auto-fold reference: ${ownerPartial.id}`);
    rootRef.partial.nodes=[...new Set([...(rootRef.partial.nodes||[]),...childNodeIds.values()])];
    rootRef.partial.edges=[...new Set([...(rootRef.partial.edges||[]).filter(id=>!replacedEdges.includes(id)),...childEdgeIds.values()])];
    out.l0_refs=rootRefs;
    out.linked_diagrams=verified.map(v=>clone(v.link));
    // Flow and animation state keys are presentation IDs; exact source hashes remain in the refs.
  }
  out.composition={linked_sources:verified.map(item=>({parent_node_id:item.target.id,full_sha256:item.childFullRef.sha256})),source_ir_unchanged:true};
  return out;
}


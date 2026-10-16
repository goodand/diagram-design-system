import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {projectFullBoundaries} from '../../work/diagram-implementation/v3_8_cli/designing-relation-diagrams/scripts/lib/workflow-units.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const base=path.join(here,'../dds-boundary-product-check-20261016/topology');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const layout=new Set(['x','y','w','h','pos','parent','expandAt','route','busX','midY','sdx','tdx','bend','labelAt']);
const semantic=o=>Object.fromEntries(Object.entries(o).filter(([k])=>!layout.has(k)));
const sorted=xs=>xs.map(semantic).sort((a,b)=>a.id.localeCompare(b.id));
const canonical=o=>Array.isArray(o)?o.map(canonical):o&&typeof o==='object'?Object.fromEntries(Object.keys(o).sort().map(k=>[k,canonical(o[k])])):o;
const equal=(a,b)=>assert.deepEqual(canonical(a),canonical(b));

// Manifest contains identity/ownership/boundary metadata only, never node labels,
// edge endpoints, roles or state strings. Extraction has no access to source Core.
export function contract(core){return {id:core.id,version:core.version,diagram_type:'Process_Core',summary_ref:core.summary_ref,
 node_ids:core.nodes.map(n=>n.id),edge_ids:core.edges.map(e=>e.id),partial_ids:core.partials.map(p=>p.id),e2e:core.e2e};}
export function extract(full,c){
 const aliases=full.boundary_projection?.aliases||{},map=id=>aliases[id]||id;
 const reverse=new Map();
 for(const id of c.node_ids){const key=map(id);assert(!reverse.has(key),'ambiguous intra-Core contraction');reverse.set(key,id);}
 const unique=(list,key)=>{assert.equal(new Set(list.map(x=>x[key])).size,list.length,'duplicate '+key);return new Map(list.map(x=>[x[key],x]));};
 const nodes=unique(full.nodes,'id'),edges=unique(full.edges,'id'),parts=unique(full.partials||[],'id');
 const unmap=id=>{assert(reverse.has(id),'edge/member escapes Core');return reverse.get(id);};
 const selected=c.edge_ids.map(id=>{assert(edges.has(id),'missing edge '+id);const e=edges.get(id);return {...semantic(e),from:unmap(e.from),to:unmap(e.to)};});
 const connectors=new Set(full.connections||[]);
 for(const e of full.edges)if(reverse.has(e.from)&&reverse.has(e.to)&&!connectors.has(e.id))assert(c.edge_ids.includes(e.id),'unexpected internal edge '+e.id);
 const result={id:c.id,version:c.version,diagram_type:c.diagram_type,summary_ref:structuredClone(c.summary_ref),
 nodes:c.node_ids.map(id=>{assert(nodes.has(map(id)),'missing node '+id);return {...semantic(nodes.get(map(id))),id};}),
 edges:selected,e2e:structuredClone(c.e2e),partials:c.partial_ids.map(id=>{assert(parts.has(id),'missing ownership '+id);const p=parts.get(id);return {...p,nodes:p.nodes.map(unmap),edges:[...p.edges]};}),
 flow:Object.fromEntries(c.edge_ids.filter(id=>Object.hasOwn(full.flow||{},id)).map(id=>[id,full.flow[id]]))};
 if(full.animation_states)result.animation_states=Object.fromEntries(c.edge_ids.filter(id=>Object.hasOwn(full.animation_states,id)).map(id=>[id,full.animation_states[id]]));
 for(const id of [...result.e2e.inputs,...result.e2e.outputs])assert(result.nodes.some(n=>n.id===id),'missing boundary');
 return result;
}
function signature(c){return {nodes:sorted(c.nodes),edges:sorted(c.edges),e2e:c.e2e,
 partials:c.partials.map(p=>({...p,nodes:[...p.nodes].sort(),edges:[...p.edges].sort()})).sort((a,b)=>a.id.localeCompare(b.id)),flow:c.flow||{},animation_states:c.animation_states||{}};}

const rows=[];
for(const entry of fs.readdirSync(base).filter(n=>n.startsWith('pair-'))){
 const dir=path.join(base,entry),full=read(path.join(dir,'out/ir.json'));
 const dest=path.join(here,entry);fs.mkdirSync(dest,{recursive:true});
 const cores=[0,1].map(i=>read(path.join(dir,`core-${i}.json`)));
 const contracts=cores.map(contract);write(path.join(dest,'contracts.json'),contracts);
 for(const [stage,graph] of [['assembled',full],['projected',projectFullBoundaries(full)]]){
  write(path.join(dest,stage+'.full.json'),graph);
  for(let i=0;i<cores.length;i++){
   const restored=extract(graph,contracts[i]);equal(signature(restored),signature(cores[i]));
   write(path.join(dest,`${stage}.core-${i}.json`),restored);
   const mutations={
    node_missing:g=>g.nodes.splice(g.nodes.findIndex(n=>n.id===restored.nodes.find(n=>n.role==='process').id),1),
    label_changed:g=>g.nodes.find(n=>n.id===restored.nodes.find(n=>n.role==='process').id).label+=' CORRUPTED',
    direction_reversed:g=>{const e=g.edges.find(e=>e.id===restored.edges[0].id);[e.from,e.to]=[e.to,e.from];},
    edge_missing:g=>g.edges.splice(g.edges.findIndex(e=>e.id===restored.edges[0].id),1),
    state_changed:g=>g.flow[restored.edges[0].id]='CORRUPTED',
    membership_changed:g=>g.partials.find(p=>p.id===contracts[i].partial_ids[0]).nodes.pop(),
    edge_added:g=>g.edges.push({...g.edges.find(e=>e.id===restored.edges[0].id),id:'unexpected'})};
   const rejected=[];
   for(const [name,mutate] of Object.entries(mutations)){const bad=structuredClone(graph);mutate(bad);assert.throws(()=>equal(signature(extract(bad,contracts[i])),signature(cores[i])),name+' must fail');rejected.push(name);}
   rows.push({fixture:entry,stage,core:cores[i].id,equivalent:true,rejected});
  }
 }
}
write(path.join(here,'results.json'),{scope:'9 ordered pairs; assembled and render-projected Full; 18 original Cores',rows,passed:rows.every(r=>r.equivalent&&r.rejected.length===7),limitations:['Core E2E and identity metadata come from an explicit sidecar contract, not inferred from Full alone.','Only nodes, edges, flow, animation_states, partial membership and declared E2E are compared; not arbitrary unknown top-level extensions.','No HTML/DOM geometry or Human understanding claim.']});
console.log(JSON.stringify({comparisons:rows.length,mutationRejections:rows.reduce((n,r)=>n+r.rejected.length,0),pass:true}));

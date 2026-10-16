// Presentation-only Diamond axis alignment atop the previously validated router.
import { layoutState } from './dds-elk.mjs';
import { routeView as routeWithOptions, analyzeRoutes } from './avoid-router.mjs';
const routeView=(view,options={})=>routeWithOptions(view,{...options,nudgeConnectedShapes:false});
const nearestSide=(box,p)=>Object.entries({left:Math.abs(p[0]-box.x),right:Math.abs(p[0]-(box.x+box.w)),top:Math.abs(p[1]-box.y),bottom:Math.abs(p[1]-(box.y+box.h))}).sort((a,b)=>a[1]-b[1])[0][0];
export const diamondBBoxCenter=boxes=>{
 const items=Array.isArray(boxes)?boxes:Object.values(boxes);
 if(items.length!==2)throw new Error('Diamond centering requires exactly two visible branch boxes');
 return (Math.min(...items.map(b=>b.x))+Math.max(...items.map(b=>b.x+b.w)))/2;
};
function patternsFor(ir){
 const roles=new Map(ir.nodes.filter(n=>n.expandAt===undefined).map(n=>[n.id,n.role])),out=new Map(),inc=new Map();
 for(const e of ir.edges.filter(e=>!e.loop)){if(!out.has(e.from))out.set(e.from,[]);out.get(e.from).push(e.to);if(!inc.has(e.to))inc.set(e.to,[]);inc.get(e.to).push(e.from);}
 const patterns=[];
 for(const [split,targets] of out){if(roles.get(split)!=='process'||targets.length!==2)continue;const joins=[...new Set(targets.flatMap(branch=>out.get(branch)||[]))].filter(j=>roles.get(j)==='process'&&(inc.get(j)||[]).length===2&&targets.every(branch=>(inc.get(j)||[]).includes(branch)));if(joins.length===1)patterns.push({split,branches:targets,join:joins[0]});}
 return patterns;
}
export function alignDiamondAxes(ir,layout){
 const patterns=patternsFor(ir);if(!patterns.length)return{patterns:[],axis:null,shifted:[]};
 const rawById=new Map(ir.nodes.map(n=>[n.id,n])),visibleOut=new Map(),visibleIn=new Map(),loopIncident=new Set();
 for(const e of layout.visibleEdges||[]){if(e.loop){loopIncident.add(e.from);loopIncident.add(e.to);continue;}if(!visibleOut.has(e.from))visibleOut.set(e.from,[]);visibleOut.get(e.from).push(e.to);if(!visibleIn.has(e.to))visibleIn.set(e.to,[]);visibleIn.get(e.to).push(e.from);}
 const visibleId=id=>layout.positions[id]?id:(rawById.get(id)?.parent&&layout.positions[rawById.get(id).parent]?rawById.get(id).parent:null);
 const projected=patterns.map(p=>({...p,visibleSplit:visibleId(p.split),visibleJoin:visibleId(p.join),visibleBranches:p.branches.map(visibleId)})).filter(p=>p.visibleSplit&&p.visibleJoin&&p.visibleBranches.every(Boolean)&&new Set([p.visibleSplit,p.visibleJoin,...p.visibleBranches]).size===4);
 if(!projected.length)return{patterns:[],axis:null,shifted:[]};
 const pairAxes=projected.map(p=>diamondBBoxCenter(p.visibleBranches.map(id=>layout.boxes[id])));
 const axis=pairAxes.reduce((a,x)=>a+x,0)/pairAxes.length;
 const branchVisible=new Set(projected.flatMap(p=>p.visibleBranches));
 if(branchVisible.size!==projected.reduce((n,p)=>n+p.visibleBranches.length,0))return{patterns:[],axis:null,shifted:[],skipped:'overlapping diamond branch scopes'};
 const backbone=new Set(projected.flatMap(p=>[p.visibleSplit,p.visibleJoin]));
 for(const p of projected){
   // Walk the projected visible graph so the chain continues across a
   // collapsed Core's synthetic fold node; stop at branches and feedback.
   let n=p.visibleSplit,seen=new Set([n]);
   while((visibleIn.get(n)||[]).length===1){
     const prev=visibleIn.get(n)[0];
     if(loopIncident.has(n)||loopIncident.has(prev)||(visibleOut.get(prev)||[]).length!==1||branchVisible.has(prev)||seen.has(prev))break;
     backbone.add(prev);seen.add(prev);n=prev;
   }
   n=p.visibleJoin;seen=new Set([n]);
   while((visibleOut.get(n)||[]).length===1){
     const next=visibleOut.get(n)[0];
     if(loopIncident.has(n)||loopIncident.has(next)||(visibleIn.get(next)||[]).length!==1||branchVisible.has(next)||seen.has(next))break;
     backbone.add(next);seen.add(next);n=next;
   }
 }
 const shifted=[];
 for(const id of Object.keys(layout.positions)){
   let target=layout.positions[id][0];
   if(backbone.has(id))target=axis;
   else if(branchVisible.has(id))target=axis+(layout.positions[id][0]-pairAxes[projected.findIndex(p=>p.visibleBranches.includes(id))]);
   const delta=target-layout.positions[id][0];
   if(Math.abs(delta)>1e-7){layout.positions[id]=[target,layout.positions[id][1]];if(layout.boxes[id])layout.boxes[id]={...layout.boxes[id],x:target-layout.boxes[id].w/2};shifted.push({id,delta});}
 }
 return{patterns:projected.map((p,i)=>({split:p.split,branches:p.branches,join:p.join,branchEnvelopeMidpoint:pairAxes[i]})),axis,backbone:[...backbone],shifted};
}
export async function layoutVisibleState(DDS,source,state){
 const exactDDS={...DDS,view(ir,level,options){const v=DDS.view(ir,level,options);return {...v,nodes:v.nodes.map(n=>{const b=DDS.box(n);return {...n,w:b.w,h:b.h,collapsed:false};}),edges:v.edges.filter(e=>!e.loop)};}};
 const layout=await layoutState(exactDDS,source,{...state,options:{level:state.level,expand:state.expand,collapse:state.collapse}});
 // Preserve the original ELK route endpoint sides before coordinates shift.
 const elkPortSides=Object.fromEntries(Object.entries(layout.routes||{}).map(([id,r])=>{const e=layout.visibleEdges.find(x=>x.id===id),a=layout.boxes[e?.from],b=layout.boxes[e?.to];return[id,a&&b?{fromSide:nearestSide(a,r.points[0]),toSide:nearestSide(b,r.points.at(-1))}:null];}));
 const alignment=alignDiamondAxes(source,layout);
 // Candidate: reserve a visible shaft before lateral join arrowheads.
 // Keep the branch pair symmetric; preserve split/join and E2E center axes.
 for(const p of alignment.patterns){
  const a=layout.boxes[p.split],b=layout.boxes[p.join];
  if(!a||!b)continue;
  const center=(a.x+a.w/2+b.x+b.w/2)/2;
  const radius=Math.max(a.w,b.w)/2+40;
  const distance=Math.max(radius,...p.branches.map(id=>Math.abs(layout.positions[id][0]-center)));
  for(const id of p.branches){
   const old=layout.positions[id][0],x=center+(old<center?-distance:distance);
   layout.positions[id]=[x,layout.positions[id][1]];
   layout.boxes[id]={...layout.boxes[id],x:x-layout.boxes[id].w/2};
  }
 }
 const positioned=structuredClone(source);for(const n of positioned.nodes){const p=layout.positions[n.id];if(p)n.pos={...(n.pos||{}),[state.level]:p};}
 const view=DDS.view(positioned,state.level,{expand:state.expand,collapse:state.collapse});
 const nodes=view.nodes.map(n=>({id:n.id,...DDS.box(n)})),nodeById=new Map(nodes.map(n=>[n.id,n]));
 const edges=view.edges.map(e=>{if(e.loop)return {...e,fromSide:'right',toSide:'right'};const sides=elkPortSides[e.id];if(!sides)throw new Error(`${state.id}: ELK route-side provenance missing for ${e.id}`);return{...e,...sides};});
 // Candidate only: branch-centered vertical attachment with lateral split/join.
 // Apply only to fully visible, identified Diamond branches; preserve other edges.
 for(const p of alignment.patterns){
  for(const branch of p.branches){
   const b=nodeById.get(branch), split=nodeById.get(p.split), join=nodeById.get(p.join);
   if(!b||!split||!join)continue;
   const bx=b.x+b.w/2;
   if(bx>=split.x&&bx<=split.x+split.w)continue;
   if(bx>=join.x&&bx<=join.x+join.w)continue;
   for(const e of edges){
    if(e.from===p.split&&e.to===branch){e.fromSide=bx<split.x?'left':'right';e.toSide='top';}
    if(e.from===branch&&e.to===p.join){e.fromSide='bottom';e.toSide=bx<join.x?'left':'right';}
   }
  }
 }
 if(nodes.length!==Object.keys(layout.positions).length)throw new Error(`${state.id}: ELK position count differs from DDS visible node count`);
 const ddsBoxes=Object.fromEntries(view.nodes.map(n=>[n.id,DDS.box(n)]));for(const [id,b] of Object.entries(layout.boxes)){const a=ddsBoxes[id];if(!a||Math.abs(b.w-a.w)>1e-6||Math.abs(b.h-a.h)>1e-6)throw new Error(`${state.id}: ELK/DDS box mismatch for ${id}`);}
 const routes=Object.create(null),normal=edges.filter(e=>!e.loop),loops=edges.filter(e=>e.loop);Object.assign(routes,await routeView({nodes,edges:normal}));for(const e of loops)Object.assign(routes,await routeView({nodes,edges:[e]},{clearance:32}));
 const analysis=analyzeRoutes({nodes,edges},routes),routingKey=DDS.routingKey(view),routingCache={[routingKey]:view.edges.map(e=>({pts:routes[e.id].map(p=>[p.x,p.y])}))};
 const assignedPorts=Object.fromEntries(edges.map(e=>[e.id,{fromSide:e.fromSide,toSide:e.toSide}]));
 return{stateId:state.id,positions:layout.positions,boxes:layout.boxes,ddsBoxes,width:layout.width,height:layout.height,nodes,edges,routes,assignedPorts,analysis,view,routingKey,routingCache,diamondAlignment:alignment};
}

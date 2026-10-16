// Author: chatgpt_gpt6. Isolated integration; reuse the validated midpoint adapter.
import {layoutVisibleState} from './layout/layout-adapter.mjs';
import {selectRouteCandidate,sideCandidates} from './route-candidates.mjs';

// Input is an already projected graph, never a workflow source or a fold hierarchy.
export async function layoutGraph(DDS,graph){
 if(!Array.isArray(graph?.nodes)||!Array.isArray(graph?.edges)||!graph.nodes.length)throw Error('Layout requires a nonempty projected graph');
 const ids=new Set(graph.nodes.map(n=>n.id));
 if(ids.size!==graph.nodes.length||graph.nodes.some(n=>typeof n.id!=='string'||!n.id))throw Error('Layout node IDs must be unique');
 if(new Set(graph.edges.map(e=>e.id)).size!==graph.edges.length||graph.edges.some(e=>!e.id||!ids.has(e.from)||!ids.has(e.to)))throw Error('Layout edges must have unique IDs and existing endpoints');
 // Projection-specific fields belong to the caller, not to this layout operation.
 const flat={nodes:graph.nodes.map(n=>({id:n.id,label:n.label,role:n.role,w:DDS.box({...n,x:0,y:0}).w,h:DDS.box({...n,x:0,y:0}).h,x:0,y:0})),edges:structuredClone(graph.edges)};
 // The caller already resolved visibility. Reusing DDS.view here would merge
 // parallel edges in untyped graphs and silently change the supplied topology.
 const projectedDDS={...DDS,view(ir,level){return {...ir,groups:[],level,nodes:ir.nodes.map(n=>({...n,x:n.pos?.[level]?.[0]??n.x,y:n.pos?.[level]?.[1]??n.y})),edges:ir.edges.map(e=>({...e}))};}};
 const result=await layoutVisibleState(projectedDDS,flat,{id:'common',level:2,expand:[],collapse:[]});
 const endpoints=edges=>edges.map(e=>[e.id,e.from,e.to]);
 if(JSON.stringify(endpoints(result.edges))!==JSON.stringify(endpoints(graph.edges)))throw Error('Automatic layout changed projected topology');
 if(!result.analysis.valid){
  const selected=await selectRouteCandidate({nodes:result.nodes,edges:result.edges},sideCandidates(result));
  result.routes=selected.routes;result.edges=selected.edges;result.analysis=selected.analysis;
  result.routingCache={[result.routingKey]:result.edges.map(e=>({pts:selected.routes[e.id].map(p=>[p.x,p.y])}))};
  result.assignedPorts=Object.fromEntries(result.edges.map(e=>[e.id,{fromSide:e.fromSide,toSide:e.toSide}]));
  result.routeSelection={candidate:selected.id,evaluations:selected.evaluations,search:selected.search,budget:256,optimality:'not established',visual:'UNREVIEWED'};
 }
 for(let i=0;i<result.nodes.length;i++)for(let j=i+1;j<result.nodes.length;j++){
  const a=result.nodes[i],b=result.nodes[j];
  if(a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h)throw Error('Automatic layout node overlap');
 }
 return result;
}

export async function buildViewLayouts(DDS,input,level=2){
 const source=structuredClone(input);
 delete source.visible_layout_cache;delete source.visible_layout_signature;delete source.routing_cache;
 const projectedSource=DDS.withAutoFolds(source);
 const groups=projectedSource.nodes.filter(n=>n.expandAt!==undefined).map(n=>n.id);
 if(groups.length>8)throw Error('Automatic layout supports at most eight fold groups');
 const layouts={},routes={},states=[];
 for(let mask=0;mask<2**groups.length;mask++){
  const expand=groups.filter((_,i)=>mask&(1<<i)),collapse=groups.filter(id=>!expand.includes(id));
  const view=DDS.view(projectedSource,level,{expand,collapse});
  const key=JSON.stringify([view.nodes.map(n=>n.id).sort(),view.edges.map(e=>[e.id,e.from,e.to]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
  if(layouts[key])continue;
  const result=await layoutGraph(DDS,view);
  layouts[key]={positions:result.positions};
  Object.assign(routes,result.routingCache);
  states.push({expand,collapse,nodeIds:view.nodes.map(n=>n.id),analysis:result.analysis});
 }
 return {visible_layout_signature:DDS.layoutSignature(source),visible_layout_cache:layouts,routing_cache:routes,states};
}

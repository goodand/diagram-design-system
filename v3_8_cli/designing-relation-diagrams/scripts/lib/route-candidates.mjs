// Author: chatgpt_gpt6. Select among explicit presentation candidates only.
import {routeView,analyzeRoutes} from './layout/avoid-router.mjs';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
// Only attachment sides may differ between presentation candidates.
const identity=edges=>JSON.stringify(edges.map(({fromSide,toSide,...preserved})=>canonical(preserved)));
// Bounded presentation search. Does not claim a globally optimal assignment.
export function sideCandidates(graph,maxCandidates=256){
 if(!Number.isInteger(maxCandidates)||maxCandidates<1)throw Error('Invalid candidate budget');
 const sides=['top','right','bottom','left'],result=[],seen=new Set();
 const add=edges=>{const key=JSON.stringify(edges.map(e=>[e.fromSide,e.toSide]));if(!seen.has(key)&&result.length<maxCandidates){seen.add(key);result.push({id:'sides-'+result.length,edges});}};
 add(structuredClone(graph.edges));
 // First preserve all other routes while changing one edge's attachment pair.
 for(let i=0;i<graph.edges.length;i++)for(const fromSide of sides)for(const toSide of sides){const edges=structuredClone(graph.edges);edges[i]={...edges[i],fromSide,toSide};add(edges);}
 // Then consider joint choices; the finite budget is reported to the caller.
 const walk=(i,edges)=>{if(result.length>=maxCandidates)return;if(i===edges.length){add(edges);return;}for(const fromSide of sides)for(const toSide of sides){const next=structuredClone(edges);next[i]={...next[i],fromSide,toSide};walk(i+1,next);if(result.length>=maxCandidates)return;}};
 walk(0,graph.edges);
 const fullAssignments=16n**BigInt(graph.edges.length);
 const covered=result.filter(candidate=>candidate.edges.every(edge=>sides.includes(edge.fromSide)&&sides.includes(edge.toSide))).length;
 const exhaustive=BigInt(covered)===fullAssignments;
 result.search={budget:maxCandidates,generated:result.length,fullAssignments:String(fullAssignments),coveredAssignments:covered,exhaustive,truncated:!exhaustive};
 return result;
}
export async function selectRouteCandidate(graph,candidates){
 const expected=identity(graph.edges),evaluations=[],valid=[];
 for(const candidate of candidates){
  if(identity(candidate.edges)!==expected)throw Error('Route candidate changed topology: '+candidate.id);
  const input={nodes:structuredClone(graph.nodes),edges:structuredClone(candidate.edges)};
  const routes=await routeView(input,{nudgeConnectedShapes:false,clearance:32});
  const analysis=analyzeRoutes(input,routes);
  const length=Object.values(routes).reduce((sum,points)=>sum+points.slice(1).reduce((s,p,i)=>s+Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y),0),0);
  evaluations.push({id:candidate.id,valid:analysis.valid,analysis,length});
  if(analysis.valid)valid.push({id:candidate.id,edges:input.edges,routes,analysis,length});
 }
 const search=candidates.search??{generated:candidates.length,exhaustive:false,truncated:null};
 if(!valid.length){const error=Error('No valid route candidate among inspected candidates; uninspected routes are not ruled out');error.code='NO_VALID_INSPECTED_ROUTE';error.search=search;error.evaluations=evaluations;throw error;}
 // Length is only a deterministic tie-break after safety checks, not a UX score.
 valid.sort((a,b)=>a.length-b.length||a.id.localeCompare(b.id));
 return {...valid[0],evaluations,search,selectionBasis:'geometry-valid then shortest; visual acceptance separate'};
}

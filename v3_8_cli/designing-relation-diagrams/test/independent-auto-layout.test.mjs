// Author: chatgpt_gpt6. Agent view must expose the authored graph without coordinates.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderIndependentCoreSvg} from '../scripts/lib/render.mjs';
for(const kind of ['linear','diamond','cycle','parallel'])test('Independent Core coordinate-free '+kind,async()=>{
 const ids=kind==='diamond'?['s','a','b','t']:['s','a','t'];
 const pairs=kind==='diamond'?[['s','a'],['s','b'],['a','t'],['b','t']]:[['s','a'],['a','t'],...(kind==='cycle'?[['t','a']]:kind==='parallel'?[['s','a']]:[])];
 const source={diagram_type:'Process_Core',nodes:ids.map(id=>({id,label:id,role:'process'})),edges:pairs.map(([from,to],i)=>({id:'e'+i,from,to,...(kind==='cycle'&&i===2?{loop:true}:{})}))};
 const before=JSON.stringify(source),svg=await renderIndependentCoreSvg(source);
 assert.equal(JSON.stringify(source),before);
 assert.doesNotMatch(svg,/NaN|undefined/);
 assert.equal((svg.match(/class="dds-node"/g)||[]).length,ids.length);
 assert.equal((svg.match(/class="dds-edge(?: is-loop)?"/g)||[]).length,pairs.length);
 const rects=[...svg.matchAll(/<rect[^>]*x="([^"]+)"[^>]*y="([^"]+)"/g)].map(m=>[Number(m[1]),Number(m[2])]);
 assert(new Set(rects.map(p=>p.join(','))).size>=ids.length,'nodes must have distinct positions');
});

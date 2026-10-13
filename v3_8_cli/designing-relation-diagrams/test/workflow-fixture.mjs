import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
// Synthetic Human decisions here are TEST DATA, never records of real approval.
export function fixture(dir) {
  mkdirSync(dir,{recursive:true});
  const node = (id,label,role,x,y) => ({id,label,role,x,y});
  const edge = (id,from,to) => ({id,from,to,meaning:'execution_flow',certainty:'solid'});
  const shared = [node('input','원천 자료','entity',500,70),node('prepare','자료 준비','process',500,180),node('ready','준비된 자료','entity',500,290)];
  const sharedEdges = [edge('in','input','prepare'),edge('prepared','prepare','ready')];
  const parts = ['a','b'].map((id,index) => {
    const x = index ? 800 : 200;
    const nodes = [...shared,...Array.from({length:4},(_,i) => node(id+i,`${index ? '분류':'분석'} ${i+1}`,'process',x,410+i*110)),node(id+'out',index ? '분류 결과':'분석 결과','entity',x,850)];
    const edges = [...sharedEdges,edge(id+'0','ready',id+'0'),...Array.from({length:3},(_,i) => edge(id+(i+1),id+i,id+(i+1))),edge(id+'out',id+'3',id+'out')];
    return {id,version:'1',diagram_type:'l1_partial',w:1100,h:950,nodes,edges,e2e:{inputs:['input'],outputs:[id+'out']},
      partials:[{id:'scope-'+id,nodes:nodes.map(n=>n.id),edges:edges.map(e=>e.id)}],
      flow:Object.fromEntries(edges.map(e=>[e.id,e.id==='in' ? '원천 자료' : e.id==='prepared' ? '준비된 자료' : `${id} 산출물 ${e.id}`]))};
  });
  const decisions=[], refs=[];
  for (const p of parts) {
    const bytes=JSON.stringify(p,null,2)+'\n', sha256=createHash('sha256').update(bytes).digest('hex');
    writeFileSync(path.join(dir,p.id+'.json'),bytes);
    refs.push({id:p.id,version:p.version,path:p.id+'.json',sha256,decision_ref:'approve-'+p.id});
    decisions.push({id:'approve-'+p.id,topic:'partial_approval',subject:'Human',status:'decided',answer:'SYNTHETIC TEST APPROVAL',answered_at:'2026-10-12T00:00:00Z',ir_sha256:sha256});
  }
  decisions.push({id:'assemble',topic:'assemble_full',subject:'Human',status:'decided',answer:'SYNTHETIC TEST ASSEMBLY',answered_at:'2026-10-12T00:00:00Z',partial_sha256:refs.map(r=>r.sha256)});
  const full={id:'full',version:'1',diagram_type:'l1_full',title:'Workflow interaction test',w:1100,h:950,
    nodes:[...new Map(parts.flatMap(p=>p.nodes).map(n=>[n.id,n])).values()],edges:[...new Map(parts.flatMap(p=>p.edges).map(e=>[e.id,e])).values()],
    e2e:{inputs:['input'],outputs:['aout','bout']},partials:parts.flatMap(p=>p.partials),flow:Object.assign({},...parts.map(p=>p.flow)),approved_partials:refs,assembly_decision_ref:'assemble'};
  const l0={id:'summary',version:'1',diagram_type:'l0_summary',nodes:[{id:'input',role:'entity',label:'자료'},{id:'task',role:'process',label:'분석·분류'},{id:'output',role:'entity',label:'결과'}],
    edges:[edge('i','input','task'),edge('o','task','output')],e2e:{inputs:['input'],outputs:['output']},flow:{i:'자료',o:'분석·분류 결과'}};
  writeFileSync(path.join(dir,'full.json'),JSON.stringify(full,null,2));
  writeFileSync(path.join(dir,'l0.json'),JSON.stringify(l0,null,2));
  writeFileSync(path.join(dir,'decisions.json'),JSON.stringify({decisions},null,2));
  return {full,parts,l0,decisions};
}

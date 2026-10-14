import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { composeLinkedDiagrams } from '../scripts/lib/linked-diagrams.mjs';
import { linkedFixture } from './linked-fixture.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('composes an approved one-level child diagram as a nested presentation while preserving sources',()=>{
  const x=linkedFixture();
  const originalParent=readFileSync(x.parentPath,'utf8');
  const originalChild=readFileSync(path.join(x.dir,x.child.fullRef.path),'utf8');
  const originalParentObject=JSON.stringify(x.parentFull);
  const composed=composeLinkedDiagrams(x.parentFull,x.dir,x.decisions);
  assert.equal(readFileSync(x.parentPath,'utf8'),originalParent);
  assert.equal(readFileSync(path.join(x.dir,x.child.fullRef.path),'utf8'),originalChild);
  assert.equal(JSON.stringify(x.parentFull),originalParentObject);
  assert.equal(x.parentFull.nodes.find(n=>n.id===x.link.node_id).expandAt,undefined);
  assert.equal(composed.nodes.find(n=>n.id===x.link.node_id).expandAt,2);
  assert.equal(composed.nodes.find(n=>n.id===x.link.node_id).linked_detail,true);
  assert.equal(composed.nodes.find(n=>n.id===x.link.node_id).drawRegion,false);
  assert.ok(composed.nodes.some(n=>n.parent===x.link.node_id&&n.id.startsWith('__link_')));
  assert.ok(composed.nodes.every(n=>n.id.startsWith('parent-')||n.id.startsWith('__link_')));
  assert.ok(!composed.edges.some(e=>e.from==='parent-in'&&e.to===x.link.node_id));
  assert.ok(composed.edges.some(e=>e.from==='parent-in'&&e.to.startsWith('__link_')));
  assert.ok(composed.edges.some(e=>e.from.startsWith('__link_')&&e.to==='parent-mid'));
  const linkedPartials=composed.partials.filter(p=>p.scope_depth===1);
  assert.equal(linkedPartials.length,2);
  assert.ok(linkedPartials.every(p=>p.owner_node===x.link.node_id&&p.parent_partial_id===x.parentPartial.id));
  const ownerRef=composed.l0_refs.find(ref=>ref.partial.id===x.parentPartial.id);
  assert.ok(ownerRef&&ownerRef.partial.nodes.some(id=>id.startsWith('__link_')));
  assert.ok(ownerRef.partial.edges.some(id=>id.startsWith('__link_')));
  assert.ok(!ownerRef.partial.edges.some(id=>id.startsWith('parent-ce0')));
  assert.ok(!composed.partials.find(p=>p.id===x.parentPartial.id).edges.some(id=>id.startsWith('parent-ce0')));
});

test('links a Core-internal process by its owning partial instead of assuming Summary node IDs match',()=>{
  const x=linkedFixture({internalTarget:true});
  assert.notEqual(x.link.node_id,x.parent.full.approved_partials[0].id);
  assert.notEqual(x.link.node_id,x.parent.full.approved_partials[0].node_id);
  const composed=composeLinkedDiagrams(x.parentFull,x.dir,x.decisions);
  const ownerRef=composed.l0_refs.find(ref=>ref.partial.id===x.parentPartial.id);
  assert.ok(ownerRef);
  assert.ok(ownerRef.partial.nodes.includes(x.link.node_id));
  assert.ok(ownerRef.partial.nodes.some(id=>id.startsWith('__link_')));
});

test('rejects nested links, ambiguous target ownership, incorrect boundaries and missing approval',()=>{
  for (const mutate of [
    (x)=>{x.child.full.linked_diagrams=[{}];const bytes=JSON.stringify(x.child.full,null,2)+'\n';writeFileSync(path.join(x.dir,x.child.fullRef.path),bytes);x.link.full_ref.sha256=sha(bytes);},
    (x)=>{x.parentFull.partials.push({...x.parentPartial,id:'duplicate-owner'});},
    (x)=>{x.link.boundary_map['child-in']='parent-out';},
    (x)=>{x.link.definition_ref.sha256='f'.repeat(64);},
    (x)=>{x.link.full_ref.sha256='f'.repeat(64);},
    (x)=>{x.decisions=x.decisions.filter(d=>d.id!=='link-approved');},
  ]) {
    const x=linkedFixture();mutate(x);
    assert.throws(()=>composeLinkedDiagrams(x.parentFull,x.dir,x.decisions));
  }
});

test('simulation approvals are accepted only when the root Full is explicitly simulated',()=>{
  const x=linkedFixture();
  x.decisions.find(d=>d.id==='link-approved').simulated=true;
  assert.throws(()=>composeLinkedDiagrams(x.parentFull,x.dir,x.decisions),/approval/);
  const y=linkedFixture({simulation:true});
  y.decisions.find(d=>d.id==='link-approved').simulated=true;
  assert.doesNotThrow(()=>composeLinkedDiagrams(y.parentFull,y.dir,y.decisions));
});


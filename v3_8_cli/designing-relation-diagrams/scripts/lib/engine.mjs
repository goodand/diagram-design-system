// Loads dds.js (the one engine) and exposes DDS plus the shared gates.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
export const DDS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dds.js');
require(DDS_PATH);
export const DDS = globalThis.DDS;
export const isGroup = (n) => !!n.drawRegion || n.expandAt !== undefined;
// Validate the IR input; returns {ir} or {bad: reason}.
export function loadIr(text, A) {
  let ir; try { ir = JSON.parse(text); } catch (e) { return { bad: `cannot read IR JSON: ${e.message}` }; }
  if (!ir || !Array.isArray(ir.nodes) || !Array.isArray(ir.edges)) return { bad: 'IR must have "nodes" and "edges" arrays' };
  const ids = new Set(ir.nodes.map(n => n.id));
  const dang = ir.edges.filter(e => !ids.has(e.from) || !ids.has(e.to));
  if (dang.length) return { bad: 'edges refer to unknown nodes: ' + dang.map(e => `${e.from}->${e.to}`).join(', ') };
  const unk = [...A.expand, ...A.collapse].filter(id => !ids.has(id));
  if (unk.length) return { bad: `--expand/--collapse refer to unknown nodes: ${unk.join(', ')}` };
  const v = DDS.view(ir, A.level, { expand: A.expand, collapse: A.collapse });
  if (A.focus && !v.nodes.some(n => n.id === A.focus)) return { bad: `--focus node "${A.focus}" is not visible in this view. Visible: ${v.nodes.map(n => n.id).join(', ')}` };
  return { ir, view: v };
}
export function focusVerdict(v, id) {
  const f = DDS.focusStats(v, id);
  return { id, verdict: f.total <= 9 ? 'not_needed' : f.dimmed === 0 ? 'ineffective' : f.main > 9 ? 'still_over' : 'effective', main: f.main, dimmed: f.dimmed };
}
const humanOk = (d) => d && d.subject === 'Human' && d.status === 'decided';
export function validDecisionRef(decs, ref) {
  const d = ref && decs.find(x => x.id === ref);
  return !!(humanOk(d) && typeof d.answer === 'string' && d.answer.trim() && d.answered_at);
}
// Run all gates (undecided groups are listed in `groups`, not rejected; DEC-095). Returns {rules, rejects:[{s,code,reason,fix}], status, exit, warns, checks, focus}.
export function gates(ir, v, decs, A) {
  const r = DDS.validate(v, ir), rejects = [], groups = [];
  const warns = r.results.filter(x => !x.ok && x.level === 'warn').map(x => x.code);
  const fails = r.results.filter(x => !x.ok && x.level !== 'warn');
  fails.forEach(x => rejects.push({ s: 'S2', code: x.code, reason: x.evidence, fix: x.fix }));
  const bad = ir.nodes.filter(isGroup).filter(n => !(n.source === 'request' || (n.source === 'human' && validDecisionRef(decs, n.decision_ref))));
  bad.forEach(n => groups.push(n.id));
  const focus = A.focus ? focusVerdict(v, A.focus) : null;
  const infoOk = decs.some(d => d.topic === 'info_amount' && humanOk(d)) || (focus && (focus.verdict === 'effective' || focus.verdict === 'not_needed'));
  const mc = r.results.find(x => x.code === 'VB-MAIN-COUNT' && !x.ok && x.level === 'warn');
  if (mc && !infoOk) rejects.push({ s: 'S3', code: 'VB-MAIN-COUNT', reason: mc.evidence, fix: 'record a Human info_amount decision, or pass --focus <id> that makes Main <= 9, or split the diagram' });
  const has = (s) => rejects.some(x => x.s === s);
  const [status, exit] = has('S2') ? ['INCONSISTENT', 1] : has('S3') ? ['NEEDS_ADJUSTMENT', 4] : groups.length ? ['REVIEW_PENDING', 0] : ['CONSISTENT', 0];
  const checks = [
    { code: 'S2', state: has('S2') ? 'INCONSISTENT' : 'CONSISTENT', evidence: has('S2') ? fails.map(x => x.code).join(',') : `${r.results.length} rules checked, no error` },
    { code: 'S4', state: groups.length ? 'UNKNOWN' : 'CONSISTENT', evidence: groups.length ? `${groups.length} group(s) pending Human review [${groups.join(',')}]` : `${ir.nodes.filter(isGroup).length} group(s), all request/Human-decided` },
    { code: 'S3', state: has('S3') ? 'INCONSISTENT' : 'CONSISTENT', evidence: mc ? (infoOk ? 'VB-MAIN-COUNT warn handled by Human info_amount decision or effective focus' : mc.evidence) : 'Main count within limit' }];
  return { groups, results: r.results, rejects, status, exit, warns, checks, focus };
}

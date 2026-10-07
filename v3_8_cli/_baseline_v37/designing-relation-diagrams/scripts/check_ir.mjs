#!/usr/bin/env node
// Validate a diagram IR against Version B rules (VB-*), count Main nodes, and test focus (hover) effect.
// Usage: node scripts/check_ir.mjs diagram.json [--level N] [--expand id,id] [--collapse id,id] [--focus nodeId]
// Exit code: 0 = pass (warnings allowed), 1 = rule failure, 2 = bad input.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseArgs } from './_args.mjs';
import { logRun } from './_log.mjs';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require(path.join(path.dirname(fileURLToPath(import.meta.url)), 'dds.js'));
const A = parseArgs(process.argv.slice(2));
if (!A.pos[0]) { console.error('usage: node scripts/check_ir.mjs diagram.json [--level N] [--expand id,id] [--focus nodeId]'); process.exit(2); }
let ir;
try { ir = JSON.parse(readFileSync(A.pos[0], 'utf8')); }
catch (e) { console.error(`cannot read IR JSON: ${e.message}`); process.exit(2); }
if (!Array.isArray(ir.nodes) || !Array.isArray(ir.edges)) { console.error('IR must have "nodes" and "edges" arrays'); process.exit(2); }
const ids = new Set(ir.nodes.map(n => n.id));
const dangling = ir.edges.filter(e => !ids.has(e.from) || !ids.has(e.to));
if (dangling.length) { console.error('edges refer to unknown nodes: ' + dangling.map(e => `${e.from}->${e.to}`).join(', ') + `. Known nodes: ${[...ids].join(', ')}`); process.exit(2); }
const unknown = [...A.expand, ...A.collapse].filter(id => !ids.has(id));
if (unknown.length) { console.error(`--expand/--collapse refer to unknown nodes: ${unknown.join(', ')}`); process.exit(2); }
const v = globalThis.DDS.view(ir, A.level, { expand: A.expand, collapse: A.collapse });
const r = globalThis.DDS.validate(v, ir);
for (const x of r.results) {
  const st = x.ok ? 'PASS' : (x.level === 'warn' ? 'WARN' : 'FAIL');
  console.log(`${st} ${x.code}: ${x.evidence}${x.ok ? '' : ' -> ' + x.fix}`);
}
if (A.focus) {
  if (!v.nodes.some(n => n.id === A.focus)) { console.error(`--focus node "${A.focus}" is not visible in this view. Visible: ${v.nodes.map(n => n.id).join(', ')}`); process.exit(2); }
  const f = globalThis.DDS.focusStats(v, A.focus);
  console.log(`FOCUS ${A.focus}: Main ${f.main}개 (공동 입력 포함), 흐려짐 ${f.dimmed}개 / 전체 ${f.total}개`);
  if (f.total <= 9) console.log('FOCUS 판정: 전체 Main이 9개 이하라 정보량 조정(강조)이 필요 없다');
  else if (f.dimmed === 0) console.log('FOCUS 판정: 강조 무효 (흐려지는 node가 없다) -> 분할로 간다');
  else if (f.main > 9) console.log('FOCUS 판정: 강조 후에도 Main 9개 초과 -> 분할로 간다');
  else console.log('FOCUS 판정: 강조로 Main 9개 이하 -> 강조 사용 가능');
}
const warns = r.results.filter(x => !x.ok && x.level === 'warn').map(x => x.code), fails = r.results.filter(x => !x.ok && x.level !== 'warn').map(x => x.code);
let fv = null; if (A.focus) { const f = globalThis.DDS.focusStats(v, A.focus); fv = { id: A.focus, verdict: f.total <= 9 ? 'not_needed' : f.dimmed === 0 ? 'ineffective' : f.main > 9 ? 'still_over' : 'effective', main: f.main, dimmed: f.dimmed }; }
logRun(A.pos[0], { tool: 'check_ir', args: process.argv.slice(3), result: r.pass ? 'pass' : 'fail', warns, fails, focus: fv });
console.log('RESULT_SCOPE ir_only');
console.log(r.pass ? 'WORKFLOW_COMPLETE unknown' : 'WORKFLOW_COMPLETE no');
console.log(r.pass ? 'RESULT pass' : 'RESULT fail');
process.exit(r.pass ? 0 : 1);

#!/usr/bin/env node
// drd: the only producer of diagram outputs. finalize | verify | check  (contract: SPEC_cli.md)
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseArgs } from './_args.mjs';
import { loadIr, gates, DDS } from './lib/engine.mjs';
import { renderSvg, renderHtml, renderIndependentCoreSvg } from './lib/render.mjs';
import { candidates } from './lib/candidates.mjs';
import { toPng } from './lib/png.mjs';
import { context, schema, workflowState } from './lib/workflow.mjs';
import { runtimeIr, runtimeType } from './lib/workflow-units.mjs';
import { routingCache } from './lib/routing-cache.mjs';
import { composeLinkedDiagrams } from './lib/linked-diagrams.mjs';
import { viewStem, viewOutputNames } from './lib/view-names.mjs';
const VERSION = 'v3.95-cli';
const FUNCTION_GUIDE = '반복이 하나의 Process 내부에서 완결되는 기능은 Linear Summary로 표현하고, Core에서 Cycle을 구체화한다. Summary에서는 반복 수행을 하나의 Process로 취급하고, 별도 Process에 반복 종료 여부를 판정하는 Gate를 둘 수 있다.';
const TAIL = 'SELF-CHECK ONLY — NOT DONE. Final status is decided by the external judge.';
const OUTS = [...viewOutputNames, 'ir.json', 'receipt.json'];
const sha = (b) => createHash('sha256').update(b).digest('hex');
const done = (lines, code) => { console.log([...lines, TAIL].join('\n')); process.exit(code); };
const [cmd, ...rest] = process.argv.slice(2);
const dIdx = rest.indexOf('--decisions'), outIdx = rest.indexOf('--out'), irIdx = rest.indexOf('--ir');
const val = (i) => (i >= 0 ? rest[i + 1] : undefined);
const skip = [dIdx, outIdx, irIdx].filter(i => i >= 0), A = parseArgs(rest.filter((_, i) => !skip.includes(i) && !skip.includes(i - 1)));
const usage = 'usage: drd.mjs context|schema <diagram_type> | workflow <ir.json> [--decisions f] | finalize <ir.json> --out <dir> [--decisions f] [--level N] [--expand a,b] [--collapse a,b] [--focus id (legacy)] | verify <dir> [--ir f] | check <ir.json> [opts]';
const bad = (m) => done([`STATUS BAD_INPUT`, `REJECT S0 BAD-INPUT: ${m} -> fix the input and rerun`], 2);
const rejLines = (g) => g.rejects.map(x => `REJECT ${x.s} ${x.code}: ${x.reason} -> ${x.fix}`);

// decisions: explicit file must be well-formed; missing default = none.
function loadDecisions(irPath) {
  const explicit = val(dIdx), p = path.resolve(explicit || path.join(path.dirname(path.resolve(irPath)), 'decisions.json'));
  if (!existsSync(p)) { if (explicit) return { bad: `decisions file not found: ${p}` }; return { decs: [], sha: null }; }
  const buf = readFileSync(p); let j; try { j = JSON.parse(buf.toString('utf8')); } catch (e) { return { bad: `decisions file is not JSON: ${e.message}` }; }
  if (!j || !Array.isArray(j.decisions)) return { bad: 'decisions file must have a "decisions" array' };
  return { decs: j.decisions, sha: sha(buf), decisions_source:p };
}
function prepare(irPath) {
  if (!irPath || !existsSync(irPath)) bad(`cannot read IR: ${irPath}`);
  const text = readFileSync(irPath, 'utf8'), L = loadIr(text, A);
  if (L.bad) bad(L.bad);
  const D = loadDecisions(irPath); if (D.bad) bad(D.bad);
  let workflow; try { workflow = workflowState(L.ir, D.decs, path.dirname(path.resolve(irPath)),sha(Buffer.from(text))); } catch (e) { bad(e.message); }
  if (L.ir.diagram_type === 'Function_Definition' && workflow) workflow.summary_guidance = FUNCTION_GUIDE;
  let presentation = workflow?.l0_refs?.length ? { ...L.ir, l0_refs:workflow.l0_refs,
    ...(runtimeType(L.ir.diagram_type) === 'l1_partial' ? {l0_ref:workflow.l0_refs[0]} : {}) } : L.ir;
  if (L.ir.linked_diagrams !== undefined) {
    try { presentation = composeLinkedDiagrams(L.ir,path.dirname(path.resolve(irPath)),D.decs); } catch(e) { bad(e.message); }
  }
  let view; try { view = DDS.view(runtimeIr(presentation), A.level, {expand:A.expand,collapse:A.collapse}); } catch(e) { bad(e.message); }
  const g = gates(L.ir, view, D.decs, A);
  if (workflow?.errors.length) { g.rejects.push(...workflow.errors.map(reason => ({s:'S5',code:'WORKFLOW',reason,fix:'restore approved content or obtain the matching Human decision'}))); g.status = 'INCONSISTENT'; g.exit = 1; }
  return { text, ...L, ...D, g, workflow, presentation };
}

if (cmd === 'version' || cmd === '--version') {
  console.log(VERSION);
} else if (cmd === 'context' || cmd === 'schema') {
  try { console.log(JSON.stringify((cmd === 'schema' ? schema : context)(A.pos[0]),null,2)); } catch(e) { bad(e.message); }
} else if (cmd === 'workflow') {
  const P = prepare(A.pos[0]); console.log(JSON.stringify(P.workflow || {stage:'legacy',next_actions:['author_l0_summary']},null,2)); process.exit(P.g.exit);
} else if (cmd === 'independent-core') {
  const out=val(outIdx);
  if (!A.pos[0] || !out) bad('independent-core <Core.json> --out <new-directory>');
  if (existsSync(out)) bad('independent-core requires a new output directory to preserve earlier artifacts');
  const P=prepare(A.pos[0]);
  if(P.g.exit) done([`STATUS ${P.g.status}`,...rejLines(P.g)],P.g.exit);
  let svg;try {svg=await renderIndependentCoreSvg(P.ir);}catch(e){bad(e.message);}
  mkdirSync(out,{recursive:true});
  const stem=viewStem(P.ir.diagram_type,'agent');
  writeFileSync(path.join(out,`${stem}.svg`),svg);
  writeFileSync(path.join(out,'ir.json'),P.text);
  const png=toPng(path.join(out,`${stem}.svg`),path.join(out,`${stem}.png`));
  writeFileSync(path.join(out,'receipt.json'),JSON.stringify({author:'chatgpt_gpt6',view:stem,audience:'agent',source:path.resolve(A.pos[0]),source_sha256:sha(Buffer.from(P.text)),svg:{path:`${stem}.svg`,sha256:sha(Buffer.from(svg))},png:png.ok?{path:`${stem}.png`,sha256:sha(readFileSync(path.join(out,`${stem}.png`)))}:null,png_attempts:png.attempts,image_read_status:'PENDING',html:false},null,2));
  done([`STATUS ${png.ok?'GENERATED_IMAGE_READ_REQUIRED':'PNG_CONVERSION_FAILED'}`,`wrote ${out}`],png.ok?0:1);
} else if (cmd === 'finalize') {
  const out = val(outIdx); if (!A.pos[0] || !out) { console.error(usage); process.exit(2); }
  // macOS: cwd is reported as /private/var/..; prefer the equivalent /var/.. form the caller used.
  let irPath = path.resolve(A.pos[0]);
  try { if (process.platform === 'darwin' && irPath.startsWith('/private/') && realpathSync(irPath.slice(8)) === irPath) irPath = irPath.slice(8); } catch {}
  // Every run starts from no outputs, so nothing from an earlier run can survive (P2).
  for (const f of OUTS) { const p = path.join(out, f); if (existsSync(p)) unlinkSync(p); }
  let outAbs = path.resolve(out);
  try { if (process.platform === 'darwin' && outAbs.startsWith('/private/')) { let q = outAbs; while (!existsSync(q.slice(8))) q = path.dirname(q); if (realpathSync(q.slice(8)) === q) outAbs = outAbs.slice(8); } } catch {}
  rmSync(path.join(out, 'candidates'), { recursive: true, force: true });
  const P = prepare(irPath), g = P.g;
  if (g.exit) {
    done([`STATUS ${g.status}`, ...rejLines(g)], g.exit);
  }
  mkdirSync(out, { recursive: true });
  if (P.ir.edge_routing === 'libavoid') {
    try { P.presentation.routing_cache = await routingCache(runtimeIr(P.presentation),DDS,A.level); }
    catch(e) { bad(`edge routing failed: ${e.message}`); }
  }
  let svg; try { svg = renderSvg(P.presentation, A); } catch (e) { console.error(`render failed: ${e.message}`); process.exit(1); }
  const stem=viewStem(P.ir.diagram_type);
  const files = { ir: ['ir.json', P.text], svg: [`${stem}.svg`, svg], html: [`${stem}.html`, renderHtml(svg, JSON.stringify(P.presentation), A)] };
  const outputs = {};
  for (const [k, [n, c]] of Object.entries(files)) { writeFileSync(path.join(out, n), c); outputs[k] = { path: n, sha256: sha(Buffer.from(c)) }; }
  const pp = path.join(out, `${stem}.png`), png = toPng(path.join(out, `${stem}.svg`), pp);
  outputs.png = png.ok ? { path: `${stem}.png`, sha256: sha(readFileSync(pp)) } : null;
  const C = g.groups.length ? candidates(P.ir, g.groups, A, outAbs, out, svg) : { review_pending: [], lines: [] };
  const receipt = { schema: 'drd-receipt-v1', dds_version:VERSION, created_at: new Date().toISOString(), ir_source: irPath, ir_sha256: sha(Buffer.from(P.text)), decisions_sha256: P.sha,
    options: { level: A.level, expand: A.expand, collapse: A.collapse, focus: A.focus }, workflow:P.workflow, decisions_source:P.decisions_source, outputs, png_attempts: png.attempts, checks: g.checks, warnings: g.warns, review_pending: C.review_pending };
  writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  done([`STATUS ${g.status}`, ...g.checks.map(c => `${c.code} ${c.state}: ${c.evidence}`), ...C.lines, ...(P.workflow?.summary_guidance ? [`GUIDE ${P.workflow.summary_guidance}`] : []), `wrote ${out}`], 0);
} else if (cmd === 'check') {
  if (!A.pos[0]) { console.error(usage); process.exit(2); }
  const P = prepare(A.pos[0]), g = P.g;
  const lines = g.results.map(x => `${x.ok ? 'PASS' : x.level === 'warn' ? 'WARN' : 'FAIL'} ${x.code}: ${x.evidence}${x.ok ? '' : ' -> ' + x.fix}`);
  if (g.focus) lines.push(`FOCUS ${g.focus.id}: ${g.focus.verdict} (Main ${g.focus.main}, dimmed ${g.focus.dimmed})`);
  if (P.workflow?.summary_guidance) lines.push(`GUIDE ${P.workflow.summary_guidance}`);
  done([`STATUS ${g.status}`, ...lines, ...rejLines(g), ...(g.groups.length ? [`NOTE ${g.groups.length} undecided group(s) [${g.groups.join(',')}]: finalize draws them as written (solid unless the IR says dashed), reports them as REVIEW and writes A/B candidates for Human review`] : [])], g.exit);
} else if (cmd === 'verify') {
  const dir = A.pos[0], rp = dir && path.join(dir, 'receipt.json');
  if (!dir || !existsSync(rp)) { console.error(`no receipt.json in ${dir}`); process.exit(2); }
  let rc; try { rc = JSON.parse(readFileSync(rp, 'utf8')); } catch (e) { console.error(`bad receipt: ${e.message}`); process.exit(2); }
  const L = [], put = (c, s, e) => L.push(`${c} ${s}: ${e}`);
  const bads = [], miss = [];
  for (const [k, o] of Object.entries(rc.outputs || {})) { if (!o) continue; const p = path.join(dir, o.path); if (!existsSync(p)) miss.push(o.path); else if (sha(readFileSync(p)) !== o.sha256) bads.push(o.path); }
  put('S6', bads.length || miss.length ? 'INCONSISTENT' : 'CONSISTENT', bads.length || miss.length ? `sha mismatch [${bads}] missing [${miss}] -> rerun finalize` : 'every receipt output exists and sha256 matches');
  const sp = path.join(dir, rc.outputs?.svg?.path || 'diagram.svg'), hp = path.join(dir, rc.outputs?.html?.path || 'diagram.html');
  const emb = existsSync(sp) && existsSync(hp) && readFileSync(hp, 'utf8').includes(readFileSync(sp, 'utf8'));
  put('S8', emb ? 'CONSISTENT' : 'INCONSISTENT', emb ? 'receipt SVG found verbatim in receipt HTML' : 'receipt SVG not found verbatim in receipt HTML -> rerun finalize');
  const src = val(irIdx) || rc.ir_source;
  if (!src || !existsSync(src)) put('S1', 'UNKNOWN', `source IR not found: ${src}`);
  else { const same = sha(readFileSync(src)) === rc.ir_sha256; put('S1', same ? 'CONSISTENT' : 'INCONSISTENT', same ? 'source IR sha256 equals receipt.ir_sha256' : `source IR ${src} changed since finalize -> rerun finalize`); }
  if (rc.workflow) {
    try {
      if (!src || !existsSync(src)) throw Error('source IR unavailable for approval verification');
      const bytes = rc.decisions_source ? readFileSync(rc.decisions_source) : null;
      if ((bytes ? sha(bytes) : null) !== rc.decisions_sha256) throw Error('decisions changed since finalize');
      const sourceIr=JSON.parse(readFileSync(src,'utf8')), decisions=bytes ? JSON.parse(bytes).decisions : [];
      const state = workflowState(sourceIr,decisions,path.dirname(path.resolve(src)),sha(readFileSync(src)));
      if (sourceIr.linked_diagrams !== undefined) composeLinkedDiagrams(sourceIr,path.dirname(path.resolve(src)),decisions);
      put('S5',state.errors.length ? 'INCONSISTENT':'CONSISTENT',state.errors.join('; ') || 'approved snapshot content and Human assembly references match');
    } catch(e) { put('S5','INCONSISTENT',e.message); }
  }
  const rp_ = rc.review_pending || [];
  put('S4', rp_.length ? 'UNKNOWN' : 'CONSISTENT', rp_.length ? `${rp_.length} group(s) pending Human review [${rp_.map(x => x.group).join(',')}]` : 'no group pending Human review');
  put('S7', rc.outputs?.png ? 'CONSISTENT' : 'UNKNOWN', rc.outputs?.png ? 'png recorded in receipt' : 'no PNG produced; image READ unverifiable (DEC-071)');
  done(L, L.some(l => / INCONSISTENT:/.test(l)) ? 1 : 0);
} else { console.error(usage); process.exit(2); }

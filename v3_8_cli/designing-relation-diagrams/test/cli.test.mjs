// Contract tests for scripts/drd.mjs (see ../../SPEC_cli.md). Run: node --test test/cli.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, '..', 'scripts', 'drd.mjs');
const BASELINE = path.join(HERE, '..', '..', '_baseline_v37', 'designing-relation-diagrams', 'scripts', 'check_ir.mjs');
const TAIL = 'SELF-CHECK ONLY — NOT DONE. Final status is decided by the external judge.';
const OUTPUTS = ['diagram.svg', 'diagram.html', 'ir.json', 'receipt.json'];

function work() { const d = mkdtempSync(path.join(tmpdir(), 'drd-')); cpSync(path.join(HERE, 'fixtures'), d, { recursive: true }); return d; }
function run(args, cwd) { const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, DRD_NO_PNG: '1' } }); return { code: r.status, out: r.stdout, err: r.stderr }; }
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const lastLine = (s) => s.trim().split('\n').at(-1);
const status = (s) => (s.match(/^STATUS (\S+)/m) || [])[1];
function finalize(d, ir, extra = []) { return run(['finalize', ir, '--out', 'out', ...extra], d); }

// ---- happy path -----------------------------------------------------------
test('ok IR: exit 0, CONSISTENT, all outputs written, tail line', () => {
  const d = work(), r = finalize(d, 'ok.json');
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(status(r.out), 'CONSISTENT');
  for (const f of OUTPUTS) assert.ok(existsSync(path.join(d, 'out', f)), f);
  assert.equal(lastLine(r.out), TAIL);
});

test('receipt binds input IR and every output by sha256', () => {
  const d = work(); finalize(d, 'ok.json');
  const rc = JSON.parse(readFileSync(path.join(d, 'out', 'receipt.json'), 'utf8'));
  assert.equal(rc.schema, 'drd-receipt-v1');
  assert.equal(rc.ir_sha256, sha(path.join(d, 'ok.json')));
  for (const k of ['ir', 'svg', 'html']) assert.equal(rc.outputs[k].sha256, sha(path.join(d, 'out', rc.outputs[k].path)), k);
  assert.equal(readFileSync(path.join(d, 'out', 'ir.json'), 'utf8'), readFileSync(path.join(d, 'ok.json'), 'utf8'));
});

test('HTML embeds the SVG byte-identically (S8 by construction)', () => {
  const d = work(); finalize(d, 'ok.json');
  const svg = readFileSync(path.join(d, 'out', 'diagram.svg'), 'utf8'), html = readFileSync(path.join(d, 'out', 'diagram.html'), 'utf8');
  assert.ok(svg.startsWith('<svg'), 'svg file starts with <svg');
  assert.ok(html.includes(svg), 'html contains svg verbatim');
  assert.match(html, /attachHover/);
});

test('SVG equals v3.7 render_svg output for the same IR (engine reused, not rewritten)', () => {
  const d = work(); finalize(d, 'ok.json');
  const base = path.join(path.dirname(BASELINE), 'render_svg.mjs');
  spawnSync(process.execPath, [base, 'ok.json', 'v37.svg'], { cwd: d });
  assert.equal(readFileSync(path.join(d, 'out', 'diagram.svg'), 'utf8'), readFileSync(path.join(d, 'v37.svg'), 'utf8'));
});

test('PNG disabled: receipt png null, still exit 0 (UNKNOWN is not failure, DEC-071)', () => {
  const d = work(), r = finalize(d, 'ok.json');
  assert.equal(r.code, 0);
  const rc = JSON.parse(readFileSync(path.join(d, 'out', 'receipt.json'), 'utf8'));
  assert.equal(rc.outputs.png, null);
});

// ---- input errors ---------------------------------------------------------
for (const f of ['broken.json', 'dangling.json', 'missing.json']) {
  test(`bad input ${f}: exit 2 BAD_INPUT`, () => {
    const d = work(), r = finalize(d, f);
    assert.equal(r.code, 2, r.out + r.err); assert.equal(status(r.out), 'BAD_INPUT');
  });
}
test('unknown --focus id: exit 2', () => { const d = work(); assert.equal(finalize(d, 'ok.json', ['--focus', 'nope']).code, 2); });
test('malformed decisions file: exit 2', () => {
  const d = work(); writeFileSync(path.join(d, 'bad_dec.json'), '{"decisions": 5}');
  assert.equal(finalize(d, 'group_human_ref.json', ['--decisions', 'bad_dec.json']).code, 2);
});

// ---- rule failure (S2) ----------------------------------------------------
test('rule failure: exit 1 INCONSISTENT, REJECT line names S2, rule, reason and fix (DEC-066)', () => {
  const d = work(), r = finalize(d, 'bad_palette.json');
  assert.equal(r.code, 1); assert.equal(status(r.out), 'INCONSISTENT');
  assert.match(r.out, /^REJECT S2 VB-PALETTE: .+ -> .+$/m);
  assert.equal(lastLine(r.out), TAIL);
});

// ---- group-source gate (S4, DEC-078) ------------------------------------
test('group gate passes: source request', () => { const d = work(); assert.equal(finalize(d, 'group_request.json').code, 0); });
test('group gate passes: source human + valid Human decision_ref', () => {
  const d = work(), r = finalize(d, 'group_human_ref.json', ['--decisions', 'decisions_human.json']);
  assert.equal(r.code, 0, r.out + r.err);
  const rc = JSON.parse(readFileSync(path.join(d, 'out', 'receipt.json'), 'utf8'));
  assert.equal(rc.decisions_sha256, sha(path.join(d, 'decisions_human.json')));
});
test('decisions.json next to IR is used by default', () => {
  const d = work(); cpSync(path.join(d, 'decisions_human.json'), path.join(d, 'decisions.json'));
  assert.equal(finalize(d, 'group_human_ref.json').code, 0);
});

// ---- main-count gate (S3, DEC-089) ---------------------------------------
test('Main > 9 without decision: exit 4 NEEDS_ADJUSTMENT, no outputs', () => {
  const d = work(), r = finalize(d, 'many.json');
  assert.equal(r.code, 4, r.out + r.err); assert.equal(status(r.out), 'NEEDS_ADJUSTMENT');
  assert.match(r.out, /^REJECT S3 VB-MAIN-COUNT: .+ -> .+$/m);
  assert.ok(!existsSync(path.join(d, 'out', 'diagram.svg')));
});
test('Main > 9 with Human info_amount decision: exit 0', () => {
  const d = work(); assert.equal(finalize(d, 'many.json', ['--decisions', 'decisions_info.json']).code, 0);
});
test('Main > 9 with ineffective focus on a chain: still exit 4', () => {
  const d = work(); assert.equal(finalize(d, 'many.json', ['--focus', 'n0']).code, 4);
});

// ---- stale output removal -------------------------------------------------
test('a failing finalize removes outputs of an earlier passing run in the same --out', () => {
  const d = work(); assert.equal(finalize(d, 'ok.json').code, 0);
  cpSync(path.join(d, 'bad_palette.json'), path.join(d, 'ok.json'));
  assert.equal(finalize(d, 'ok.json').code, 1);
  for (const f of [...OUTPUTS, 'diagram.png']) assert.ok(!existsSync(path.join(d, 'out', f)), f + ' must be removed');
});
test('finalize does not delete unrelated files in --out', () => {
  const d = work(); finalize(d, 'ok.json'); writeFileSync(path.join(d, 'out', 'notes.md'), 'keep');
  finalize(d, 'bad_palette.json');
  assert.ok(existsSync(path.join(d, 'out', 'notes.md')));
});

// ---- verify ---------------------------------------------------------------
test('verify after finalize: exit 0, S6 S8 CONSISTENT, S7 UNKNOWN when no PNG, tail line', () => {
  const d = work(); finalize(d, 'ok.json'); const r = run(['verify', 'out'], d);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /^S6 CONSISTENT/m); assert.match(r.out, /^S8 CONSISTENT/m); assert.match(r.out, /^S1 CONSISTENT/m);
  assert.match(r.out, /^S7 UNKNOWN/m);
  assert.equal(lastLine(r.out), TAIL);
});
test('verify: IR edited after finalize -> S1 INCONSISTENT, exit 1, fix says rerun finalize', () => {
  const d = work(); finalize(d, 'ok.json');
  const p = path.join(d, 'ok.json'), j = JSON.parse(readFileSync(p, 'utf8')); j.nodes[0].label = '변경'; writeFileSync(p, JSON.stringify(j));
  const r = run(['verify', 'out'], d);
  assert.equal(r.code, 1); assert.match(r.out, /^S1 INCONSISTENT.*finalize/m);
});
test('verify: tampered SVG -> S6 INCONSISTENT and S8 INCONSISTENT', () => {
  const d = work(); finalize(d, 'ok.json');
  const s = path.join(d, 'out', 'diagram.svg'); writeFileSync(s, readFileSync(s, 'utf8').replace('결제', '정산'));
  const r = run(['verify', 'out'], d);
  assert.equal(r.code, 1); assert.match(r.out, /^S6 INCONSISTENT/m); assert.match(r.out, /^S8 INCONSISTENT/m);
});
test('verify: no receipt -> exit 2', () => { const d = work(); assert.equal(run(['verify', 'out'], d).code, 2); });

// ---- check (diagnosis only) ----------------------------------------------
test('check writes nothing and reports rules and tail', () => {
  const d = work(), before = readdirSync(d).sort(), r = run(['check', 'group_nosource.json'], d);
  assert.deepEqual(readdirSync(d).sort(), before);
  assert.match(r.out, /VB-GROUP-SOURCE/); assert.equal(lastLine(r.out), TAIL);
});

// ---- unit-level superiority over v3.7 (DEC-079) --------------------------
// Same input: v3.7 lets it through (exit 0), v3.8 blocks it.
// ...and on inputs v3.7 accepts cleanly, v3.8 also accepts (no regression).
for (const ir of ['ok.json', 'group_request.json']) {
  test(`no regression: ${ir} passes both`, () => {
    const d = work();
    assert.equal(spawnSync(process.execPath, [BASELINE, ir], { cwd: d }).status, 0);
    assert.equal(finalize(d, ir).code, 0);
  });
}

// ---- hardening after adversarial review (Haiku, 2026-10-04) ---------------
test('info_amount decided by Agent does not open the Main-count gate', () => {
  const d = work(); assert.equal(finalize(d, 'many.json', ['--decisions', 'decisions_info_agent.json']).code, 4);
});
test('receipt has every spec field with the right shape', () => {
  const d = work(); finalize(d, 'ok.json');
  const rc = JSON.parse(readFileSync(path.join(d, 'out', 'receipt.json'), 'utf8'));
  for (const k of ['schema', 'created_at', 'ir_source', 'ir_sha256', 'decisions_sha256', 'options', 'outputs', 'png_attempts', 'checks', 'warnings']) assert.ok(k in rc, k);
  assert.match(rc.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  assert.equal(rc.ir_source, path.join(d, 'ok.json'));
  assert.equal(rc.decisions_sha256, null);
  assert.deepEqual(rc.options, { level: 2, expand: [], collapse: [], focus: null });
  assert.ok(Array.isArray(rc.png_attempts) && Array.isArray(rc.checks) && Array.isArray(rc.warnings));
  for (const c of rc.checks) { assert.match(c.code, /^S\d$/); assert.ok(['CONSISTENT', 'INCONSISTENT', 'UNKNOWN'].includes(c.state)); }
});
test('decisions.json is looked up next to the IR, not in cwd', () => {
  const d = work(); mkdirSync(path.join(d, 'sub'));
  cpSync(path.join(d, 'group_human_ref.json'), path.join(d, 'sub', 'g.json'));
  cpSync(path.join(d, 'decisions_human.json'), path.join(d, 'sub', 'decisions.json'));
  assert.equal(finalize(d, 'sub/g.json').code, 0);
});
test('HTML contains the SVG exactly once', () => {
  const d = work(); finalize(d, 'ok.json');
  const svg = readFileSync(path.join(d, 'out', 'diagram.svg'), 'utf8'), html = readFileSync(path.join(d, 'out', 'diagram.html'), 'utf8');
  assert.equal(html.indexOf(svg), html.lastIndexOf(svg));
});
// ---- main-agent verification (2026-10-04) ---------------------------------
test('successful finalize without PNG removes a stale diagram.png from an earlier run', () => {
  const d = work(); mkdirSync(path.join(d, 'out')); writeFileSync(path.join(d, 'out', 'diagram.png'), 'stale');
  assert.equal(finalize(d, 'ok.json').code, 0);
  assert.ok(!existsSync(path.join(d, 'out', 'diagram.png')));
});
test('BAD_INPUT reject code does not collide with verify S1', () => {
  const d = work(), r = finalize(d, 'broken.json');
  assert.match(r.out, /^REJECT S0 BAD-INPUT: /m);
});
test('BAD_INPUT after a passing run also removes the earlier outputs', () => {
  const d = work(); assert.equal(finalize(d, 'ok.json').code, 0);
  writeFileSync(path.join(d, 'ok.json'), '{"nodes": [');
  assert.equal(finalize(d, 'ok.json').code, 2);
  for (const f of OUTPUTS) assert.ok(!existsSync(path.join(d, 'out', f)), f);
});

// ---- post-hoc review of undecided groups (DEC-095) ------------------------
// A group without a request/Human-decided source is not blocked: it is drawn as the IR wrote it (DEC-133),
// listed in receipt.review_pending, and A/B candidate pictures are written for the Human's later review.
const cand = (d, f) => path.join(d, 'out', 'candidates', f);
const rc = (d) => JSON.parse(readFileSync(path.join(d, 'out', 'receipt.json'), 'utf8'));
const UNDECIDED = [['group_nosource.json'], ['group_agent.json'], ['group_human_noref.json'], ['group_expandat_only.json'],
  ['group_human_badref.json', 'decisions_human.json'], ['group_human_ref.json', 'decisions_agent.json'],
  ['group_human_ref.json', 'decisions_deferred.json'], ['group_human_ref.json'],
  ['group_human_ref.json', 'decisions_empty_answer.json'], ['group_human_ref.json', 'decisions_no_answered_at.json']];
for (const [ir, dec] of UNDECIDED) {
  test(`undecided group ${ir}${dec ? ' + ' + dec : ''}: exit 0 REVIEW_PENDING, outputs written, grp pending`, () => {
    const d = work(), r = finalize(d, ir, dec ? ['--decisions', dec] : []);
    assert.equal(r.code, 0, r.out + r.err); assert.equal(status(r.out), 'REVIEW_PENDING');
    for (const f of OUTPUTS) assert.ok(existsSync(path.join(d, 'out', f)), f);
    assert.deepEqual(rc(d).review_pending.map(x => x.group), ['grp']);
    assert.equal(lastLine(r.out), TAIL);
  });
}
test('decided groups: CONSISTENT and empty review_pending', () => {
  for (const [ir, dec] of [['group_request.json'], ['group_human_ref.json', 'decisions_human.json']]) {
    const d = work(), r = finalize(d, ir, dec ? ['--decisions', dec] : []);
    assert.equal(status(r.out), 'CONSISTENT'); assert.deepEqual(rc(d).review_pending, []);
    assert.ok(!existsSync(path.join(d, 'out', 'candidates')));
  }
});
test('undecided group is NOT forced dashed (2 6) in the final SVG unless the IR says certainty dashed (DEC-133)', () => {
  const d1 = work(); finalize(d1, 'group_nosource.json');
  const und = readFileSync(path.join(d1, 'out', 'diagram.svg'), 'utf8');
  assert.doesNotMatch(und, /stroke-dasharray="2 6"/);
  const j = JSON.parse(readFileSync(path.join(d1, 'group_nosource.json'), 'utf8'));
  j.nodes.find(n => n.id === 'grp').certainty = 'dashed'; writeFileSync(path.join(d1, 'g_dash.json'), JSON.stringify(j));
  finalize(d1, 'g_dash.json');
  assert.match(readFileSync(path.join(d1, 'out', 'diagram.svg'), 'utf8'), /stroke-dasharray="2 6"/);
});
test('the source IR is not modified by rendering', () => {
  const d = work(), before = readFileSync(path.join(d, 'group_nosource.json'), 'utf8'); finalize(d, 'group_nosource.json');
  assert.equal(readFileSync(path.join(d, 'group_nosource.json'), 'utf8'), before);
  assert.equal(readFileSync(path.join(d, 'out', 'ir.json'), 'utf8'), before);
});
test('REVIEW block: exactly 3 lines per pending group', () => {
  const d = work(), r = finalize(d, 'group_nosource.json');
  const lines = r.out.split('\n'), i = lines.indexOf('REVIEW grp');
  assert.ok(i >= 0, r.out);
  assert.equal(lines[i + 1], `Human 검토 대기: "결제 묶음"(카드 인증, 승인 요청)은 Agent가 정한 묶음이다(Human 미검토). 그림은 그대로 그렸고 검토 대기는 이 보고로 알린다. 비교 그림: ${cand(d, 'index.html')}`);
  assert.equal(lines[i + 2], '선택지: A(이대로 묶음) / B(묶지 않음) / 보류');
});
test('candidates: A equals the final diagram.svg, B has the group removed, page shows both', () => {
  const d = work(); finalize(d, 'group_nosource.json');
  const A = readFileSync(cand(d, 'grp-A.svg'), 'utf8'), B = readFileSync(cand(d, 'grp-B.svg'), 'utf8');
  assert.equal(A, readFileSync(path.join(d, 'out', 'diagram.svg'), 'utf8'));
  assert.match(A, /결제 묶음/); assert.doesNotMatch(B, /결제 묶음/);
  for (const t of ['카드 인증', '승인 요청', '주문', '영수증']) assert.match(B, new RegExp(t));
  const page = readFileSync(cand(d, 'index.html'), 'utf8');
  assert.ok(page.includes(A) && page.includes(B)); assert.match(page, /A: 묶음/); assert.match(page, /B: 묶지 않음/);
});
test('two groups: only the undecided one is pending and has candidates', () => {
  const d = work(), r = finalize(d, 'group_two_mixed.json');
  assert.deepEqual(rc(d).review_pending.map(x => x.group), ['grp2']);
  assert.ok(existsSync(cand(d, 'grp2-B.svg')) && !existsSync(cand(d, 'grp-A.svg')));
  assert.match(r.out, /^REVIEW grp2$/m); assert.doesNotMatch(r.out, /^REVIEW grp$/m);
  assert.doesNotMatch(readFileSync(cand(d, 'grp2-B.svg'), 'utf8'), /배송 묶음/);
});
test('candidates directory is cleared by the next run', () => {
  const d = work(); finalize(d, 'group_nosource.json'); assert.ok(existsSync(cand(d, 'grp-A.svg')));
  finalize(d, 'group_request.json'); assert.ok(!existsSync(path.join(d, 'out', 'candidates')));
});
test('edge pointing at the group node itself: no B file, page says B cannot be drawn', () => {
  const d = work(), p = path.join(d, 'group_nosource.json'), j = JSON.parse(readFileSync(p, 'utf8'));
  j.nodes[1].expandAt = 3; j.edges.push({ from: 'grp', to: 'c', meaning: 'execution_flow', certainty: 'dashed', label: 'x' });
  writeFileSync(path.join(d, 'g_edge.json'), JSON.stringify(j));
  const r = finalize(d, 'g_edge.json');
  assert.equal(r.code, 0, r.out);
  assert.ok(existsSync(cand(d, 'grp-A.svg'))); assert.ok(!existsSync(cand(d, 'grp-B.svg')));
  assert.match(readFileSync(cand(d, 'index.html'), 'utf8'), /B를 그릴 수 없음/);
});
test('verify: pending review is S4 UNKNOWN, not failure (exit 0)', () => {
  const d = work(); finalize(d, 'group_nosource.json'); const r = run(['verify', 'out'], d);
  assert.equal(r.code, 0, r.out); assert.match(r.out, /^S4 UNKNOWN: .*grp/m);
});
test('verify: decided groups give S4 CONSISTENT', () => {
  const d = work(); finalize(d, 'group_request.json'); assert.match(run(['verify', 'out'], d).out, /^S4 CONSISTENT/m);
});
// Unit-level superiority (DEC-079, updated for DEC-095): on the same input v3.7 draws an undecided group
// solid as if decided; v3.8 records it for Human review.
for (const ir of ['group_nosource.json', 'group_agent.json', 'group_human_noref.json', 'group_expandat_only.json', 'group_two_mixed.json']) {
  test(`superiority: ${ir} — v3.7 shows it as decided, v3.8 reports REVIEW_PENDING`, () => {
    const d = work();
    assert.equal(spawnSync(process.execPath, [BASELINE, ir], { cwd: d }).status, 0);
    spawnSync(process.execPath, [path.join(path.dirname(BASELINE), 'render_svg.mjs'), ir, 'v37.svg'], { cwd: d });
    assert.doesNotMatch(readFileSync(path.join(d, 'v37.svg'), 'utf8'), /stroke-dasharray="2 6"/);
    const r = finalize(d, ir);
    assert.equal(status(r.out), 'REVIEW_PENDING');
    assert.ok(rc(d).review_pending.length >= 1);
  });
}
test('superiority: many.json passes v3.7 but v3.8 blocks (exit 4)', () => {
  const d = work(); assert.equal(spawnSync(process.execPath, [BASELINE, 'many.json'], { cwd: d }).status, 0);
  assert.equal(finalize(d, 'many.json').code, 4);
});

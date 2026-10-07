// Builds demo/index.html: v3.7 vs v3.8 on the same inputs, for a Human to compare by eye.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..');
const FX = path.join(ROOT, 'designing-relation-diagrams', 'test', 'fixtures');
const V37 = path.join(ROOT, '_baseline_v37', 'designing-relation-diagrams', 'scripts');
const DRD = path.join(ROOT, 'designing-relation-diagrams', 'scripts', 'drd.mjs');
const CASES = [
  ['ok.json', null, '묶음 없는 정상 흐름'],
  ['group_request.json', null, '요청에 명시된 묶음 (source: request)'],
  ['group_human_ref.json', 'decisions_human.json', 'Human이 답한 묶음 (source: human + 답변 기록)'],
  ['group_nosource.json', null, 'Agent가 출처 없이 만든 묶음'],
  ['group_agent.json', null, 'Agent가 만든 묶음 (source: agent)'],
  ['group_human_noref.json', null, '"human"이라고만 적고 답변 기록이 없는 묶음'],
  ['group_two_mixed.json', null, '묶음 두 개 중 하나만 무단'],
  ['many.json', null, 'Main node 11개 (정보량 조정 없음)'],
];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const node = (args, cwd, env = {}) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
const cands = (d) => { const c = path.join(d, 'out', 'candidates'); if (!existsSync(c)) return '';
  return readdirSync(c).filter(f => f.endsWith('.svg')).sort().map(f => `<div class="cand"><b>${f.endsWith('-A.svg') ? 'A: 묶음' : 'B: 묶지 않음'}</b> <code>${f}</code><div class="fig">${readFileSync(path.join(c, f), 'utf8')}</div></div>`).join(''); };
let rows = '';
for (const [ir, dec, title] of CASES) {
  const d = mkdtempSync(path.join(tmpdir(), 'demo-')); cpSync(FX, d, { recursive: true });
  const c37 = node([path.join(V37, 'check_ir.mjs'), ir], d);
  node([path.join(V37, 'render_svg.mjs'), ir, 'v37.svg'], d);
  const warn37 = (c37.stdout.match(/^WARN .*$/gm) || []).map(l => l.split(' -> ')[0]);
  const svg37 = existsSync(path.join(d, 'v37.svg')) ? readFileSync(path.join(d, 'v37.svg'), 'utf8') : '';
  const r = node([DRD, 'finalize', ir, '--out', 'out', ...(dec ? ['--decisions', dec] : [])], d, { DRD_NO_PNG: '1' });
  const st = (r.stdout.match(/^STATUS (\S+)/m) || [])[1];
  const right = r.status === 0
    ? readFileSync(path.join(d, 'out', 'diagram.svg'), 'utf8')
    : `<div class="block"><b>산출물 없음</b><pre>${esc(r.stdout.split('\n').filter(l => /^(STATUS|QUESTION|A: |선택지)/.test(l) || l.startsWith('REJECT S3')).map(l => l.replace(/^아래 그림.*$/, '')).join('\n'))}</pre>${cands(d)}</div>`;
  rows += `<section><h2>${esc(title)} <code>${ir}${dec ? ' + ' + dec : ''}</code></h2><div class="cols">
<div class="col"><h3>v3.7 — exit ${c37.status} (<b>${c37.status === 0 ? '통과' : '실패'}</b>)</h3>${warn37.length ? `<p class="warn">${esc(warn37.join('<br>')).replace(/&lt;br>/g, '<br>')}</p>` : '<p class="ok">경고 없음</p>'}<div class="fig">${svg37}</div></div>
<div class="col"><h3>v3.8 — exit ${r.status} <span class="st st-${st}">${st}</span></h3>${right.startsWith('<svg') ? `<div class="fig">${right}</div>` : right}</div>
</div></section>\n`;
}
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>v3.7 대 v3.8-cli</title>
<style>body{font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;margin:24px;background:#fff;color:#111;max-width:1400px}
h1{font-size:22px}h2{font-size:16px;margin:28px 0 8px}h3{font-size:14px;margin:4px 0}code{font-size:12px;color:#555}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}.col{border:1px solid #ddd;border-radius:6px;padding:10px;min-width:0}
.fig svg{width:100%;height:auto}.warn{color:#9a6700;font-size:12px}.ok{color:#1a7f37;font-size:12px}
.cand{background:#fff;border:1px solid #ddd;border-radius:4px;padding:6px;margin-top:8px}.block{background:#fff8f0;border:1px solid #f0c08a;border-radius:6px;padding:8px}pre{white-space:pre-wrap;font-size:12px;margin:6px 0 0}
.st{padding:1px 6px;border-radius:4px;font-size:12px;color:#fff;background:#666}.st-CONSISTENT{background:#1a7f37}.st-NEEDS_HUMAN{background:#cf222e}.st-NEEDS_ADJUSTMENT{background:#9a6700}
@media(max-width:800px){.cols{grid-template-columns:1fr}}</style></head><body>
<h1>같은 입력, v3.7 대 v3.8-cli</h1>
<p>왼쪽: v3.7이 그대로 그린 결과(경고가 있어도 통과). 오른쪽: v3.8 <code>finalize</code>의 결과 — 통과하면 그림, 막으면 최종 산출물 없이, Human이 고를 후보 그림 A(묶음)·B(묶지 않음)와 질문.</p>
${rows}</body></html>`;
writeFileSync(path.join(HERE, 'index.html'), html);
console.log('wrote', path.join(HERE, 'index.html'));

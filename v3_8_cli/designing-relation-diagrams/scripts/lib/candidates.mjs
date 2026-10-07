// Undecided groups (DEC-095): write A (= final picture as drawn) / B (group removed) candidates + index.html.
// `ir` is the IR as written; returns {review_pending, lines}.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderSvg } from './render.mjs';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function candidates(ir, gids, A, outAbs, outDir, svgA) {
  const dir = path.join(outDir, 'candidates'); mkdirSync(dir, { recursive: true });
  const lines = [], secs = [], pending = [];
  for (const gid of gids) {
    const grp = ir.nodes.find(n => n.id === gid), members = ir.nodes.filter(n => n.parent === gid).map(n => n.label);
    const a = svgA; writeFileSync(path.join(dir, `${gid}-A.svg`), a);
    let b = null, why = '';
    if (ir.edges.some(e => e.from === gid || e.to === gid)) why = `묶음 "${grp.label}" 자체에 연결된 선이 있어 묶음을 지우면 선이 끊깁니다`;
    else {
      const c = JSON.parse(JSON.stringify(ir)); c.nodes = c.nodes.filter(n => n.id !== gid);
      for (const n of c.nodes) if (n.parent === gid) { if (grp.parent === undefined) delete n.parent; else n.parent = grp.parent; }
      b = renderSvg(c, A); writeFileSync(path.join(dir, `${gid}-B.svg`), b);
    }
    secs.push(`<section><h2>${esc(gid)}: ${esc(grp.label)}</h2><div class="r"><figure><figcaption>A: 묶음</figcaption>${a}</figure><figure><figcaption>B: 묶지 않음</figcaption>${b ?? `<p>B를 그릴 수 없음: ${esc(why)}</p>`}</figure></div></section>`);
    pending.push({ group: gid, label: grp.label, members, candidates: { A: `candidates/${gid}-A.svg`, B: b ? `candidates/${gid}-B.svg` : null, page: 'candidates/index.html' } });
    lines.push(`REVIEW ${gid}`, `Human 검토 대기: "${grp.label}"(${members.join(', ')})은 Agent가 정한 묶음이다(Human 미검토). 그림은 그대로 그렸고 검토 대기는 이 보고로 알린다. 비교 그림: ${path.join(outAbs, 'candidates', 'index.html')}`, '선택지: A(이대로 묶음) / B(묶지 않음) / 보류');
  }
  writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>묶음 후보</title><style>body{font-family:sans-serif;margin:16px}.r{display:flex;gap:16px;flex-wrap:wrap}figcaption{font-weight:700;margin:4px 0}</style></head><body><h1>묶음 후보: A 또는 B를 고르세요</h1>${secs.join('')}</body></html>\n`);
  return { review_pending: pending, lines };
}

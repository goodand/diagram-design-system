// SVG (identical to v3.7 render_svg) and standalone HTML.
import { readFileSync } from 'node:fs';
import { DDS, DDS_PATH } from './engine.mjs';
const STYLE = '<style>text{font-family:"Noto Sans CJK KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}.dds-label{font-size:14px;font-weight:600}.dds-edge-label{font-size:11.5px}.dds-region-label{font-size:12px;font-weight:600}.m-explain,.m-example{display:none}</style>';
export function renderSvg(ir, A) {
  const svg = DDS.render(ir, { level: A.level, expand: A.expand, collapse: A.collapse, fit: true, pad: A.pad, focus: A.focus }).svg.replace(/(<svg[^>]*>)/, '$1' + STYLE);
  return svg.replace('<svg ', '<svg style="background:#fff" ');
}
const safeJs = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
export function renderHtml(svg, irText) {
  const ir = JSON.stringify(JSON.parse(irText)).replace(/</g, '\\u003c');
  // Placeholders are filled last so the SVG is inserted exactly once and nothing inlined is rescanned.
  const parts = ['<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>diagram</title>',
    '<style>body{margin:0;background:#fff}svg.is-focus .dds-node:not(.on),svg.is-focus .dds-edge:not(.on){opacity:.2}</style></head><body><div id="host">', svg, '</div><script>', safeJs(readFileSync(DDS_PATH, 'utf8')),
    '</script><script>var IR=', ir, ';DDS.attachHover(document.getElementById("host"),IR);</script></body></html>\n'];
  return parts.join('');
}

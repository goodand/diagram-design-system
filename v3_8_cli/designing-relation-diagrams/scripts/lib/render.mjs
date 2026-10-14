// SVG (identical to v3.7 render_svg) and standalone HTML.
import { readFileSync } from 'node:fs';
import { DDS, DDS_PATH } from './engine.mjs';
import { fileURLToPath } from 'node:url';
import { runtimeIr } from './workflow-units.mjs';
const STYLE = '<style>text{font-family:"Noto Sans CJK KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}.dds-label{font-size:14px;font-weight:600}.dds-edge-label{font-size:11.5px}.dds-region-label{font-size:12px;font-weight:600}.m-explain,.m-example{display:none}</style>';
export function renderSvg(ir, A) {
  ir = runtimeIr(ir);
  const svg = DDS.render(ir, { level: A.level, expand: A.expand, collapse: A.collapse, fit: true, pad: A.pad, focus: A.focus }).svg.replace(/(<svg[^>]*>)/, '$1' + STYLE);
  return svg.replace('<svg ', '<svg style="background:#fff" ');
}
const safeJs = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
export function renderHtml(svg, irText, options = {}) {
  const ir = JSON.stringify(runtimeIr(JSON.parse(irText))).replace(/</g, '\\u003c');
  // Placeholders are filled last so the SVG is inserted exactly once and nothing inlined is rescanned.
  const parts = ['<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>diagram</title>',
    '<style>svg.is-focus .dds-region:not(.on){opacity:.2}</style>',
    '<style>html{height:100%}body{margin:0;height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:#fff;font-family:system-ui}#host{flex:1;min-height:0;min-width:0}#host>svg{display:block;width:100%;height:100%}svg.is-focus .dds-node:not(.on),svg.is-focus .dds-edge:not(.on){opacity:.2}.dds-token{pointer-events:none}.dds-controls{flex:0 0 auto;box-sizing:border-box;max-height:40dvh;overflow:auto;background:white;padding:12px;display:flex;gap:8px;flex-wrap:wrap}.dds-controls button{padding:8px;cursor:pointer}.dds-label{font-size:14px;font-weight:600}.dds-edge-label{font-size:11.5px}.dds-region-label{font-size:12px}.m-explain,.m-example{display:none}</style></head><body><div id="host">', svg, '</div><script>', safeJs(readFileSync(DDS_PATH, 'utf8')),
    '</script><script>', safeJs(readFileSync(fileURLToPath(new URL('../workflow-runtime.js', import.meta.url)), 'utf8')),
    '</script><script>var IR=', ir, ';if(IR.diagram_type){DDSWorkflow.attach(document.getElementById("host"),IR,', JSON.stringify(options).replace(/</g, '\\u003c'), ');}else{DDS.attachHover(document.getElementById("host"),IR);}</script></body></html>\n'];
  return parts.join('');
}

#!/usr/bin/env node
// Render a diagram IR to a standalone SVG file (for image READ).
// Usage: node scripts/render_svg.mjs diagram.json out.svg [--level N] [--expand id,id] [--collapse id,id] [--pad N] [--focus nodeId]
// --focus: static emphasis — the related flow stays, the rest is drawn faint (one flow per sheet).
// The canvas is the bounding box of everything drawn plus the same pad on all four sides (default 24).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseArgs } from './_args.mjs';
import { logRun, sha } from './_log.mjs';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require(path.join(path.dirname(fileURLToPath(import.meta.url)), 'dds.js'));
const A = parseArgs(process.argv.slice(2));
const [src, out] = A.pos;
if (!src || !out) { console.error('usage: node scripts/render_svg.mjs diagram.json out.svg [--level N] [--expand id,id]'); process.exit(2); }
const ir = JSON.parse(readFileSync(src, 'utf8'));
if (A.focus) { const v = globalThis.DDS.view(ir, A.level, { expand: A.expand, collapse: A.collapse }); if (!v.nodes.some(n => n.id === A.focus)) { console.error(`--focus node "${A.focus}" is not visible in this view. Visible: ${v.nodes.map(n => n.id).join(', ')}`); process.exit(2); } }
const style = '<style>text{font-family:"Noto Sans CJK KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}.dds-label{font-size:14px;font-weight:600}.dds-edge-label{font-size:11.5px}.dds-region-label{font-size:12px;font-weight:600}.m-explain,.m-example{display:none}</style>';
let svg;
try { svg = globalThis.DDS.render(ir, { level: A.level, expand: A.expand, collapse: A.collapse, fit: true, pad: A.pad, focus: A.focus }).svg.replace(/(<svg[^>]*>)/, '$1' + style); }
catch (e) { console.error(`render failed: ${e.message}`); process.exit(1); }
svg = svg.replace('<svg ', '<svg style="background:#fff" ');
writeFileSync(out, svg);
logRun(src, { tool: 'render_svg', args: process.argv.slice(4), out, out_sha: sha(out) });
console.log(`wrote ${out}`);

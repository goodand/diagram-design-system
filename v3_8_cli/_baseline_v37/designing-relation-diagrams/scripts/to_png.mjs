#!/usr/bin/env node
// Convert SVG to PNG for image READ. Tries converters in order and logs every attempt.
// Usage: node scripts/to_png.mjs out.svg out.png --ir diagram.json   (set DRD_BROWSER to a browser path to try it first)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { logRun, sha } from './_log.mjs';
const [svg, png] = process.argv.slice(2); const ii = process.argv.indexOf('--ir'); const ir = ii > 0 ? process.argv[ii + 1] : svg;
if (!svg || !png) { console.error('usage: node scripts/to_png.mjs out.svg out.png --ir diagram.json'); process.exit(2); }
if (!existsSync(svg)) {
  logRun(ir, { tool: 'to_png', svg, out: null, attempts: [{ tool: 'input', ok: false, err: 'SVG file missing' }] });
  console.error(`NO_PNG: SVG file missing: ${svg}`); process.exit(1);
}
// A converter returning success must create this run's PNG, not reuse an older file.
if (existsSync(png)) unlinkSync(png);
const vb = (readFileSync(svg, 'utf8').match(/viewBox="([^"]+)"/) || [])[1]?.split(/\s+/).map(Number);
const W = 1600, H = vb && vb[2] > 0 ? Math.max(200, Math.round(W * vb[3] / vb[2])) : 1200; // window follows the diagram's aspect ratio
const abs = path.resolve(svg), url = 'file://' + (process.platform === 'win32' ? '/' : '') + abs.replace(/\\/g, '/');
const browsers = [process.env.DRD_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'google-chrome', 'chromium', 'chromium-browser', 'msedge'].filter(Boolean);
const tries = [...browsers.map(b => ({ tool: b, run: () => execFileSync(b, ['--headless', '--disable-gpu', '--no-sandbox', `--screenshot=${path.resolve(png)}`, `--window-size=${W},${H}`, url], { stdio: 'pipe', timeout: 60000 }) })),
  { tool: 'rsvg-convert', run: () => execFileSync('rsvg-convert', [abs, '-o', png], { stdio: 'pipe' }) },
  { tool: 'cairosvg', run: () => execFileSync('cairosvg', [abs, '-o', png], { stdio: 'pipe' }) },
  { tool: 'magick', run: () => execFileSync('magick', [abs, png], { stdio: 'pipe' }) }];
const attempts = [];
for (const t of tries) {
  try { t.run(); if (existsSync(png)) { attempts.push({ tool: t.tool, ok: true }); logRun(ir, { tool: 'to_png', svg, out: png, out_sha: sha(png), attempts }); console.log(`wrote ${png} via ${t.tool}`); process.exit(0); } attempts.push({ tool: t.tool, ok: false, err: 'no output' }); }
  catch (e) { attempts.push({ tool: t.tool, ok: false, err: String(e.code || e.message).slice(0, 80) }); }
}
logRun(ir, { tool: 'to_png', svg, out: null, attempts });
console.error('NO_PNG: every converter failed. Record image READ as 보류 with these attempts:\n' + attempts.map(a => `  ${a.tool}: ${a.err}`).join('\n')); process.exit(1);

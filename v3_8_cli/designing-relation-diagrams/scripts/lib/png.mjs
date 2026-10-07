// Converter chain from v3.7 to_png. DRD_NO_PNG=1 skips every converter.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
export function toPng(svg, png) {
  if (process.env.DRD_NO_PNG === '1') return { ok: false, attempts: [] };
  if (existsSync(png)) unlinkSync(png);
  const vb = (readFileSync(svg, 'utf8').match(/viewBox="([^"]+)"/) || [])[1]?.split(/\s+/).map(Number);
  const W = 1600, H = vb && vb[2] > 0 ? Math.max(200, Math.round(W * vb[3] / vb[2])) : 1200;
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
    try { t.run(); if (existsSync(png)) { attempts.push({ tool: t.tool, ok: true }); return { ok: true, attempts }; } attempts.push({ tool: t.tool, ok: false, err: 'no output' }); }
    catch (e) { attempts.push({ tool: t.tool, ok: false, err: String(e.code || e.message).slice(0, 80) }); }
  }
  return { ok: false, attempts };
}

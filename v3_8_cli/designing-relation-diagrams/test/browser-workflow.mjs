import {outputPath} from './output-path.mjs';
// Optional real-browser regression. PLAYWRIGHT_MODULE may point to a bundled installation.
// Run: node test/browser-workflow.mjs <artifact-directory>
import { createRequire } from 'node:module';
import { readFileSync,writeFileSync } from 'node:fs';
import { fileURLToPath,pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fixture } from './workflow-fixture.mjs';
const require=createRequire(import.meta.url), {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir=path.resolve(process.argv[2]), {parts,full}=fixture(dir), cli=fileURLToPath(new URL('../scripts/drd.mjs',import.meta.url));
function finalize(input,out) { const r=spawnSync(process.execPath,[cli,'finalize',input,'--out',out],{cwd:dir,encoding:'utf8',env:{...process.env,DRD_NO_PNG:'1'}}); assert.equal(r.status,0,r.stdout+r.stderr); }
finalize('full.json','full'); finalize('l0.json','l0'); finalize('a.json','partial');
const browser=await chromium.launch({headless:true,...(process.env.DDS_BROWSER ? {executablePath:process.env.DDS_BROWSER}: {})});
const page=await browser.newPage({viewport:{width:1300,height:1200}}), errors=[], checks=[];
page.on('pageerror',e=>errors.push(e.message));
const node=id=>page.locator(`.dds-node[data-id="${id}"]`);
try {
  await page.clock.install();
  await page.goto(pathToFileURL(outputPath(path.join(dir,'full'),'html')).href);
  assert.equal(await page.locator('.dds-node').count(),13); assert.equal(await page.locator('.is-focus').count(),0); checks.push('full >9 nodes without default dimming');
  await page.screenshot({path:path.join(dir,'full.png'),fullPage:true});
  await node('a1').hover(); assert.equal(await node('a3').evaluate(e=>e.classList.contains('on')),true); assert.equal(await node('b3').evaluate(e=>e.classList.contains('on')),false); checks.push('unique partial scope');
  await page.screenshot({path:path.join(dir,'unique-hover.png'),fullPage:true});
  await node('ready').hover(); assert.equal(await node('a3').evaluate(e=>e.classList.contains('on')),true); assert.equal(await node('b3').evaluate(e=>e.classList.contains('on')),true); assert.equal(await page.locator('.dds-token').count(),0); checks.push('shared union; intermediate input does not play');
  await node('input').hover(); assert.equal(await page.locator('.dds-token').count(),1);
  assert.equal(await page.locator('.is-focus').count(),1); checks.push('input playback preserves Hover focus');
  await page.clock.runFor(2000); assert.equal(await page.locator('.dds-token text').textContent(),'준비된 자료'); checks.push('transformed artifact label');
  await page.screenshot({path:path.join(dir,'token.png'),fullPage:true});
  await node('a1').hover(); assert.equal(await page.locator('.dds-token').count(),0); await page.clock.runFor(1500); assert.equal(await page.locator('.dds-token').count(),0); checks.push('leave cancels token and pending frames');
  await page.mouse.move(1290,1190); assert.equal(await page.locator('.is-focus').count(),0);
  assert.equal(await page.getByRole('button',{name:/재생/}).count(),0);
  await node('input').hover(); assert.equal(await page.locator('.dds-token').count(),1);
  assert.equal(await page.getByRole('button',{name:'종료',exact:true}).count(),0);
  await page.mouse.move(1290,1190); assert.equal(await page.locator('.dds-token').count(),0); checks.push('Hover playback and leave-to-stop without playback buttons');
  await node('input').hover(); await page.clock.runFor(await page.evaluate(()=>IR.edges.filter(e=>!e.loop).length*1800+1000)); assert.equal(await page.locator('.dds-token').count(),0); checks.push('finite completion');
  await page.goto(pathToFileURL(outputPath(path.join(dir,'l0'),'html')).href); await node('task').hover(); assert.equal(await page.locator('.is-focus').count(),0); assert.equal(await page.getByRole('button',{name:/접기|펼치기/}).count(),0); checks.push('L0 no dimming or folding');
  await page.screenshot({path:path.join(dir,'l0.png'),fullPage:true});
  // Folding is view-only: a real parent/child group is exercised through the generated controls.
  const partial=structuredClone(parts[0]); partial.nodes.push({id:'group',label:'분석 부분',role:'process',x:200,y:530,expandAt:1,drawRegion:true,source:'request'});
  partial.nodes.filter(n=>/^a[0-3]$/.test(n.id)).forEach(n=>n.parent='group');
  writeFileSync(path.join(dir,'fold.json'),JSON.stringify(partial)); finalize('fold.json','fold');
  await page.goto(pathToFileURL(outputPath(path.join(dir,'fold'),'html')).href);
  await page.getByRole('button',{name:'접기: 분석 부분',exact:true}).click(); assert.equal(await node('a1').count(),0); assert.equal(await node('group').count(),1);
  await node('group').hover(); assert.ok(await page.locator('.dds-edge.on').count() > 0); assert.equal(await node('input').evaluate(e=>e.classList.contains('on')),true); checks.push('collapsed summary keeps partial scope');
  await page.getByRole('button',{name:'펼치기: 분석 부분',exact:true}).click(); assert.equal(await node('a1').count(),1); checks.push('partial folding round trip');
  await page.getByRole('button',{name:'접기: 분석 부분',exact:true}).click(); await page.locator('.dds-plus').click(); assert.equal(await node('a1').count(),1); checks.push('inline expand affordance');
  await page.goto(pathToFileURL(outputPath(path.join(dir,'full'),'html')).href);
  await page.emulateMedia({reducedMotion:'reduce'}); await node('input').focus(); assert.equal(await page.locator('.dds-token').count(),1); await page.clock.runFor(2000); assert.equal(await page.locator('.dds-token text').textContent(),'준비된 자료'); await node('a1').focus(); assert.equal(await page.locator('.dds-token').count(),0); checks.push('reduced-motion keyboard start and cancellation');
  const projected=structuredClone(full); projected.nodes.push({id:'all',label:'Fold both branches',role:'process',x:500,y:530,expandAt:2}); projected.nodes.filter(n=>/^[ab][0-3]$/.test(n.id)).forEach(n=>n.parent='all');
  await page.evaluate(ir=>{ const host=document.getElementById('host'); host.innerHTML=DDS.render(ir,{level:1,fit:true}).svg; DDSWorkflow.attach(host,ir,{level:1}); },projected);
  await page.locator('.dds-edge[data-from="ready"][data-to="all"]').focus(); assert.equal(await node('aout').evaluate(e=>e.classList.contains('on')),true); assert.equal(await node('bout').evaluate(e=>e.classList.contains('on')),true); checks.push('projected shared edge unions both partials');
  assert.deepEqual(errors,[]); writeFileSync(path.join(dir,'browser-results.json'),JSON.stringify({checks,errors},null,2)); console.log(JSON.stringify({checks,errors},null,2));
} finally { await browser.close(); }

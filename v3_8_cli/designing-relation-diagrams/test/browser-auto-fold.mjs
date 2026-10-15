import {outputPath} from './output-path.mjs';
// Real-browser check against the generated project fixture. Author: chatgpt_gpt6.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url), {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir=path.resolve(process.argv[2]);
const browser=await chromium.launch({headless:true,...(process.env.DDS_BROWSER?{executablePath:process.env.DDS_BROWSER}:{})});
const page=await browser.newPage({viewport:{width:1200,height:1200}}), errors=[];
page.on('pageerror',e=>errors.push(e.message));
const node=id=>page.locator(`.dds-node[data-id="${id}"]`);
try {
  await page.goto(pathToFileURL(outputPath(path.join(dir,'L1-full'),'html')).href);
  assert.equal(await page.getByRole('button',{name:/재생/}).count(),0);
  assert.equal(await page.locator('.dds-node').count(),11);
  const original = await page.locator('.dds-node').evaluateAll(ns=>ns.map(n=>[n.dataset.id,n.textContent]));
  assert.equal(await page.getByRole('button',{name:'접기: 사업정보 분석',exact:true}).count(),1);
  await page.screenshot({path:path.join(dir,'L1-full-expanded.png'),fullPage:true});
  await node('budget-source').hover();
  assert.equal(await page.locator('.dds-token').count(),1);
  await page.getByRole('button',{name:'접기: 사업정보 분석',exact:true}).click();
  assert.equal(await page.locator('.dds-token').count(),0);
  assert.equal(await page.locator('.dds-node').count(),3);
  assert.equal(await node('budget-source').count(),1); assert.equal(await node('review-result').count(),1);
  assert.equal(await page.locator('.dds-node').filter({hasText:'사업정보 분석'}).count(),1);
  await page.screenshot({path:path.join(dir,'L1-full-collapsed.png'),fullPage:true});
  await page.getByRole('button',{name:'펼치기: 사업정보 분석',exact:true}).click();
  assert.equal(await page.locator('.dds-node').count(),11);
  assert.deepEqual(await page.locator('.dds-node').evaluateAll(ns=>ns.map(n=>[n.dataset.id,n.textContent])),original);

  await page.goto(pathToFileURL(outputPath(path.join(dir,'L1-partial'),'html')).href);
  assert.equal(await page.locator('.dds-node').count(),3);
  assert.equal(await page.getByRole('button',{name:'펼치기: 사업정보 분석',exact:true}).count(),1);
  await page.getByRole('button',{name:'펼치기: 사업정보 분석',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:/재생|종료/}).count(),0);
  await node('budget-source').hover();
  assert.equal(await page.locator('.dds-token').count(),0);
  await node('budget-source').focus();
  assert.equal(await page.locator('.dds-token').count(),0);
  assert.equal(await page.locator('.dds-node').count(),7);
  assert.equal(await page.getByRole('button',{name:'접기: 사업정보 분석',exact:true}).count(),1);
  await page.getByRole('button',{name:'접기: 사업정보 분석',exact:true}).click();
  assert.equal(await page.locator('.dds-node').count(),3);
  assert.equal(await node('budget-source').count(),1); assert.equal(await node('project-records').count(),1);
  await page.screenshot({path:path.join(dir,'L1-partial-collapsed.png'),fullPage:true});
  await page.getByRole('button',{name:'펼치기: 사업정보 분석',exact:true}).click();
  assert.equal(await page.locator('.dds-node').count(),7);

  await page.goto(pathToFileURL(outputPath(path.join(dir,'L0'),'html')).href);
  assert.equal(await page.locator('.dds-node').count(),3);
  assert.equal(await page.getByRole('button',{name:/접기|펼치기/}).count(),0);
  assert.equal(await page.getByRole('button').count(),0);
  await node('budget-source').hover();
  assert.equal(await page.locator('.dds-token').count(),0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({author:'chatgpt_gpt6',checks:['full 11->3->11','partial 7->3->7','restored node IDs and labels','fold cancels playback','L0 has no controls or playback'],errors},null,2));
} finally { await browser.close(); }

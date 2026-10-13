// Main-run browser check for the actual v3.9 budget example. Author: chatgpt_gpt6.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url), {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=path.resolve(process.argv[2]), checks=[], errors=[];
const browser=await chromium.launch({headless:true,...(process.env.DDS_BROWSER?{executablePath:process.env.DDS_BROWSER}:{})});
try {
 const page=await browser.newPage({viewport:{width:1100,height:1200}});
 page.on('pageerror',e=>errors.push(e.message)); await page.clock.install();
 const open=async name=>page.goto(pathToFileURL(path.join(dir,name,'diagram.html')).href);
 const node=id=>page.locator(`.dds-node[data-id="${id}"]`);
 for(const [name,count] of [['Function_Definition',3],['Process_Summary',4]]) {
  await open(name); assert.equal(await page.locator('.dds-node').count(),count);
  assert.equal(await page.getByRole('button').count(),0); assert.equal(await page.locator('.dds-edge-label').count(),0);
  await node('budget-source').hover(); assert.equal(await page.locator('.dds-token').count(),0); assert.equal(await page.locator('.is-focus').count(),0);
  checks.push(name+': static, E2E entities only, no edge labels');
 }
 for(const [name,count] of [['Process_Core_Preprocessing',7],['Process_Core_Analysis',5]]) {
  await open(name); assert.equal(await page.locator('.dds-node').count(),3);
  await page.locator('.dds-plus').click(); assert.equal(await page.locator('.dds-node').count(),count);
  await page.locator('.dds-node').first().hover(); assert.equal(await page.locator('.dds-token').count(),0);
  assert.equal(await page.getByRole('button',{name:/재생|종료/}).count(),0);
  checks.push(name+': initially collapsed, expands with intermediate data, no playback');
 }
 await open('Process_Full'); assert.equal(await page.locator('.dds-node').count(),5);
 assert.equal(await node('project-records').count(),1);
 assert.equal(await page.locator('.dds-plus').count(),2);
 await page.screenshot({path:path.join(dir,'full-collapsed.png'),fullPage:true});
 await page.locator('.dds-plus').first().click(); assert.equal(await page.locator('.dds-node').count(),9);
 await page.locator('.dds-plus').click(); assert.equal(await page.locator('.dds-node').count(),11);
 await node('parse-document').hover(); assert.equal(await node('search-similar').evaluate(n=>n.classList.contains('on')),false);
 await node('project-records').hover(); assert.equal(await node('parse-document').evaluate(n=>n.classList.contains('on')),true); assert.equal(await node('search-similar').evaluate(n=>n.classList.contains('on')),true);
 assert.equal(await page.locator('.dds-token').count(),0); checks.push('Full shared/unique Core focus and intermediate input does not play');
 await node('budget-source').hover(); assert.equal(await page.locator('.dds-token').count(),1);
 const first=await page.locator('.dds-token text').textContent(); await page.clock.runFor(2000);
 assert.notEqual(await page.locator('.dds-token text').textContent(),first);
 await page.screenshot({path:path.join(dir,'full-token.png'),fullPage:true});
 await node('parse-document').hover(); assert.equal(await page.locator('.dds-token').count(),0);
 await page.clock.runFor(1500); assert.equal(await page.locator('.dds-token').count(),0);
 assert.equal(await page.getByRole('button',{name:/재생|종료/}).count(),0);
 checks.push('Full initial-input Hover starts changing state tokens; new Hover cancels, no Play/Stop');
 await page.getByRole('button',{name:'모두 접기',exact:true}).click(); assert.equal(await page.locator('.dds-node').count(),5);
 await page.reload(); assert.equal(await page.locator('.dds-node').count(),5);
 checks.push('Full 5 -> 9 -> 11 -> 5; reload remains collapsed');
 assert.deepEqual(errors,[]);
 writeFileSync(path.join(dir,'browser-results.json'),JSON.stringify({author:'chatgpt_gpt6',checks,errors},null,2));
 console.log(JSON.stringify({checks,errors},null,2));
} finally {await browser.close();}

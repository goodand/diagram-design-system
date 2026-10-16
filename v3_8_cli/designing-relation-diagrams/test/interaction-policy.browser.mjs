import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {renderSvg,renderHtml}=await import(process.env.DRD_TEST_RENDER_MODULE
 ? pathToFileURL(path.resolve(process.env.DRD_TEST_RENDER_MODULE)).href
 : new URL('../scripts/lib/render.mjs',import.meta.url).href);

// Explicit browser suite; absent prerequisites fail instead of silently skipping.
const {chromium}=createRequire(import.meta.url)(process.env.DRD_PLAYWRIGHT_MODULE||'playwright');
const node=(id,role,x,y,extra={})=>({id,label:id,role,x,y,...extra});
function graph(type){return {id:'policy',version:'1',diagram_type:type,w:600,h:600,
 nodes:[node('in','entity',300,60),node('group','process',300,250,{expandAt:2}),node('step','process',300,250,{parent:'group'}),node('out','entity',300,450)],
 edges:[{id:'a',from:'in',to:'step',meaning:'execution_flow'},{id:'b',from:'step',to:'out',meaning:'execution_flow'}],
 e2e:{inputs:['in'],outputs:['out']},flow:{a:'received',b:'processed'},partials:[{id:'part',nodes:['in','step','out'],edges:['a','b']}]};}

for(const type of ['l1_partial','l1_full'])test(`${type}: folding and focus policy in actual HTML`,async()=>{
 const browser=await chromium.launch({...(process.env.DRD_CAPTURE_CHANNEL?{channel:process.env.DRD_CAPTURE_CHANNEL}:{}),headless:true});
 try{
  const dir=mkdtempSync(path.join(tmpdir(),'dds-policy-')),file=path.join(dir,'view.html'),ir=graph(type);
  writeFileSync(file,renderHtml(renderSvg(ir,{level:1,pad:24}),JSON.stringify(ir),{level:1}));
  const page=await browser.newPage({viewport:{width:900,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(file).href);
  const full=type==='l1_full';
  for(const expanded of [false,true]){
   if(expanded)await page.locator('.dds-plus').click();
   await page.locator('.dds-node[data-id="in"]').hover();
   assert.equal(await page.locator('svg.is-focus').count(),full?1:0);
   assert.equal(await page.locator('.dds-token').count(),full?1:0);
   await page.mouse.move(895,795);
   assert.equal(await page.locator('svg.is-focus,.dds-token').count(),0);
   // Focus handler verification, separately from physical edge hit testing.
   await page.locator('.dds-edge').first().dispatchEvent('focus');
   assert.equal(await page.locator('svg.is-focus').count(),full?1:0);
   await page.locator('.dds-edge').first().dispatchEvent('blur');
  }
  await page.getByRole('button',{name:full?'모두 접기':'접기: group',exact:true}).click();
  assert.equal(await page.locator('.dds-plus').count(),1);
  assert.equal(await page.locator('svg.is-focus,.dds-token').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('Full shared boundary uses union; either unique Process preserves exact membership',async()=>{
 const browser=await chromium.launch({...(process.env.DRD_CAPTURE_CHANNEL?{channel:process.env.DRD_CAPTURE_CHANNEL}:{}),headless:true});
 try{
  const ids=['input','first','shared','second','output'];
  const edges=ids.slice(1).map((to,i)=>({id:'e'+i,from:ids[i],to,meaning:'execution_flow'}));
  const ir={id:'union-policy',version:'1',diagram_type:'l1_full',w:600,h:650,
   nodes:ids.map((id,i)=>node(id,i%2?'process':'entity',300,60+i*125)),edges,
   flow:Object.fromEntries(edges.map(e=>[e.id,'state'])),e2e:{inputs:['input'],outputs:['output']},
   partials:[{id:'A',nodes:['input','first','shared'],edges:['e0','e1']},{id:'B',nodes:['shared','second','output'],edges:['e2','e3']}]};
  const dir=mkdtempSync(path.join(tmpdir(),'dds-union-')),file=path.join(dir,'view.html');
  writeFileSync(file,renderHtml(renderSvg(ir,{level:2,pad:24}),JSON.stringify(ir),{level:2}));
  const page=await browser.newPage({viewport:{width:900,height:800}});await page.goto(pathToFileURL(file).href);
  const expectations={first:['input','first','shared','output'],second:['input','shared','second','output'],shared:ids};
  for(const [id,expected]of Object.entries(expectations)){
   await page.locator(`.dds-node[data-id="${id}"]`).hover();
   const actual=await page.locator('.dds-node.on').evaluateAll(ns=>ns.map(n=>n.dataset.id).sort());
   assert.deepEqual(actual,[...expected].sort(),`node membership for ${id}`);
   const expectedEdges=id==='first'?['e0','e1']:id==='second'?['e2','e3']:edges.map(e=>e.id);
   const activeEdges=await page.locator('.dds-edge.on').evaluateAll(es=>es.map(e=>Number(e.dataset.i)).sort());
   assert.deepEqual(activeEdges,expectedEdges.map(e=>Number(e.slice(1))).sort(),`edge membership for ${id}`);
  }
 }finally{await browser.close();}
});

test('Full 100% view preserves scale across folding and exposes output by scrolling',async()=>{
 const browser=await chromium.launch({...(process.env.DRD_CAPTURE_CHANNEL?{channel:process.env.DRD_CAPTURE_CHANNEL}:{}),headless:true});
 try{
  const ir=graph('l1_full'),dir=mkdtempSync(path.join(tmpdir(),'dds-view-size-')),file=path.join(dir,'view.html');
  writeFileSync(file,renderHtml(renderSvg(ir,{level:1,pad:24}),JSON.stringify(ir),{level:1}));
  const page=await browser.newPage({viewport:{width:400,height:360}});await page.goto(pathToFileURL(file).href);
  await page.getByRole('button',{name:'100%',exact:true}).click();
  const scale=()=>page.locator('#host>svg').evaluate(s=>s.getScreenCTM().a);
  assert.ok(Math.abs(await scale()-1)<0.01);
  await page.getByRole('button',{name:'모두 펼치기',exact:true}).click();
  await page.waitForFunction(()=>Math.abs(document.querySelector('#host>svg').getScreenCTM().a-1)<0.01);
  const output=page.locator('.dds-node[data-id="out"]');await output.scrollIntoViewIfNeeded();
  const visible=await output.evaluate(n=>{const a=n.getBoundingClientRect(),h=document.getElementById('host'),b=h.getBoundingClientRect();return {within:a.top>=b.top&&a.bottom<=b.bottom&&a.left>=b.left&&a.right<=b.right,scrolled:h.scrollTop>0};});
  assert.deepEqual(visible,{within:true,scrolled:true});
  await page.getByRole('button',{name:'모두 접기',exact:true}).click();
  await page.waitForFunction(()=>Math.abs(document.querySelector('#host>svg').getScreenCTM().a-1)<0.01);
  await page.getByRole('button',{name:'전체 맞춤',exact:true}).click();
  assert.ok(await scale()<1);
  assert.equal(await page.locator('#host').evaluate(h=>h.scrollTop),0);
 }finally{await browser.close();}
});

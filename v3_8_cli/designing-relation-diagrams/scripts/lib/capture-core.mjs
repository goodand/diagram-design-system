// Author: chatgpt_gpt6. Capture the actual Human HTML, never redraw its JSON.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function captureCore({html,out,width=1200,height=900,channel=process.env.DRD_CAPTURE_CHANNEL}) {
 if(!html||!out)throw Error('HTML and new output directory required');
 if(fs.existsSync(out))throw Error('Output directory exists; use a new directory');
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||height<240)throw Error('Invalid viewport');
 const source=fs.readFileSync(html),require=createRequire(import.meta.url);
 let chromium;try{({chromium}=require(process.env.DRD_PLAYWRIGHT_MODULE||'playwright'));}catch{throw Error('Install playwright or set DRD_PLAYWRIGHT_MODULE to its module path');}
 const browser=await chromium.launch({headless:true,...(channel?{channel}:{})});
 const m={author:'chatgpt_gpt6',audience:'ToolUsingAgent or ToolDeveloperAgent',source:path.resolve(html),sourceSha256:sha(source),viewport:{width,height},deviceScaleFactor:1,browser:browser.version(),states:[],status:'INCOMPLETE',imageRead:'PENDING'};
 try{
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('crash',()=>errors.push('Page crashed'));
  await page.route(/^https?:/,route=>route.abort());
  await page.goto(pathToFileURL(path.resolve(html)).href);
  if(!await page.evaluate(()=>['l1_partial','Process_Core'].includes(globalThis.IR?.diagram_type)))throw Error('Expected Core Human_View HTML');
  await page.locator('#host svg').waitFor();await page.evaluate(()=>document.fonts.ready);
  m.core=await page.evaluate(()=>({id:IR.id,version:IR.version,runtimeType:IR.diagram_type,sourceNodes:IR.nodes.map(n=>n.id)}));
  fs.mkdirSync(out,{recursive:true});
  for(const [state,button] of [['collapsed','모두 접기'],['expanded','모두 펼치기']]){
   const control=page.getByRole('button',{name:button,exact:true});
   if(await control.count()===1)await control.click();
   else {
    const target=page.getByRole('button',{name:state==='collapsed'?/^접기: /:/^펼치기: /});
    const opposite=page.getByRole('button',{name:state==='collapsed'?/^펼치기: /:/^접기: /});
    if(await target.count()+await opposite.count()===0)throw Error('Expected Core fold controls');
    let steps=0;while(await target.count()) {if(++steps>100)throw Error('Fold transition did not settle');await target.first().click();}
   }
   await page.mouse.move(0,0);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   if(errors.length)throw Error(errors.join('\n'));
   const observed=await page.evaluate(()=>({nodes:[...document.querySelectorAll('#host .dds-node')].map(n=>n.dataset.id),buttons:[...document.querySelectorAll('button')].map(n=>n.textContent),tokens:document.querySelectorAll('.dds-token').length,focus:!!document.querySelector('svg.is-focus'),scale:visualViewport?.scale||1,svgViewBox:document.querySelector('#host svg').getAttribute('viewBox')}));
   if(observed.tokens||observed.focus)throw Error('Static capture has residual animation/focus');
   const image=`core.human.${state}.png`;await page.screenshot({path:path.join(out,image)});
   m.states.push({state,image,sha256:sha(fs.readFileSync(path.join(out,image))),...observed});
  }
  if(sha(fs.readFileSync(html))!==m.sourceSha256)throw Error('HTML changed while capturing');
  if(JSON.stringify(m.states[0].nodes)===JSON.stringify(m.states[1].nodes))throw Error('Fold states did not change visible content');
  const hierarchy=await page.evaluate(()=>IR.nodes.some(n=>n.expandAt!==undefined||n.parent));
  if(!hierarchy&&JSON.stringify([...m.states[1].nodes].sort())!==JSON.stringify([...m.core.sourceNodes].sort()))throw Error('Expanded Core source nodes missing');
  m.status='GENERATED_IMAGE_READ_REQUIRED';return m;
 }catch(e){m.error=e.message;throw e;}
 finally{if(fs.existsSync(out))fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify(m,null,2));await browser.close();}
}

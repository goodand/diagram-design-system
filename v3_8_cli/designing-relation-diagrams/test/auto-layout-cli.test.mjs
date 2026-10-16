import {test} from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const cli=fileURLToPath(new URL('../scripts/drd.mjs',import.meta.url));
test('coordinate-free Function finalize uses common auto layout and preserves source',()=>{
 const dir=fs.mkdtempSync(path.join(tmpdir(),'dds-auto-cli-'));
 const ir={id:'f',version:'1',diagram_type:'Function_Definition',nodes:[{id:'in',role:'entity',label:'입력'},{id:'p',role:'process',label:'변환'},{id:'out',role:'entity',label:'출력'}],edges:[{id:'a',from:'in',to:'p',meaning:'execution_flow'},{id:'b',from:'p',to:'out',meaning:'execution_flow'}],e2e:{inputs:['in'],outputs:['out']},flow:{a:'원문',b:'결과'}};
 const src=path.join(dir,'source.json'),out=path.join(dir,'out'),bytes=JSON.stringify(ir);fs.writeFileSync(src,bytes);
 const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env:{...process.env,DRD_NO_PNG:'1'}});
 const result=run('finalize',src,'--out',out);assert.equal(result.status,0,result.stdout+result.stderr);
 const receipt=JSON.parse(fs.readFileSync(path.join(out,'receipt.json')));
 const html=fs.readFileSync(path.join(out,receipt.outputs.html.path),'utf8');assert.match(html,/"visible_layout_cache":\{/);
 assert.equal(fs.readFileSync(src,'utf8'),bytes);assert.equal(fs.readFileSync(path.join(out,'ir.json'),'utf8'),bytes);
 assert.equal(run('verify',out).status,0);
});

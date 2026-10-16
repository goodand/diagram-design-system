// Author: chatgpt_gpt6. No sibling experiment directories at destination.
import {test} from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
test('copied layout package renders without original experiment paths',()=>{
 const dest=fs.mkdtempSync(path.join(tmpdir(),'dds-layout-portable-'));
 fs.cpSync(fileURLToPath(new URL('../scripts',import.meta.url)),path.join(dest,'scripts'),{recursive:true});
 fs.writeFileSync(path.join(dest,'probe.mjs'),`import {renderIndependentCoreSvg} from './scripts/lib/render.mjs';
 const svg=await renderIndependentCoreSvg({diagram_type:'Process_Core',nodes:[{id:'a',label:'A',role:'process'},{id:'b',label:'B',role:'process'}],edges:[{id:'e',from:'a',to:'b'}]});
 if(!svg.includes('<svg')||svg.includes('NaN'))throw Error('Invalid portable render');`);
 const result=spawnSync(process.execPath,[path.join(dest,'probe.mjs')],{cwd:dest,encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});

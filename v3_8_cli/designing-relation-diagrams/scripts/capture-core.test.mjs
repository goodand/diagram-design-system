// Author: chatgpt_gpt6
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {captureCore} from './lib/capture-core.mjs';
test('capture real Core HTML states without changing source',async()=>{
 const html=process.env.CORE_HTML;assert(html,'CORE_HTML required');
 const before=fs.readFileSync(html),out=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'dds-capture-')),'result');
 const m=await captureCore({html,out,width:1200,height:900});
 assert.equal(m.states.length,2);assert(m.states[0].nodes.length<m.states[1].nodes.length);
 for(const s of m.states)assert(fs.statSync(path.join(out,s.image)).size>1000);
 assert.deepEqual(fs.readFileSync(html),before);
 await assert.rejects(()=>captureCore({html,out}),/exists/);
});
test('non-Core HTML fails instead of reporting screenshots as Core',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dds-capture-negative-'));
 const html=path.join(root,'wrong.html');fs.writeFileSync(html,'<script>var IR={diagram_type:"l1_full"}</script><div id="host"><svg></svg></div>');
 await assert.rejects(()=>captureCore({html,out:path.join(root,'out')}),/Core/);
});

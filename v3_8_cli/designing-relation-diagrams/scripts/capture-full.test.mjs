import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {captureFull} from './lib/capture-core.mjs';
test('Full enumerates all four flat Core states through actual HTML',async()=>{
 const html=process.env.FULL_HTML;assert(html);
 const before=fs.readFileSync(html),out=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'dds-full-')),'out');
 const m=await captureFull({html,out});
 assert.equal(m.states.length,4);assert.equal(m.expectedStates,4);
 assert.equal(new Set(m.states.map(s=>JSON.stringify([...s.nodes].sort()))).size,4);
 for(const s of m.states){assert(s.image.startsWith('full.human.'));assert(fs.statSync(path.join(out,s.image)).size>1000);}
 assert.deepEqual(fs.readFileSync(html),before);
});
test('nested fold depth explicitly deferred',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dds-depth-')),html=path.join(root,'nested.html');
 fs.writeFileSync(html,`<script>var IR={diagram_type:'l1_full',nodes:[{id:'a',expandAt:2},{id:'b',parent:'a',expandAt:2}],edges:[]};var DDS={withAutoFolds:x=>x};</script><div id="host"><svg></svg></div>`);
 await assert.rejects(()=>captureFull({html,out:path.join(root,'out')}),/Depth/);
});

// Author: chatgpt_gpt6. Verify reference integrity through the public CLI.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {linkedFixture} from './linked-fixture.mjs';
const cli=fileURLToPath(new URL('../scripts/drd.mjs',import.meta.url));
const run=(...a)=>spawnSync(process.execPath,[cli,...a],{encoding:'utf8',env:{...process.env,DRD_NO_PNG:'1'}});
test('CLI composes presentation only and verify rejects changed child bytes',()=>{
 const x=linkedFixture({simulation:true});
 x.parentFull.nodes.forEach((n,i)=>{n.x=300;n.y=80+i*180;});
 writeFileSync(x.parentPath,JSON.stringify(x.parentFull));
 writeFileSync(path.join(x.dir,'decisions.json'),JSON.stringify({decisions:x.decisions.map(d=>({...d,simulated:true}))}));
 const out=path.join(x.dir,'out'),result=run('finalize',x.parentPath,'--out',out);
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.equal(readFileSync(path.join(out,'ir.json'),'utf8'),readFileSync(x.parentPath,'utf8'));
 assert.match(readFileSync(path.join(out,'diagram.html'),'utf8'),/"linked_detail":true/);
 assert.equal(run('verify',out).status,0);
 const child=path.join(x.dir,x.child.fullRef.path);writeFileSync(child,readFileSync(child,'utf8')+' ');
 const invalid=run('verify',out);assert.notEqual(invalid.status,0);assert.match(invalid.stdout,/SHA-256 mismatch/);
});
test('CLI rejects linked_diagrams on a Function',()=>{
 const x=linkedFixture();const f={...x.child.f,linked_diagrams:[]},p=path.join(x.dir,'invalid.json');writeFileSync(p,JSON.stringify(f));
 const result=run('finalize',p,'--out',path.join(x.dir,'invalid-out'));
 assert.notEqual(result.status,0);assert.match(result.stdout,/requires Process_Full/);
});

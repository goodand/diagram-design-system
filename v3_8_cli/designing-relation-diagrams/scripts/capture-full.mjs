#!/usr/bin/env node
// Author: chatgpt_gpt6. Flat Full only; nested depth deferred.
import {captureFull} from './lib/capture-core.mjs';
const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];
try{
 if(!args.includes('--html')||!args.includes('--out'))throw Error('capture-full.mjs --html full.human.html --out NEW_DIR [--width 1200 --height 900]');
 const m=await captureFull({html:get('--html'),out:get('--out'),width:args.includes('--width')?Number(get('--width')):1200,height:args.includes('--height')?Number(get('--height')):900});
 console.log(`${m.status}: ${m.states.length}/${m.expectedStates} states`);
}catch(e){console.error(e.message);process.exitCode=1;}

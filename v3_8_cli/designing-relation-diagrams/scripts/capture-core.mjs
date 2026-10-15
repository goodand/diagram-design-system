#!/usr/bin/env node
// Author: chatgpt_gpt6
import {captureCore} from './lib/capture-core.mjs';
const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];
try{
 if(!args.includes('--html')||!args.includes('--out'))throw Error('capture-core.mjs --html core.human.html --out NEW_DIR [--width 1200 --height 900]');
 const result=await captureCore({html:get('--html'),out:get('--out'),width:args.includes('--width')?Number(get('--width')):1200,height:args.includes('--height')?Number(get('--height')):900});
 console.log(result.status);
}catch(e){console.error(e.message);process.exitCode=1;}

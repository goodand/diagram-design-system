// Read producer-owned paths instead of duplicating its naming convention.
import {readFileSync} from 'node:fs';
import path from 'node:path';
export function outputPath(dir,kind){
 const receipt=JSON.parse(readFileSync(path.join(dir,'receipt.json'),'utf8'));
 if(!receipt.outputs?.[kind]?.path)throw Error(`Missing ${kind} output in ${dir}`);
 return path.join(dir,receipt.outputs[kind].path);
}

// Append-only run log (.drd/log.jsonl next to the IR) so each boundary can be checked afterwards.
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
export const sha = (p) => existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : null;
export function logRun(irPath, entry) {
  const dir = path.join(path.dirname(path.resolve(irPath)), '.drd'); mkdirSync(dir, { recursive: true });
  appendFileSync(path.join(dir, 'log.jsonl'), JSON.stringify({ t: new Date().toISOString(), ir: path.basename(irPath), ir_sha: sha(irPath), ...entry }) + '\n');
}

import {readdir,readFile} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import assert from 'node:assert/strict';
// Compare actual --live artifacts against a separately built production baseline.
const baseline=resolve(process.argv[2]||'');
assert.ok(process.argv[2],'Pass the baseline release directory');
const current=resolve('release');let checked=0;
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await walk(path);else if(item.name!=='_worker.js'){const rel=relative(baseline,path);assert.deepEqual(await readFile(join(current,rel)),await readFile(path),rel+' changed');checked++;}}}
await walk(baseline);console.log(`PASS: ${checked} non-worker live files are byte-identical to the production baseline`);

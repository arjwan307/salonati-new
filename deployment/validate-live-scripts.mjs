import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {Script} from 'node:vm';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
let checks=0;
async function check(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=join(dir,f.name);if(f.isDirectory())await check(p);else if(f.name==='_worker.js'){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);checks++;}else if(f.name.endsWith('.js')){new Script(await readFile(p,'utf8'),{filename:p});checks++;}else if(f.name.endsWith('.html')){const html=await readFile(p,'utf8');for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!/src=|type=["'](?:module|application\/)/i.test(m[1])&&m[2].trim()){new Script(m[2],{filename:p});checks++;}}}}}
await check('release');console.log(`PASS: ${checks} generated live scripts and Workers parse`);

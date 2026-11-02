import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=await readFile(new URL('../workers/salonati-api/worker.mjs',import.meta.url),'utf8');
const provenance=JSON.parse(await readFile(new URL('../workers/salonati-api/source-provenance.json',import.meta.url),'utf8'));
const start=source.indexOf('const iconAssets='),end=source.indexOf('export default');assert.ok(start>=0&&end>start);
const assets=source.slice(start,end);assert.equal(Buffer.byteLength(assets),provenance.embedded_asset_block_utf8_bytes);
assert.equal(createHash('sha256').update(assets).digest('hex'),provenance.embedded_asset_block_sha256);
console.log(`PASS: ${Buffer.byteLength(assets)} embedded asset bytes exactly match the production snapshot`);

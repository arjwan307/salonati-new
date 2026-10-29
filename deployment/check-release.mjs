import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const entries = {customer:'apps/customer/index.html', salon:'index.html', admin:'index.html', cosmetics:'cosmetics/owner/index.html'};
let checks = 0;
for (const [role, entry] of Object.entries(entries)) {
  const dir = join(root, 'release', role);
  const html = await readFile(join(dir, 'index.html'), 'utf8');
  assert.equal(html, await readFile(join(root, 'google-apps', role, entry), 'utf8'), `${role}: approved HTML bytes changed`);
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, attrs, body] = match;
    if (!/src=|type=["'](?:module|application\/)/i.test(attrs) && body.trim()) {
      new Script(body, {filename: `${role}/inline-${checks}.js`}); checks++;
    }
  }
  for (const m of html.matchAll(/(?:src|href)=["'](\/[^"'#?]+)["']/gi)) {
    if (m[1].startsWith('//') || m[1].startsWith('/api/')) continue;
    if (!/\.(?:js|css|png|svg|webmanifest|ico|jpg|jpeg|webp)$/.test(m[1])) continue;
    await stat(join(dir,m[1])); checks++;
  }
  async function checkJs(dir) {
    for (const f of await readdir(dir, {withFileTypes:true})) {
      const p = join(dir,f.name);
      if (f.isDirectory()) await checkJs(p);
      else if (f.name.endsWith('.js')) { new Script(await readFile(p,'utf8'), {filename:p}); checks++; }
    }
  }
  await checkJs(dir);
  console.log(`${role}: source bytes, scripts and local entry assets verified`);
}
console.log(`${checks} release checks passed`);

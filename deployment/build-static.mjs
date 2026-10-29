import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// These exports render plain HTML/JS. Keep their approved bytes intact.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const entries = {
  customer: 'apps/customer/index.html',
  salon: 'index.html',
  admin: 'index.html',
  cosmetics: 'cosmetics/owner/index.html',
};
const role = process.argv[2];
if (!Object.hasOwn(entries, role)) throw new Error('Specify customer, salon, admin or cosmetics');
const source = resolve(root, 'google-apps', role);
const output = resolve(root, 'release', role);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(source, 'public'), output, {
  recursive: true,
  filter: p => !['.zip', '.bak', '.html'].includes(extname(p)),
});
await writeFile(resolve(output, 'index.html'), await readFile(resolve(source, entries[role])));
await writeFile(resolve(output, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Robots-Tag: noindex, nofollow\n');
// No SPA fallback for missing scripts/API paths; missing backend must stay visible.
await writeFile(resolve(output, '404.html'), '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>404</title><p>الصفحة غير موجودة</p></html>');
console.log(`Built ${role}: ${entries[role]} -> release/${role}/index.html`);

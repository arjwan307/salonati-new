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
if (process.argv.includes('--review')) {
  let html = await readFile(resolve(output, 'index.html'), 'utf8');
  html = html.replace('<head>', '<head><script>window.SALONATI_TRIAL=true;window.SALONATI_REVIEW=true</script>');
  const logout = "const f=document.createElement('form');f.method='POST';f.action='/review-logout';document.body.append(f);f.submit();return";
  if (role === 'admin') html = html.replace("if(window.SALONATI_TRIAL){location.reload();return}", `if(window.SALONATI_TRIAL){${logout}}`);
  await writeFile(resolve(output, 'index.html'), html);
  if (role === 'salon') {
    const path = resolve(output, 'owner-publishing.js');
    let js = await readFile(path, 'utf8');
    const old = "if(window.SALONATI_TRIAL){authChecking=false;account=null;authMode='login';render();return}";
    if (!js.includes(old)) throw new Error('Owner review session hook changed');
    js = js.replace(old, "if(window.SALONATI_TRIAL&&!window.SALONATI_REVIEW){authChecking=false;account=null;authMode='login';render();return}");
    js = js.replace('window.catalogOwnerLogout=async()=>{', `window.catalogOwnerLogout=async()=>{if(window.SALONATI_REVIEW){${logout}}`);
    await writeFile(path, js);
  }
  const worker = await readFile(resolve(root, 'deployment/review-worker.mjs'), 'utf8');
  await writeFile(resolve(output, '_worker.js'), worker.replaceAll('__APP_ROLE__', role));
}

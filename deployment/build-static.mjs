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
if (process.argv.includes('--live')) {
  let html = await readFile(resolve(output, 'index.html'), 'utf8');
  html = html.replace(/<script>window\.SALONATI_TRIAL=true<\/script>/g, '');
  if (role === 'admin') {
    html = html.replace('<label for="email">البريد الإلكتروني</label><input id="email" type="email"', '<label for="email">رقم الهاتف</label><input id="email" type="tel" inputmode="tel"');
    html = html.replace('البريد أو كلمة المرور غير صحيحة.', 'رقم الهاتف أو كلمة المرور غير صحيحة.');
  }
  if (role === 'customer') {
    html = html.replace('</body>', '<script src="/loyalty-ui.js"></script><script src="/salonati-link.js"></script></body>');
  }
  if (role === 'salon') {
    const file = resolve(output, 'owner-publishing.js');
    let js = await readFile(file, 'utf8');
    js = js.replaceAll('البريد الإلكتروني', 'رقم الهاتف')
      .replaceAll('id="catalogEmail" type="email"', 'id="catalogEmail" type="tel" inputmode="tel"')
      .replaceAll('placeholder="salon@example.com"', 'placeholder="07xxxxxxxxx"')
      .replaceAll('minlength="4"', 'minlength="10"')
      .replaceAll('value="12345678"', '')
      .replace("const defaultEmail=account?.email||savedAcc?.email||'maryam@salonati.iq';", "const defaultEmail=account?.phone||'';")
      .replace("esc(account?.email||savedAcc?.email||'')", "esc(account?.phone||'')");
    await writeFile(file, js);
  }
  await writeFile(resolve(output, 'index.html'), html);
  const worker = await readFile(resolve(root, 'deployment/live-worker.mjs'), 'utf8');
  await writeFile(resolve(output, '_worker.js'), worker.replaceAll('__APP_ROLE__', role));
}

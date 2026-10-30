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
if (!process.argv.includes('--live') && !process.argv.includes('--review')) {
  // The generated store asset remains available in the standalone preview too.
}
await writeFile(resolve(output, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Robots-Tag: noindex, nofollow\n');
// No SPA fallback for missing scripts/API paths; missing backend must stay visible.
// Local offline records live in IndexedDB, scoped to both application and signed-in account.
// Never cache credentials or grant server permissions from local state.
const offlineDatabaseSource = String.raw`
(()=>{'use strict';
const role=__ROLE__;
const account=String(window.SALONATI_ACCOUNT_ID||'guest');
const name='salonati-offline-'+role+'-'+account;
const ready=new Promise((resolve,reject)=>{
 if(!('indexedDB' in window)){reject(Error('offline_database_unavailable'));return;}
 const request=indexedDB.open(name,1);
 request.onupgradeneeded=()=>{const db=request.result;
   if(!db.objectStoreNames.contains('records'))db.createObjectStore('records',{keyPath:'key'});
   if(!db.objectStoreNames.contains('outbox'))db.createObjectStore('outbox',{keyPath:'id',autoIncrement:true});
 };
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(request.error);
});
const transact=async(store,mode,operation)=>{const db=await ready;return new Promise((resolve,reject)=>{
 const tx=db.transaction(store,mode),req=operation(tx.objectStore(store));
 req.onsuccess=()=>resolve(req.result);
 req.onerror=()=>reject(req.error);
 tx.onabort=()=>reject(tx.error||Error('offline_write_failed'));
});};
const key=(kind,id)=>{if(!/^[a-zA-Z0-9_-]{1,50}$/.test(kind))throw Error('invalid_kind');return kind+':'+String(id)};
const local={
 ready,
 get:async(kind,id)=>{const row=await transact('records','readonly',s=>s.get(key(kind,id)));return row?.data??null},
 list:async(kind)=>{const rows=await transact('records','readonly',s=>s.getAll());return rows.filter(x=>x.kind===kind).map(x=>x.data)},
 put:async(kind,id,data)=>{if(account==='guest')throw Error('account_required');return transact('records','readwrite',s=>s.put({key:key(kind,id),kind,data,updatedAt:Date.now()}))},
 remove:async(kind,id)=>transact('records','readwrite',s=>s.delete(key(kind,id))),
 clear:async(kind)=>{const rows=await local.list(kind);for(const row of rows){if(row&&row.id!=null)await local.remove(kind,row.id)}},
};
Object.defineProperty(window,'salonatiLocalDB',{value:Object.freeze(local),configurable:false});
ready.catch(()=>{});
})();
`.replace('__ROLE__',JSON.stringify(role));
await writeFile(resolve(output,'salonati-offline-db.js'),offlineDatabaseSource);
await writeFile(resolve(output, '404.html'), '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>404</title><p>الصفحة غير موجودة</p></html>');
console.log(`Built ${role}: ${entries[role]} -> release/${role}/index.html`);
if (process.argv.includes('--live') || process.argv.includes('--review')) {
  const review=process.argv.includes('--review');
  let html = await readFile(resolve(output, 'index.html'), 'utf8');
  html = html.replace(/<script>window\.SALONATI_TRIAL=true<\/script>/g, '');
  if(review)html=html.replace('<head>','<head><script>window.SALONATI_TRIAL=true;window.SALONATI_REVIEW=true</script>');
  if (role === 'admin') {
    html = html.replace('<label for="email">البريد الإلكتروني</label><input id="email" type="email"', '<label for="email">رقم الهاتف</label><input id="email" type="tel" inputmode="tel"');
    html = html.replace('البريد أو كلمة المرور غير صحيحة.', 'رقم الهاتف أو كلمة المرور غير صحيحة.');
    if(review)html=html.replace("if(window.SALONATI_TRIAL){location.reload();return}", "if(window.SALONATI_TRIAL){const f=document.createElement('form');f.method='POST';f.action='/review-logout';document.body.append(f);f.submit();return}");
    if(review)html=html.replace('</body>', '<script>function mountReviewExit(){const box=document.getElementById("account");if(user&&!document.getElementById("reviewExit")){const b=document.createElement("button");b.id="reviewExit";b.textContent="تسجيل الخروج";b.onclick=()=>{const f=document.createElement("form");f.method="POST";f.action="/review-logout";document.body.append(f);f.submit()};box.append(b)}}new MutationObserver(mountReviewExit).observe(document.getElementById("account"),{childList:true});mountReviewExit();</script></body>');
  }
  if (role === 'customer') {
    html = html.replace('localStorage.getItem(k)', "localStorage.getItem('salonati:'+window.SALONATI_ACCOUNT_ID+':'+k)")
      .replace('localStorage.setItem(k,JSON.stringify(v))', "localStorage.setItem('salonati:'+window.SALONATI_ACCOUNT_ID+':'+k,JSON.stringify(v))")
      .replace("bookings:get('salonati_bookings',[])", 'bookings:[]')
      .replace("isLoggedIn:get('salonati_logged_in',false)", 'isLoggedIn:true');
    const productStart=html.indexOf('const cosmeticProducts = [');
    const productEnd=html.indexOf('\n];',productStart);
    if(productStart<0||productEnd<0)throw new Error('Customer product array changed');
    html=html.slice(0,productStart)+'const cosmeticProducts = [];'+html.slice(productEnd+3);
    for(const field of ['cs.name','cs.img','cs.region','cs.offer','cs.discount','p.img','p.name','p.desc']) html=html.replaceAll('${'+field+'}', '${esc('+field+')}');
    html=html.replace('if(prods.length === 0) prods = cosmeticProducts.slice(0, 3);','')
      .replace('★ 4.9 (142 تقييم)','بيانات المتجر')
      .replace('🕒 أوقات العمل: 8:00 صباحاً – 10:00 ليلاً (مفتوح الآن)','🕒 أوقات العمل: ${esc(cs.openTime)} – ${esc(cs.closeTime)}')
      .replace('onclick="notify(\'جاري فتح محادثة واتساب مع ${esc(cs.name)}...\')"','onclick="salonatiCosmeticsWhatsApp(\'${cs.id}\')"')
      .replace('onclick="notify(\'✓ تم حفظ المتجر في مفضلة المتاجر\')"','onclick="salonatiFavoriteCosmetics(\'${cs.id}\')"');
    if(!html.includes('تم إرسال طلب مشتريات الكوزمتك بنجاح'))throw new Error('Cosmetics checkout hook changed');
    html=html.replace(/onclick="notify\('✓ تم إرسال طلب مشتريات الكوزمتك[^\"]*"/,'onclick="salonatiCosmeticsCheckout()"');
    await cp(resolve(root,'deployment/cosmetics-customer-live.js'),resolve(output,'cosmetics-customer-live.js'));
    html = html.replace('</body>', '<script src="/loyalty-ui.js"></script><script src="/salonati-link.js"></script><script src="/cosmetics-customer-live.js"></script><script>window.salonatiCustomerLogout=async()=>{try{const r=await fetch("/api/link/customer/logout",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:"{}"});if(!r.ok)throw Error("تعذر تسجيل الخروج");location.reload()}catch(e){notify(e.message)}};</script></body>');
    if(review)html=html.replace('fetch("/api/link/customer/logout",','fetch("/review-logout",');
  }
  if(role==='cosmetics'){
    html=html.replace('<h1 id="storeTitle">روز كوزمتك</h1>', '<h1 id="storeTitle">صالوناتي كوزمتك</h1>');
    const file=resolve(output,'cosmetics/owner/app.js');
    let js=await readFile(file,'utf8');
    js=js.replace("const KEY = 'salonati-cosmetics-owner-v2';", "const KEY = 'salonati-cosmetics-owner-v2:'+window.SALONATI_ACCOUNT_ID;")
    // Live/review accounts load their records from the server, never stale browser demo storage.
    js=js.replace('db = JSON.parse(localStorage.getItem(KEY)) || structuredClone(initial);','db = structuredClone(initial);')
      .replace('let db;', "initial.store={name:'',area:'',address:'',phone:'',openTime:'8:00 ص',closeTime:'10:00 م',about:'',lat:'',lng:'',active:false};initial.products=[];initial.offers=[];initial.orders=[];\nlet db;")
      .replace(/const save = \(\) => \{[\s\S]*?\n\};/, 'const save=async()=>persistCosmetics();');
    const imageStart=js.indexOf('function handleImageUpload(e) {'),imageEnd=js.indexOf('function startEdit(',imageStart);
    if(imageStart<0||imageEnd<0)throw new Error('Cosmetics image handler changed');
    js=js.slice(0,imageStart)+'async function handleImageUpload(e){return uploadCosmeticsImage(e);}\n\n'+js.slice(imageEnd);
    for(const name of ['saveProductData','deleteProduct','saveOffer','deleteOffer','saveStore','updateOrder'])js=js.replace('function '+name+'(', 'async function '+name+'(');
    js=js.replace('    pos => {','    async pos => {').replaceAll('save();','if(!await save())return;')
      .replace('p.stock = stock || 1;', 'p.stock = stock;').replace('stock: stock || 1,', 'stock: stock,')
      .replace('✓ تمت إضافة المنتج ونشره في المتجر بنجاح 💄','تمت إضافة المنتج وإرساله لموافقة الإدارة')
      .replace('✓ تم تحديث بيانات المنتج بنجاح','تم حفظ تعديل المنتج للمراجعة')
      .replace('✓ تم نشر العرض الخاص بنجاح 🌟','تم إرسال العرض لموافقة الإدارة');
    const productSaveStart=js.indexOf('async function saveProductData()'),productSaveEnd=js.indexOf('async function deleteProduct(',productSaveStart);
    if(productSaveStart<0||productSaveEnd<0)throw new Error('Cosmetics product save changed');
    let productSave=js.slice(productSaveStart,productSaveEnd).replace("toast('تم حفظ تعديل المنتج للمراجعة');",'').replace("toast('تمت إضافة المنتج وإرساله لموافقة الإدارة');",'').replace('if(!await save())return;', "if(!await save())return;toast('تم حفظ المنتج وإرساله لموافقة الإدارة');");
    js=js.slice(0,productSaveStart)+productSave+js.slice(productSaveEnd);
    if(!/\nrender\(\);\s*$/.test(js))throw new Error('Cosmetics startup changed');
    js=js.replace(/\nrender\(\);\s*$/, '\n')+'\n'+await readFile(resolve(root,'deployment/cosmetics-owner-live.js'),'utf8')+'\nvoid restoreCosmetics();\n';
    await writeFile(file,js);
  }
  if(role==='admin'){
    await cp(resolve(root,'deployment/cosmetics-admin-live.js'),resolve(output,'cosmetics-admin-live.js'));
    html=html.replace('</body>','<script src="/cosmetics-admin-live.js"></script></body>');
  }
  if (role === 'salon') {
    html = html.replace("const KEY='salonati-owner-production-v1';", "const KEY='salonati-owner-production-v1:'+window.SALONATI_ACCOUNT_ID;");
    html = html.replace('<title>Remix صالوناتي - تجربة الزبونة</title>', '<title>صالوناتي | تطبيق الصالون</title>');
    const file = resolve(output, 'owner-publishing.js');
    let js = await readFile(file, 'utf8');
    js = js.replaceAll('البريد الإلكتروني', 'رقم الهاتف')
      .replaceAll('id="catalogEmail" type="email"', 'id="catalogEmail" type="tel" inputmode="tel"')
      .replaceAll('placeholder="salon@example.com"', 'placeholder="07xxxxxxxxx"')
      .replaceAll('minlength="4"', 'minlength="10"')
      .replaceAll('value="12345678"', '')
      .replace("const defaultEmail=account?.email||savedAcc?.email||'maryam@salonati.iq';", "const defaultEmail=account?.phone||'';")
      .replace("esc(account?.email||savedAcc?.email||'')", "esc(account?.phone||'')");
    if(review){
      js=js.replace("if(window.SALONATI_TRIAL){authChecking=false;account=null;authMode='login';render();return}", "if(window.SALONATI_TRIAL&&!window.SALONATI_REVIEW){authChecking=false;account=null;authMode='login';render();return}")
        .replace('window.catalogOwnerLogout=async()=>{', "window.catalogOwnerLogout=async()=>{if(window.SALONATI_REVIEW){const f=document.createElement('form');f.method='POST';f.action='/review-logout';document.body.append(f);f.submit();return}");
    }
    js = js.replace("page='home';await refresh();toast(submission?", "page='home';await refresh();location.reload();toast(submission?");
    const start = js.indexOf('window.salonAccountPage=()=>{');
    const end = js.indexOf('function authMarkup()', start);
    if (start < 0 || end < 0) throw new Error('Owner account screens changed');
    let auth = js.slice(start, end);
    auth = auth.replace(/const g=typeof getSalonGreetingInfo[^\n]+/, "const g={icon:'🌸',headline:'أهلاً بكِ في صالوناتي',sub:'سجّلي الدخول إلى حساب الصالون'};")
      .replace(/const salonImg=[^\n]+/, "const salonImg='/icons/icon-180.png';")
      .replaceAll("db.salon?.name||'الصالون'", "'صالوناتي'")
      .replaceAll("db.salon?.name||'صالون لؤلؤة بغداد'", "'حساب الصالون'")
      .replaceAll("db.salon?.area||'الكرادة'", "'دخول آمن'")
      .replace("+(typeof frontNotificationsMarkup==='function'?frontNotificationsMarkup(true):'')", '')
      .replaceAll("esc(db.salon?.name||'')", "''")
      .replaceAll("esc(db.salon?.area||'الكرادة')", "''")
      .replaceAll("esc(db.salon?.lat||'33.3128')", "''")
      .replaceAll("esc(db.salon?.lng||'44.4322')", "''")
      .replace("registrationFields({contactName:db.salon?.ownerName||'ست مريم',phone:db.salon?.phone||'',address:db.salon?.address||'',facadeUrl:db.salon?.image||''},true)", 'registrationFields({},true)');
    js = js.slice(0,start)+auth+js.slice(end);
    await writeFile(file, js);
  }
  html=html.replace('</head>','<script src="/salonati-offline-db.js" defer></script></head>');
  await writeFile(resolve(output, 'index.html'), html);
  const liveWorker=await readFile(resolve(root, 'deployment/live-worker.mjs'),'utf8');
  let worker = review?await readFile(resolve(root,'deployment/review-worker.mjs'),'utf8'):liveWorker;
  if(review){
    const normalizeStart=liveWorker.indexOf('function normalizePhone('),normalizeEnd=liveWorker.indexOf('async function registerPhone(');
    const allowedStart=liveWorker.indexOf('function allowed(path)'),allowedEnd=liveWorker.indexOf('export default',allowedStart);
    if([normalizeStart,normalizeEnd,allowedStart,allowedEnd].some(n=>n<0))throw new Error('Shared app boundary hooks changed');
    worker+='\n'+liveWorker.slice(normalizeStart,normalizeEnd)+'\n'+liveWorker.slice(allowedStart,allowedEnd);
  }
  const cosmeticsApi = await readFile(resolve(root, 'deployment/cosmetics-api.mjs'), 'utf8');
  await writeFile(resolve(output, '_worker.js'), worker.replaceAll('__APP_ROLE__', role)+'\n'+cosmeticsApi);
}

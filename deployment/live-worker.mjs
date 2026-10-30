// Live apps use the production API and its existing authenticated sessions.
const role = '__APP_ROLE__';
const backendAssets = new Set(['/salonati-link.js','/loyalty-ui.js','/vendor/qrcode.js','/vendor/jsQR.js']);
const customerEntry = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>حسابي | صالوناتي</title><style>body{margin:0;background:#f3ebfa;color:#38114f;font:16px Tahoma,sans-serif;display:grid;min-height:100dvh;place-items:center}main{width:min(85%,370px);background:white;padding:28px;border-radius:22px;box-shadow:0 8px 40px #6d3b8d22}label,input,button{display:block;box-sizing:border-box;width:100%;margin:14px 0}input,button{padding:14px;border:1px solid #dbc8eb;border-radius:12px;font:inherit}button{background:#652b91;color:white;cursor:pointer}.secondary{background:white;color:#652b91}#message{line-height:1.7}</style><main><h1>صالوناتي</h1><h2 id="title">تسجيل الدخول</h2><form id="auth"><div id="nameFields" hidden><label for="name">الاسم</label><input id="name" autocomplete="name" maxlength="100"></div><label for="phone">رقم الهاتف</label><input id="phone" type="tel" inputmode="tel" autocomplete="username" required><label for="password">كلمة المرور</label><input id="password" type="password" autocomplete="current-password" minlength="10" maxlength="128" required><p id="message" role="status"></p><button id="submit">دخول</button></form><button id="toggle" class="secondary" type="button">إنشاء حساب جديد</button></main><script>let mode='login';const form=document.getElementById('auth'),submit=document.getElementById('submit'),message=document.getElementById('message');document.getElementById('toggle').onclick=()=>{mode=mode==='login'?'register':'login';document.getElementById('nameFields').hidden=mode!=='register';document.getElementById('name').required=mode==='register';document.getElementById('password').autocomplete=mode==='register'?'new-password':'current-password';document.getElementById('title').textContent=submit.textContent=mode==='register'?'إنشاء حساب جديد':'تسجيل الدخول';document.getElementById('toggle').textContent=mode==='register'?'لديّ حساب — تسجيل الدخول':'إنشاء حساب جديد';message.textContent=''};form.onsubmit=async e=>{e.preventDefault();if(submit.disabled)return;submit.disabled=true;message.textContent='جارٍ التحقق…';try{const r=await fetch('/api/link/customer/'+mode,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:document.getElementById('phone').value,password:document.getElementById('password').value,name:document.getElementById('name').value})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(({invalid_credentials:'رقم الهاتف أو كلمة المرور غير صحيحة. إن لم يكن لديكِ حساب، اختاري إنشاء حساب جديد.',invalid_registration:'أدخلي الاسم ورقم هاتف صحيحاً وكلمة مرور من 10 أحرف على الأقل.',phone_already_registered:'هذا الرقم مسجل. اختاري تسجيل الدخول.',too_many_attempts:'محاولات كثيرة. حاولي بعد قليل.'})[d.error]||'تعذر الاتصال بالخدمة، حاولي مجدداً.');location.reload()}catch(e){message.textContent=e.message;submit.disabled=false}};</script></html>`;
function normalizePhone(value) {
  return String(value || '').replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[\s\u200e\u200f\u2066-\u2069()-]/g,'').replace(/^(?:\+964|00964)/,'0');
}
const asHex = bytes => Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,'0')).join('');
async function readLoginBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size=0;const chunks=[];
  while (true) {const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return null;}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}
}
async function registerPhone(request, env, url) {
  if (!['customer','salon','cosmetics'].includes(role)) return Response.json({error:'registration_unavailable'},{status:403});
  if (!env.IDENTITY_DB) return Response.json({error:'identity_not_configured'},{status:503});
  if (request.headers.get('origin') !== url.origin) return Response.json({error:'origin_denied'},{status:403});
  const d=await readLoginBody(request),phone=normalizePhone(d?.phone ?? d?.email);
  const name=String(d?.name ?? d?.salonName ?? '').trim();
  if (!/^07[0-9]{9}$/.test(phone) || name.length<2 || name.length>100 || /[\x00-\x1f<>]/.test(name) || typeof d?.password!=='string' || d.password.length<10 || d.password.length>128) return Response.json({error:'invalid_registration'},{status:400});
  if ((d.latitude!=null || d.longitude!=null) && (!Number.isFinite(d.latitude) || Math.abs(d.latitude)>90 || !Number.isFinite(d.longitude) || Math.abs(d.longitude)>180)) return Response.json({error:'invalid_registration'},{status:400});
  const db=env.IDENTITY_DB;
  const bucket=asHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode((request.headers.get('cf-connecting-ip')||'unknown')+':live-signup:'+Math.floor(Date.now()/600000))));
  await db.prepare('INSERT INTO catalog_rate(key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1').bind(bucket,Math.floor(Date.now()/1000)+1200).run();
  if ((await db.prepare('SELECT hits FROM catalog_rate WHERE key=?').bind(bucket).first())?.hits>20) return Response.json({error:'too_many_attempts'},{status:429});
  const id=crypto.randomUUID(),salt=asHex(crypto.getRandomValues(new Uint8Array(32)));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(d.password),'PBKDF2',false,['deriveBits']);
  const digest=asHex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256));
  const token=asHex(crypto.getRandomValues(new Uint8Array(32))),tokenHash=asHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
  const customer=role==='customer';
  const account=customer?{id,name,phone,registered:true}:{id,role:'owner',phone,salonName:name,area:String(d.area||'').trim(),latitude:d.latitude??null,longitude:d.longitude??null};
  const create=customer
    ? db.prepare('INSERT INTO catalog_customer_accounts(id,username,name,phone,salt,digest,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,'phone-'+id,name,phone,salt,digest,new Date().toISOString())
    : db.prepare("INSERT INTO catalog_accounts(id,email,role,salt,digest,salon_name,area,latitude,longitude) VALUES(?,?,'owner',?,?,?,?,?,?)").bind(id,role+'-'+id+'@phone.salonati.invalid',salt,digest,name,account.area,account.latitude,account.longitude);
  const session=customer
    ? db.prepare("INSERT INTO catalog_customer_sessions(token_hash,customer_id,expires_at) VALUES(?,?,datetime('now','+30 days'))").bind(tokenHash,id)
    : db.prepare("INSERT INTO catalog_sessions(token_hash,account_id,expires_at) VALUES(?,?,datetime('now','+7 days'))").bind(tokenHash,id);
  try{await db.batch([create,db.prepare('INSERT INTO salonati_phone_identities(app,phone,account_id) VALUES(?,?,?)').bind(role,phone,id),session]);}
  catch(e){if(/unique|constraint/i.test(String(e.message)))return Response.json({error:'phone_already_registered'},{status:409});return Response.json({error:'registration_unavailable'},{status:503});}
  return Response.json({account},{status:201,headers:{'Cache-Control':'no-store','Set-Cookie':(customer?'__Host-salonati-customer':'__Host-catalog')+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+(customer?2592000:604800)}});
}
async function phoneLogin(request, env, url) {
  if (!env.IDENTITY_DB) return Response.json({error:'identity_not_configured'},{status:503});
  if (request.headers.get('origin') !== url.origin) return Response.json({error:'origin_denied'},{status:403});
  const d = await readLoginBody(request);
  const phone = normalizePhone(d?.phone ?? d?.email ?? d?.name);
  if (!/^0[0-9]{10}$/.test(phone) || typeof d?.password !== 'string' || d.password.length < 10 || d.password.length > 128) return Response.json({error:'invalid_credentials'},{status:401});
  const customer = role === 'customer';
  const sql = customer
    ? "SELECT a.username AS identity FROM salonati_phone_identities p JOIN catalog_customer_accounts a ON a.id=p.account_id WHERE p.app=? AND p.phone=?"
    : "SELECT a.email AS identity FROM salonati_phone_identities p JOIN catalog_accounts a ON a.id=p.account_id WHERE p.app=? AND p.phone=? AND a.role=?";
  const q = env.IDENTITY_DB.prepare(sql);
  const row = await (customer ? q.bind(role,phone) : q.bind(role,phone,role==='admin'?'admin':'owner')).first();
  // The original API still verifies the password and issues/revokes sessions.
  // Use an unavailable identity for misses so upstream rate limits also apply.
  const body = customer ? {name:row?.identity || 'unavailable-phone-account',password:d.password} : {email:row?.identity || 'unavailable-phone@salonati.invalid',password:d.password};
  const headers = new Headers(request.headers);headers.delete('x-salonati-app');headers.delete('content-length');headers.set('content-type','application/json');
  return env.SALONATI_API.fetch(new Request(request.url,{method:'POST',headers,body:JSON.stringify(body)}));
}
function allowed(path) {
  if (backendAssets.has(path)) return true;
  if (path === '/api/catalog/public' || path.startsWith('/api/catalog/media/')) return true;
  if (role === 'customer') return path === '/api/link/public' || path === '/api/link/session' || path.startsWith('/api/link/customer/') || path.startsWith('/api/catalog/workflow/customer/');
  if (role === 'cosmetics') return path.startsWith('/api/cosmetics/');
  if (['/api/catalog/login','/api/catalog/logout','/api/catalog/me'].includes(path)) return true;
  if (role === 'admin') return path.startsWith('/api/catalog/admin/') || path.startsWith('/api/catalog/finance/') || /^\/api\/catalog\/(reviews|product-reviews|ad-reviews)(\/|$)/.test(path) || path === '/api/catalog/workflow/notifications' || path === '/api/catalog/media' || path === '/api/catalog/setup';
  return path === '/api/link/team' || path.startsWith('/api/catalog/workflow/owner/') || ['/api/catalog/register','/api/catalog/registration','/api/catalog/location','/api/catalog/services','/api/catalog/products','/api/catalog/advertisements','/api/catalog/media','/api/catalog/finance/payment-notifications','/api/catalog/finance/payment-notifications/read','/api/catalog/finance/statement','/api/catalog/finance/options'].includes(path) || /^\/api\/catalog\/(services|products|advertisements)\//.test(path);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname !== `salonati-${role}-clean.pages.dev`) return Response.json({error:'live_host_required'}, {status:403});
    if (role === 'customer' && ['/', '/index.html'].includes(url.pathname) && ['GET','HEAD'].includes(request.method)) {
      if (!env.SALONATI_API) return Response.json({error:'api_not_configured'},{status:503});
      const me = await env.SALONATI_API.fetch(new Request(url.origin+'/api/link/customer/me',{headers:request.headers}));
      if (me.status===401) return new Response(request.method==='HEAD'?null:customerEntry,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
      if (!me.ok) return Response.json({error:'service_unavailable'},{status:503});
    }
    if (url.pathname.startsWith('/api/') || backendAssets.has(url.pathname)) {
      if (!allowed(url.pathname)) return Response.json({error:'app_route_denied'}, {status:403});
      if (!env.SALONATI_API) return Response.json({error:'api_not_configured'}, {status:503});
      if (request.method === 'POST' && (url.pathname === '/api/catalog/register' || url.pathname === '/api/link/customer/register')) return registerPhone(request,env,url);
      if (request.method === 'POST' && (url.pathname === '/api/catalog/login' || url.pathname === '/api/link/customer/login')) return phoneLogin(request,env,url);
      const headers = new Headers(request.headers);
      // Never forward the demo privilege header to the live service.
      headers.delete('x-salonati-app');
      try { return await env.SALONATI_API.fetch(new Request(request,{headers})); }
      catch { return Response.json({error:'service_unavailable'}, {status:503,headers:{'Cache-Control':'no-store'}}); }
    }
    return env.ASSETS.fetch(request);
  }
};

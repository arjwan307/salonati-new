// Live apps use the production API and its existing authenticated sessions.
const role = '__APP_ROLE__';
const backendAssets = new Set(['/salonati-link.js','/loyalty-ui.js']);
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
    ? db.prepare("INSERT INTO catalog_customer_sessions(token_hash,customer_id,expires_at) VALUES(?,?,datetime('now','+365 days'))").bind(tokenHash,id)
    : db.prepare("INSERT INTO catalog_sessions(token_hash,account_id,expires_at) VALUES(?,?,datetime('now','+7 days'))").bind(tokenHash,id);
  try{await db.batch([create,db.prepare('INSERT INTO salonati_phone_identities(app,phone,account_id) VALUES(?,?,?)').bind(role,phone,id),session]);}
  catch(e){if(/unique|constraint/i.test(String(e.message)))return Response.json({error:'phone_already_registered'},{status:409});return Response.json({error:'registration_unavailable'},{status:503});}
  return Response.json({account},{status:201,headers:{'Cache-Control':'no-store','Set-Cookie':(customer?'__Host-salonati-customer':'__Host-catalog')+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+(customer?31536000:7200)}});
}
function twoHourLoginCookie(response) {
  if (!response.ok) return response;
  const original=response.headers.get('set-cookie');
  if (!original || !/^__Host-(?:catalog|salonati-customer)=/.test(original)) return response;
  const cookie=original.replace(/;\s*Max-Age=\d+/i,'').replace(/;\s*Expires=[^;]*/i,'')+'; Max-Age='+(role==='customer'?31536000:7200);
  const headers=new Headers(response.headers);
  headers.set('Set-Cookie',cookie);
  headers.set('Cache-Control','no-store');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
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
    : "SELECT a.email AS identity FROM salonati_phone_identities p JOIN catalog_accounts a ON a.id=p.account_id LEFT JOIN salonati_admin_account_controls c ON c.app=p.app AND c.owner_id=a.id WHERE p.app=? AND p.phone=? AND a.role=? AND COALESCE(c.status,'active')='active'";
  const q = env.IDENTITY_DB.prepare(sql);
  const row = await (customer ? q.bind(role,phone) : q.bind(role,phone,role==='admin'?'admin':'owner')).first();
  // The original API still verifies the password and issues/revokes sessions.
  // Use an unavailable identity for misses so upstream rate limits also apply.
  const body = customer ? {name:row?.identity || 'unavailable-phone-account',password:d.password} : {email:row?.identity || 'unavailable-phone@salonati.invalid',password:d.password};
  const headers = new Headers(request.headers);headers.delete('x-salonati-app');headers.delete('content-length');headers.set('content-type','application/json');
  const target=role==='cosmetics'?new URL('/api/catalog/login',request.url):request.url;
  const response=await env.SALONATI_API.fetch(new Request(target,{method:'POST',headers,body:JSON.stringify(body)}));
  if(customer&&response.ok){const token=/__Host-salonati-customer=([a-f0-9]{64})/.exec(response.headers.get('set-cookie')||'')?.[1];if(token){const hash=asHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));await env.IDENTITY_DB.prepare("UPDATE catalog_customer_sessions SET expires_at=datetime('now','+365 days') WHERE token_hash=?").bind(hash).run();}}
  return twoHourLoginCookie(response);
}
function allowed(path) {
  if (backendAssets.has(path)) return true;
  if (path === '/api/catalog/public' || path === '/api/catalog/public/cosmetics-ads' || path.startsWith('/api/catalog/media/') || path==='/api/cosmetics/public' || path.startsWith('/api/cosmetics/media/')) return true;
  if (role === 'customer') return path === '/api/customer/public-campaigns' || path === '/api/link/public' || path === '/api/link/session' || path.startsWith('/api/link/customer/') || path.startsWith('/api/catalog/workflow/customer/') || path.startsWith('/api/cosmetics/customer/');
  if (role === 'cosmetics') return ['/api/cosmetics/me','/api/cosmetics/login','/api/cosmetics/register','/api/cosmetics/logout','/api/cosmetics/state','/api/cosmetics/media','/api/cosmetics/orders','/api/cosmetics/orders/status','/api/cosmetics/agreement'].includes(path);
  if (['/api/catalog/login','/api/catalog/logout','/api/catalog/me'].includes(path)) return true;
  if (role === 'admin') return path.startsWith('/api/catalog/admin/') || path.startsWith('/api/catalog/finance/') || /^\/api\/catalog\/(reviews|product-reviews|ad-reviews)(\/|$)/.test(path) || path === '/api/catalog/workflow/notifications' || path === '/api/catalog/media' || path === '/api/catalog/setup';
  return /^\/api\/catalog\/finance\/agreements\/[a-f0-9-]{36}$/.test(path) || path === '/api/link/team' || path.startsWith('/api/catalog/workflow/owner/') || ['/api/catalog/register','/api/catalog/registration','/api/catalog/location','/api/catalog/services','/api/catalog/products','/api/catalog/advertisements','/api/catalog/media','/api/catalog/finance/payment-notifications','/api/catalog/finance/payment-notifications/read','/api/catalog/finance/statement','/api/catalog/finance/options'].includes(path) || /^\/api\/catalog\/(services|products|advertisements)\//.test(path);
}
async function catalogAppSession(request,env){
  if(!env.IDENTITY_DB)return {status:503};
  const token=/(?:^|;\s*)__Host-catalog=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie')||'')?.[1];
  if(!token)return {status:401};
  const hash=asHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
  const row=await env.IDENTITY_DB.prepare("SELECT p.account_id FROM catalog_sessions s JOIN catalog_accounts a ON a.id=s.account_id JOIN salonati_phone_identities p ON p.account_id=a.id LEFT JOIN salonati_admin_account_controls c ON c.app=p.app AND c.owner_id=a.id LEFT JOIN catalog_admin_staff st ON st.account_id=a.id WHERE s.token_hash=? AND p.app=? AND julianday(s.expires_at)>julianday('now') AND COALESCE(c.status,'active')='active' AND ((p.app='admin' AND (a.role='admin' OR st.active=1)) OR (p.app IN('salon','cosmetics') AND a.role='owner' AND st.account_id IS NULL))").bind(hash,role).first();
  return row?{status:200,accountId:row.account_id}:{status:401};
}
async function persistentCustomerSession(request,env){
 if(!env.IDENTITY_DB)return null;const token=/(?:^|;\s*)__Host-salonati-customer=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie')||'')?.[1];if(!token)return null;
 const hash=asHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),row=await env.IDENTITY_DB.prepare("SELECT s.customer_id FROM catalog_customer_sessions s JOIN catalog_customer_accounts a ON a.id=s.customer_id WHERE s.token_hash=? AND julianday(s.expires_at)>julianday('now')").bind(hash).first();if(!row)return null;
 await env.IDENTITY_DB.prepare("UPDATE catalog_customer_sessions SET expires_at=datetime('now','+365 days') WHERE token_hash=? AND julianday(expires_at)<julianday('now','+360 days')").bind(hash).run();return {id:row.customer_id,hash,cookie:'__Host-salonati-customer='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000'};
}
export default {
  async fetch(request, env) {
    try {
    const url = new URL(request.url);
    let accountId = 'guest';
    const remembered=role==='customer'?await persistentCustomerSession(request,env):null;
    // Support legacy entrypoint links without changing login or API boundaries.
    if (request.method === 'GET' && (url.pathname === '/تطبيق' || url.pathname === '/%D8%AA%D8%B7%D8%A8%D9%8A%D9%82' || url.pathname === '/تطبيق/')) return Response.redirect(url.origin + '/', 302);
    if (url.hostname !== `salonati-${role}-clean.pages.dev`) return Response.json({error:'live_host_required'}, {status:403});
    if (role === 'customer' && ['/', '/index.html'].includes(url.pathname) && ['GET','HEAD'].includes(request.method)) {
      if (!env.SALONATI_API) return Response.json({error:'api_not_configured'},{status:503});
      const me = await env.SALONATI_API.fetch(new Request(url.origin+'/api/link/customer/me',{headers:request.headers}));
      if (me.status===401) return new Response(request.method==='HEAD'?null:customerEntry,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
      if (!me.ok) return Response.json({error:'service_unavailable'},{status:503});
      accountId = (await me.json()).account?.id;
      if (typeof accountId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(accountId)) return Response.json({error:'invalid_session'},{status:401});
    }
    if (role === 'salon' && ['/', '/index.html'].includes(url.pathname) && ['GET','HEAD'].includes(request.method)) {
      if (!env.SALONATI_API) return Response.json({error:'api_not_configured'},{status:503});
      const me=await env.SALONATI_API.fetch(new Request(url.origin+'/api/catalog/me',{headers:request.headers}));
      if (me.ok) {
        const account=(await me.json()).account;
        if (account?.role!=='owner' || !/^[a-zA-Z0-9-]{16,80}$/.test(account.id)) return Response.json({error:'owner_required'},{status:403});
        accountId=account.id;
        const appSession=await catalogAppSession(request,env);if(appSession.status!==200)return Response.json({error:'app_session_required'},{status:appSession.status});
      } else if (me.status!==401) return Response.json({error:'service_unavailable'},{status:503});
    }
    if (role === 'cosmetics' && ['/', '/index.html'].includes(url.pathname) && ['GET','HEAD'].includes(request.method)) {
      if (!env.SALONATI_API || !env.IDENTITY_DB) return Response.json({error:'api_not_configured'},{status:503});
      const owner=await cosmeticsSession(request,env,'owner');
      if (!owner) return new Response(request.method==='HEAD'?null:customerEntry.replaceAll('/api/link/customer/','/api/cosmetics/').replace('>الاسم<','>اسم الكوزمتك<'),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
      accountId=owner.id;
      if(!/^[a-zA-Z0-9-]{16,80}$/.test(accountId))return Response.json({error:'invalid_session'},{status:401});
    }
    if(role==='customer'&&['/api/customer/push','/api/customer/notifications'].includes(url.pathname)){
      if(!remembered)return Response.json({error:'login_required'},{status:401});
      const db=env.IDENTITY_DB,headers={'Cache-Control':'no-store','Set-Cookie':remembered.cookie};
      if(url.pathname==='/api/customer/notifications'&&request.method==='GET'){const rows=(await db.prepare('SELECT id,title,body,created_at FROM salonati_offer_notifications ORDER BY created_at DESC LIMIT 50').all()).results;return Response.json({notifications:rows},{headers});}
      if(url.pathname==='/api/customer/push'&&request.method==='GET'){const key=await db.prepare("SELECT value FROM salonati_notification_settings WHERE key='public_key'").first();return Response.json({publicKey:key?.value||''},{headers});}
      if(url.pathname==='/api/customer/push'&&request.method==='POST'){
        if(request.headers.get('origin')!==url.origin)return Response.json({error:'invalid_origin'},{status:403});const d=await readLoginBody(request);let endpoint;try{endpoint=new URL(d?.endpoint);}catch{return Response.json({error:'invalid_subscription'},{status:400});}
        if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.port||endpoint.href.length>2048||!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','wns2-par02p.notify.windows.com'].some(h=>endpoint.hostname===h||h==='web.push.apple.com'&&endpoint.hostname.endsWith('.push.apple.com')))return Response.json({error:'invalid_subscription'},{status:400});
        const id=asHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint.href)));
        if(d.remove)await db.prepare('DELETE FROM salonati_push_subscriptions WHERE id=? AND customer_id=?').bind(id,remembered.id).run();
        else await db.prepare("INSERT INTO salonati_push_subscriptions(id,customer_id,token_hash,endpoint,last_seq) VALUES(?,?,?,?,(SELECT COALESCE(MAX(seq),0) FROM salonati_offer_notifications)) ON CONFLICT(id) DO UPDATE SET customer_id=excluded.customer_id,token_hash=excluded.token_hash,endpoint=excluded.endpoint,last_seq=(SELECT COALESCE(MAX(seq),0) FROM salonati_offer_notifications),updated_at=CURRENT_TIMESTAMP").bind(id,remembered.id,remembered.hash,endpoint.href).run();
        return Response.json({ok:true},{headers});
      }
      return Response.json({error:'method_not_allowed'},{status:405});
    }
    if(role==='customer'&&url.pathname==='/api/link/customer/logout'&&request.method==='POST'&&remembered){
      if(request.headers.get('origin')!==url.origin)return Response.json({error:'invalid_origin'},{status:403});
      await env.IDENTITY_DB.prepare('DELETE FROM salonati_push_subscriptions WHERE token_hash=?').bind(remembered.hash).run();
    }
    if(role==='salon'&&url.pathname==='/api/salon/home-profile'&&request.method==='GET'){
      const session=await catalogAppSession(request,env);if(session.status!==200)return Response.json({error:'app_session_required'},{status:session.status});
      const row=await env.IDENTITY_DB.prepare('SELECT a.salon_name,a.area,r.contact_name,r.address,r.status,r.facade_media_id FROM catalog_accounts a LEFT JOIN catalog_registrations r ON r.owner_id=a.id WHERE a.id=?').bind(session.accountId).first();
      const campaigns=(await env.IDENTITY_DB.prepare("SELECT c.id,c.title,c.copy,c.media_id,m.mime FROM catalog_campaigns c JOIN catalog_media m ON m.id=c.media_id WHERE c.active=1 ORDER BY c.created_at DESC,c.id").all()).results;
      return Response.json({profile:row?{salonName:row.salon_name,area:row.area,contactName:row.contact_name||'',address:row.address||'',status:row.status||'unsubmitted',facadeUrl:row.status==='approved'&&row.facade_media_id?'/api/catalog/media/'+row.facade_media_id:''}:null,campaigns:campaigns.map(c=>({id:c.id,title:c.title,copy:c.copy,mediaType:c.mime,mediaUrl:'/api/catalog/media/'+c.media_id}))},{headers:{'Cache-Control':'no-store'}});
    }
    // Public, read-only approved catalog for the customer app. Published services only.
    if (role === 'customer' && url.pathname === '/api/customer/approved-catalog' && request.method === 'GET') {
      if (!env.IDENTITY_DB) return Response.json({error:'catalog_unavailable'},{status:503});
      const db=env.IDENTITY_DB;
      const salons=(await db.prepare("SELECT a.id AS ownerId,a.salon_name AS name,a.area,a.latitude AS lat,a.longitude AS lng,r.facade_media_id AS facadeId FROM catalog_accounts a JOIN catalog_registrations r ON r.owner_id=a.id WHERE a.role='owner' AND r.status='approved' AND NOT EXISTS(SELECT 1 FROM salonati_admin_account_controls c WHERE c.app='salon' AND c.owner_id=a.id AND c.status!='active') ORDER BY a.salon_name").all()).results;
      const services=(await db.prepare("SELECT s.id,s.owner_id AS ownerId,r.name,r.category,r.price,r.discount_price AS discountPrice,r.discount_start AS discountStart,r.discount_end AS discountEnd,r.minutes,r.media_id AS mediaId FROM catalog_services s JOIN catalog_revisions r ON r.id=s.published_revision JOIN catalog_registrations reg ON reg.owner_id=s.owner_id WHERE reg.status='approved' AND r.status='approved' AND r.active=1 AND NOT EXISTS(SELECT 1 FROM salonati_admin_account_controls c WHERE c.app='salon' AND c.owner_id=s.owner_id AND c.status!='active')").all()).results;
      const team=(await db.prepare("SELECT t.id,t.owner_id AS ownerId,t.name,t.specialty FROM catalog_team t JOIN catalog_registrations reg ON reg.owner_id=t.owner_id WHERE reg.status='approved' AND t.active=1 AND NOT EXISTS(SELECT 1 FROM salonati_admin_account_controls c WHERE c.app='salon' AND c.owner_id=t.owner_id AND c.status!='active')").all()).results;
      return Response.json({salons,services,team},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    if (role === 'salon' && request.method === 'DELETE' && url.pathname.startsWith('/api/catalog/services/') && /^[a-zA-Z0-9-]{16,80}$/.test(url.pathname.slice('/api/catalog/services/'.length))) {
      if (!env.IDENTITY_DB) return Response.json({error:'catalog_unavailable'},{status:503});
      if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return Response.json({error:'invalid_origin'},{status:403});
      const session=await catalogAppSession(request,env);
      if(session.status!==200)return Response.json({error:'app_session_required'},{status:session.status});
      const id=decodeURIComponent(url.pathname.split('/').pop()),db=env.IDENTITY_DB;
      const service=await db.prepare("SELECT s.id,s.owner_id,s.published_revision,r.status FROM catalog_services s JOIN catalog_revisions r ON r.id=s.latest_revision WHERE s.id=? AND s.owner_id=?").bind(id,session.accountId).first();
      if(!service)return Response.json({error:'service_not_found'},{status:404});
      // Historical bookings keep their immutable service snapshots; loyalty references must remain valid.
      const loyalty=await db.prepare("SELECT owner_id FROM catalog_loyalty_settings WHERE service_id=?").bind(id).first();
      if(loyalty)return Response.json({error:'service_used_for_loyalty'},{status:409});
      try{
        await db.batch([
          db.prepare("DELETE FROM catalog_visual_services WHERE service_id=? AND owner_id=?").bind(id,session.accountId),
          db.prepare("UPDATE catalog_services SET published_revision=NULL,latest_revision=NULL WHERE id=? AND owner_id=?").bind(id,session.accountId),
          db.prepare("DELETE FROM catalog_revisions WHERE service_id=? AND owner_id=?").bind(id,session.accountId),
          db.prepare("DELETE FROM catalog_services WHERE id=? AND owner_id=?").bind(id,session.accountId)
        ]);
      }catch{return Response.json({error:'service_delete_blocked'},{status:409});}
      return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
    }

    if(role==='salon' && request.method==='DELETE' && /^\/api\/catalog\/products\/[a-f0-9-]{36}$/.test(url.pathname)){
      if(!env.IDENTITY_DB)return Response.json({error:'database_unavailable'},{status:503});
      if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return Response.json({error:'invalid_origin'},{status:403});
      const session=await catalogAppSession(request,env);if(session.status!==200)return Response.json({error:'app_session_required'},{status:session.status});
      const id=url.pathname.split('/').pop(),db=env.IDENTITY_DB;
      const owned=await db.prepare('SELECT id FROM catalog_products WHERE id=? AND owner_id=?').bind(id,session.accountId).first();
      if(!owned)return Response.json({error:'product_not_found'},{status:404});
      try{await db.batch([
        db.prepare('UPDATE catalog_products SET latest_revision=NULL,published_revision=NULL WHERE id=? AND owner_id=?').bind(id,session.accountId),
        db.prepare('DELETE FROM catalog_product_revisions WHERE product_id=? AND owner_id=?').bind(id,session.accountId),
        db.prepare('DELETE FROM catalog_products WHERE id=? AND owner_id=?').bind(id,session.accountId)
      ]);}catch{return Response.json({error:'product_delete_blocked'},{status:409})}
      return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
    }

    // Centrally managed support contacts: public read, authenticated admin write.
    if(url.pathname==='/api/support/contacts'){
      if(!env.IDENTITY_DB)return Response.json({error:'database_unavailable'},{status:503});
      if(request.method==='GET'){
        const row=await env.IDENTITY_DB.prepare('SELECT phone,whatsapp,email FROM salonati_support_contacts WHERE id=1').first();
        return Response.json({phone:row?.phone||'',whatsapp:row?.whatsapp||'',email:row?.email||''},{headers:{'Cache-Control':'no-store'}});
      }
      if(request.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405});
      if(role!=='admin')return Response.json({error:'forbidden'},{status:403});
      if(request.headers.get('origin')!==url.origin)return Response.json({error:'invalid_origin'},{status:403});
      const session=await catalogAppSession(request,env);
      if(session.status!==200)return Response.json({error:'admin_session_required'},{status:session.status});
      const actor=await cosmeticsSession(request,env,'admin');if(!actor||actor.staff)return Response.json({error:'permission_denied'},{status:403});
      const body=await request.json().catch(()=>null);
      if(!body||['phone','whatsapp','email'].some(k=>typeof body[k]!=='string'))return Response.json({error:'invalid_fields'},{status:400});
      const phone=body.phone.trim(),whatsapp=body.whatsapp.trim(),email=body.email.trim();
      if(phone.length>32||whatsapp.length>32||email.length>254||[phone,whatsapp].some(v=>v&&!Array.from(v).every(c=>'0123456789+ ()-'.includes(c)))||(email&&(!email.includes('@')||email.includes(' ')||!email.split('@').pop().includes('.'))))return Response.json({error:'invalid_contacts'},{status:400});
      await env.IDENTITY_DB.prepare("INSERT INTO salonati_support_contacts(id,phone,whatsapp,email,updated_at) VALUES(1,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET phone=excluded.phone,whatsapp=excluded.whatsapp,email=excluded.email,updated_at=CURRENT_TIMESTAMP").bind(phone,whatsapp,email).run();
      return Response.json({ok:true,phone,whatsapp,email},{headers:{'Cache-Control':'no-store'}});
    }

    if(url.pathname==='/api/catalog/admin/salon-manage'&&request.method==='POST'){
      if(role!=='admin'||!env.IDENTITY_DB)return Response.json({error:'forbidden'},{status:403});
      if(request.headers.get('origin')!==url.origin)return Response.json({error:'invalid_origin'},{status:403});
      const session=await catalogAppSession(request,env);
      if(session.status!==200)return Response.json({error:'admin_session_required'},{status:session.status});
      const actor=await cosmeticsSession(request,env,'admin');if(!cosmeticsPermit(actor,'registrations'))return Response.json({error:'permission_denied'},{status:403});
      const d=await request.json().catch(()=>null);
      if(!d||!['edit','suspend','activate','delete'].includes(d.action)||typeof d.ownerId!=='string'||d.ownerId.length>80)return Response.json({error:'invalid_input'},{status:400});
      const db=env.IDENTITY_DB;
      const row=await db.prepare('SELECT owner_id,status FROM catalog_registrations WHERE owner_id=?').bind(d.ownerId).first();
      if(!row)return Response.json({error:'not_found'},{status:404});
      if(d.action!=='edit'){
        const status={suspend:'suspended',activate:'active',delete:'deleted'}[d.action];
        await db.batch([
          db.prepare("INSERT INTO salonati_admin_account_controls(app,owner_id,status) VALUES('salon',?,?) ON CONFLICT(app,owner_id) DO UPDATE SET status=excluded.status,updated_at=CURRENT_TIMESTAMP").bind(d.ownerId,status),
          ...(status==='active'?[]:[db.prepare('DELETE FROM catalog_sessions WHERE account_id=?').bind(d.ownerId)])
        ]);
        return Response.json({ok:true,status});
      }
      const keys=['salonName','area','contactName','phone','address'];
      if(keys.some(k=>typeof d[k]!=='string'||!d[k].trim()||d[k].trim().length>150))return Response.json({error:'invalid_fields'},{status:400});
      await db.batch([
        db.prepare('UPDATE catalog_accounts SET salon_name=?,area=? WHERE id=?').bind(d.salonName.trim(),d.area.trim(),d.ownerId),
        db.prepare('UPDATE catalog_registrations SET contact_name=?,phone=?,address=?,revision=revision+1 WHERE owner_id=?').bind(d.contactName.trim(),d.phone.trim(),d.address.trim(),d.ownerId)
      ]);
      return Response.json({ok:true});
    }
    if(url.pathname==='/api/catalog/admin/account-controls'&&role==='admin'&&request.method==='GET'){
      const session=await catalogAppSession(request,env);if(session.status!==200)return Response.json({error:'admin_session_required'},{status:session.status});
      const rows=(await env.IDENTITY_DB.prepare("SELECT app,owner_id AS ownerId,status FROM salonati_admin_account_controls").all()).results;
      return Response.json({controls:rows},{headers:{'Cache-Control':'no-store'}});
    }
    if(env.IDENTITY_DB&&role==='salon'&&url.pathname.startsWith('/api/catalog/')&&!['/api/catalog/login','/api/catalog/logout','/api/catalog/me'].includes(url.pathname)){
      const session=await catalogAppSession(request,env);
      if(session.status===200){
        const state=await env.IDENTITY_DB.prepare("SELECT status FROM salonati_admin_account_controls WHERE app='salon' AND owner_id=?").bind(session.accountId).first();
        if(state&&state.status!=='active')return Response.json({error:'account_'+state.status},{status:403});
      }
    }
    // Owner-managed booking closures, isolated by salon and service.
    if(url.pathname==='/api/booking/blocks' && ['GET','PUT'].includes(request.method)){
      if(!env.IDENTITY_DB)return Response.json({error:'database_unavailable'},{status:503});
      const db=env.IDENTITY_DB;
      const ownerId=url.searchParams.get('ownerId');
      if(request.method==='GET'){
        if(role!=='customer' && role!=='salon')return Response.json({error:'forbidden'},{status:403});
        if(!ownerId||!/^[a-zA-Z0-9-]{16,80}$/.test(ownerId))return Response.json({error:'invalid_owner'},{status:400});
        const entries=(await db.prepare("SELECT slot_date AS date,slot_time AS time,service_id AS serviceId FROM catalog_booking_blocks WHERE owner_id=? AND slot_date>=date('now','-1 day')").bind(ownerId).all()).results;
        return Response.json({blocks:entries},{headers:{'Cache-Control':'no-store'}});
      }
      if(role!=='salon')return Response.json({error:'forbidden'},{status:403});
      const session=await catalogAppSession(request,env);if(session.status!==200)return Response.json({error:'app_session_required'},{status:session.status});
      if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return Response.json({error:'invalid_origin'},{status:403});
      const body=await request.json().catch(()=>null),date=body?.date,ids=Array.isArray(body?.serviceIds)?[...new Set(body.serviceIds)]:[body?.serviceId];
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!ids.length||ids.length>100||ids.some(id=>typeof id!=='string'||!(id==='*'||/^[a-zA-Z0-9-]{16,80}$/.test(id)))||(ids.includes('*')&&ids.length>1)||!Array.isArray(body?.times)||body.times.length>29||body.times.some(t=>!/^\d{2}:\d{2}$/.test(t)))return Response.json({error:'invalid_blocks'},{status:400});
      for(const id of ids)if(id!=='*'&&!(await db.prepare('SELECT id FROM catalog_services WHERE id=? AND owner_id=?').bind(id,session.accountId).first()))return Response.json({error:'service_not_owned'},{status:403});
      const unique=[...new Set(body.times)],writes=ids.flatMap(id=>[db.prepare('DELETE FROM catalog_booking_blocks WHERE owner_id=? AND slot_date=? AND service_id=?').bind(session.accountId,date,id),...unique.map(time=>db.prepare('INSERT INTO catalog_booking_blocks(owner_id,slot_date,slot_time,service_id) VALUES(?,?,?,?)').bind(session.accountId,date,time,id))]);
      await db.batch(writes);
      return Response.json({ok:true,count:unique.length,services:ids.length});
    }
    if(role==='customer' && url.pathname==='/api/catalog/workflow/customer/bookings' && request.method==='POST'){
      if(!env.IDENTITY_DB)return Response.json({error:'booking_validation_unavailable'},{status:503});
      const body=await request.clone().json().catch(()=>null);
      if(body&&typeof body.ownerId==='string'){
        const control=await env.IDENTITY_DB.prepare("SELECT status FROM salonati_admin_account_controls WHERE app='salon' AND owner_id=?").bind(body.ownerId).first();
        if(control&&control.status!=='active')return Response.json({error:'salon_unavailable'},{status:409});
      }
      if(body && /^[a-zA-Z0-9-]{16,80}$/.test(body.ownerId||'') && Array.isArray(body.serviceIds) && typeof body.startsAt==='string'){
        const instant=new Date(body.startsAt);
        if(Number.isFinite(instant.getTime())){
          const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant);
          const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baghdad',hour:'2-digit',minute:'2-digit',hour12:false}).format(instant);
          const check=await env.IDENTITY_DB.prepare("SELECT service_id FROM catalog_booking_blocks WHERE owner_id=? AND slot_date=? AND slot_time=?").bind(body.ownerId,date,time).all();
          if(check.results.some(row=>row.service_id==='*'||body.serviceIds.includes(row.service_id)))return Response.json({error:'booking_slot_closed'},{status:409});
        }
      }
    }
    if (url.pathname.startsWith('/api/') || backendAssets.has(url.pathname)) {
      if (!allowed(url.pathname)) return Response.json({error:'app_route_denied'}, {status:403});
      if (!env.SALONATI_API) return Response.json({error:'api_not_configured'}, {status:503});
      if (request.method === 'POST' && ['/api/catalog/register','/api/link/customer/register','/api/cosmetics/register'].includes(url.pathname)) return await registerPhone(request,env,url);
      if (request.method === 'POST' && ['/api/catalog/login','/api/link/customer/login','/api/cosmetics/login'].includes(url.pathname)) return await phoneLogin(request,env,url);
      // Public approved campaign feed: served directly from the live identity DB.
      // Do not depend on the legacy public catalog response including campaigns.
      if(role==='customer'&&request.method==='GET'&&url.pathname==='/api/customer/public-campaigns'){
        if(!env.IDENTITY_DB)return Response.json({campaigns:[]},{headers:{'Cache-Control':'no-store'}});
        const rows=(await env.IDENTITY_DB.prepare("SELECT c.id,c.title,c.copy,c.media_id,m.mime FROM catalog_campaigns c JOIN catalog_media m ON m.id=c.media_id WHERE c.active=1 AND m.mime LIKE 'image/%' ORDER BY c.created_at DESC,c.id LIMIT 30").all()).results;
        return Response.json({campaigns:rows.map(c=>({id:c.id,title:c.title,copy:c.copy,mediaType:c.mime,mediaUrl:'/api/catalog/media/'+c.media_id}))},{headers:{'Cache-Control':'no-store'}});
      }
      const mediaDenied=await catalogMediaGuard(request,env,url);if(mediaDenied)return mediaDenied;
      const cosmetics=await cosmeticsRoutes(request,env,url);if(cosmetics)return cosmetics;
      const headers = new Headers(request.headers);
      // Never forward the demo privilege header to the live service.
      headers.delete('x-salonati-app');
      const publicPath=['/api/link/public','/api/catalog/public','/api/catalog/public/cosmetics-ads'].includes(url.pathname)||backendAssets.has(url.pathname);
      const mediaPath=url.pathname.startsWith('/api/catalog/media/');
      if(['admin','salon'].includes(role)&&!publicPath){
        const session=await catalogAppSession(request,env);
        if(session.status!==200){if(mediaPath)headers.delete('cookie');else return Response.json({error:'app_session_required'},{status:session.status});}
      }else if(publicPath||mediaPath)headers.delete('cookie');
      try {
        let upstream=new Request(request,{headers});
        // Delete a pending submission through the backend's authenticated review transition.
        // Keep published versions and order history intact.
        if(role==='admin'&&request.method==='POST'&&/^\/api\/catalog\/(reviews|product-reviews|ad-reviews)\/[a-f0-9-]{36}$/.test(url.pathname)){
          const payload=await cosmeticsInput(upstream.clone());
          if(payload.action==='delete')upstream=new Request(upstream,{headers,body:JSON.stringify({...payload,action:'reject',reason:'تم حذف الطلب من قائمة الموافقات بواسطة الإدارة.'})});
        }
        const result=await env.SALONATI_API.fetch(upstream);
        if(role==='customer'&&url.pathname==='/salonati-link.js'&&result.ok){
          // Keep canonical IDs when the live catalogue replaces the initial UI data.
          // Booking closures are keyed by owner/service UUID, never the numeric UI ID.
          const source=(await result.text()).replace('baseServices=services.filter(s=>s.id<=5).map(s=>({...s}))','baseServices=[]').replace('function sync(data){linked=data.salons',"function sync(data){const previousOwner=salons.find(s=>s.id===state.salon)?.ownerId,previousServices=state.selectedServices.map(id=>services.find(s=>s.id===id)?.serverId).filter(Boolean);linked=data.salons").replace('services.splice(0,services.length,...nextServices);',"services.splice(0,services.length,...nextServices);if(previousOwner){const current=nextSalons.find(s=>s.ownerId===previousOwner);if(current)state.salon=current.id;if(previousServices.length)state.selectedServices=previousServices.map(id=>nextServices.find(s=>s.serverId===id)?.id).filter(id=>id!==undefined);}").replaceAll('catalogId:s.id','catalogId:s.id,ownerId:s.id').replaceAll('const item={id:v.uiId,name:v.name','const item={id:v.uiId,serverId:v.id,ownerId:s.id,category:v.category,name:v.name');
          const responseHeaders=new Headers(result.headers);for(const key of ['content-length','etag','content-encoding'])responseHeaders.delete(key);responseHeaders.set('Cache-Control','no-store');
          return new Response(source,{status:result.status,headers:responseHeaders});
        }
        if(result.ok&&request.method==='GET'&&['/api/link/public','/api/catalog/public'].includes(url.pathname)&&env.IDENTITY_DB){
          const data=JSON.parse(new TextDecoder().decode(await cosmeticsBody(result,4194304)));
          await filterPublishedGallery(data,env.IDENTITY_DB,url.origin);
          const samples=new Set((await env.IDENTITY_DB.prepare('SELECT owner_id FROM catalog_sample_owners').all()).results.map(r=>r.owner_id));
          for(const [key,value] of Object.entries(data))if(Array.isArray(value))data[key]=value.filter(item=>!samples.has(item?.ownerId||item?.owner_id||item?.salonId||item?.id));
          const blocked=new Set((await env.IDENTITY_DB.prepare("SELECT owner_id FROM salonati_admin_account_controls WHERE app='salon' AND status!='active'").all()).results.map(r=>r.owner_id));
          for(const [key,value] of Object.entries(data))if(Array.isArray(value))data[key]=value.filter(item=>!blocked.has(item?.ownerId||item?.owner_id||item?.salonId||item?.id));

          const responseHeaders=new Headers(result.headers);for(const name of ['content-length','etag'])responseHeaders.delete(name);responseHeaders.set('Cache-Control','no-store');
          return Response.json(data,{status:result.status,headers:responseHeaders});
        }
        if(result.ok&&request.method==='GET'&&url.pathname==='/api/catalog/admin/registrations'&&env.IDENTITY_DB){
          const data=await result.json();
          const controls=new Map((await env.IDENTITY_DB.prepare("SELECT owner_id,status FROM salonati_admin_account_controls WHERE app='salon'").all()).results.map(r=>[r.owner_id,r.status]));
          data.registrations=(data.registrations||[]).filter(r=>controls.get(r.ownerId)!=='deleted').map(r=>({...r,managementStatus:controls.get(r.ownerId)||'active'}));
          const headers=new Headers(result.headers);for(const key of ['content-length','etag'])headers.delete(key);headers.set('Cache-Control','no-store');
          return Response.json(data,{status:result.status,headers});
        }
        if(remembered&&url.pathname!=='/api/link/customer/logout'){const renewed=new Headers(result.headers);renewed.set('Set-Cookie',remembered.cookie);return new Response(result.body,{status:result.status,headers:renewed});}
        return await protectOwnerBookingContacts(request,url,result);
      }
      catch { return Response.json({error:'service_unavailable'}, {status:503,headers:{'Cache-Control':'no-store'}}); }
    }
    const response = await env.ASSETS.fetch(request);
    // Assets may resolve legacy paths to the SPA shell; apply authentication there too.
    if(role==='customer'&&response.ok&&response.headers.get('content-type')?.includes('text/html')&&!['/terms.html','/privacy.html','/delete-account.html'].includes(url.pathname)){
      if(!remembered)return new Response(request.method==='HEAD'?null:customerEntry,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Set-Cookie':'__Host-salonati-customer=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'}});
      accountId=remembered.id;
    }
    if (['customer','salon','cosmetics'].includes(role) && response.ok && response.headers.get('content-type')?.includes('text/html')) {
      const headers=new Headers(response.headers);
      for(const name of ['content-length','etag','content-md5','digest','content-digest','repr-digest'])headers.delete(name);
      headers.set('Cache-Control','private, no-store');
      if(remembered)headers.set('Set-Cookie',remembered.cookie);
      return new HTMLRewriter().on('head',{element(el){el.prepend('<script>window.SALONATI_ACCOUNT_ID='+JSON.stringify(accountId)+'</script>',{html:true});}}).transform(new Response(response.body,{status:response.status,headers}));
    }
    return response;
    } catch {return Response.json({error:'service_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
  }
};


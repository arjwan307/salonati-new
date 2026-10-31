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
  const target=role==='cosmetics'?new URL('/api/catalog/login',request.url):request.url;
  return env.SALONATI_API.fetch(new Request(target,{method:'POST',headers,body:JSON.stringify(body)}));
}
function allowed(path) {
  if (backendAssets.has(path)) return true;
  if (path === '/api/catalog/public' || path.startsWith('/api/catalog/media/') || path==='/api/cosmetics/public' || path.startsWith('/api/cosmetics/media/')) return true;
  if (role === 'customer') return path === '/api/link/public' || path === '/api/link/session' || path.startsWith('/api/link/customer/') || path.startsWith('/api/catalog/workflow/customer/') || path.startsWith('/api/cosmetics/customer/');
  if (role === 'cosmetics') return ['/api/cosmetics/me','/api/cosmetics/login','/api/cosmetics/register','/api/cosmetics/logout','/api/cosmetics/state','/api/cosmetics/media','/api/cosmetics/orders','/api/cosmetics/orders/status'].includes(path);
  if (['/api/catalog/login','/api/catalog/logout','/api/catalog/me'].includes(path)) return true;
  if (role === 'admin') return path.startsWith('/api/catalog/admin/') || path.startsWith('/api/catalog/finance/') || /^\/api\/catalog\/(reviews|product-reviews|ad-reviews)(\/|$)/.test(path) || path === '/api/catalog/workflow/notifications' || path === '/api/catalog/media' || path === '/api/catalog/setup';
  return path === '/api/link/team' || path.startsWith('/api/catalog/workflow/owner/') || ['/api/catalog/register','/api/catalog/registration','/api/catalog/location','/api/catalog/services','/api/catalog/products','/api/catalog/advertisements','/api/catalog/media','/api/catalog/finance/payment-notifications','/api/catalog/finance/payment-notifications/read','/api/catalog/finance/statement','/api/catalog/finance/options'].includes(path) || /^\/api\/catalog\/(services|products|advertisements)\//.test(path);
}
async function catalogAppSession(request,env){
  if(!env.IDENTITY_DB)return {status:503};
  const token=/(?:^|;\s*)__Host-catalog=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie')||'')?.[1];
  if(!token)return {status:401};
  const hash=asHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
  const row=await env.IDENTITY_DB.prepare("SELECT p.account_id FROM catalog_sessions s JOIN salonati_phone_identities p ON p.account_id=s.account_id WHERE s.token_hash=? AND p.app=? AND julianday(s.expires_at)>julianday('now')").bind(hash,role).first();
  return row?{status:200,accountId:row.account_id}:{status:401};
}
export default {
  async fetch(request, env) {
    try {
    const url = new URL(request.url);
    let accountId = 'guest';
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
    // Public, read-only approved catalog for the customer app. Published services only.
    if (role === 'customer' && url.pathname === '/api/customer/approved-catalog' && request.method === 'GET') {
      if (!env.IDENTITY_DB) return Response.json({error:'catalog_unavailable'},{status:503});
      const db=env.IDENTITY_DB;
      const salons=(await db.prepare("SELECT a.id AS ownerId,a.salon_name AS name,a.area,a.latitude AS lat,a.longitude AS lng,r.facade_media_id AS facadeId FROM catalog_accounts a JOIN catalog_registrations r ON r.owner_id=a.id WHERE a.role='owner' AND r.status='approved' ORDER BY a.salon_name").all()).results;
      const services=(await db.prepare("SELECT s.id,s.owner_id AS ownerId,r.name,r.category,r.price,r.discount_price AS discountPrice,r.discount_start AS discountStart,r.discount_end AS discountEnd,r.minutes,r.media_id AS mediaId FROM catalog_services s JOIN catalog_revisions r ON r.id=s.published_revision JOIN catalog_registrations reg ON reg.owner_id=s.owner_id WHERE reg.status='approved' AND r.status='approved' AND r.active=1").all()).results;
      const team=(await db.prepare("SELECT t.id,t.owner_id AS ownerId,t.name,t.specialty FROM catalog_team t JOIN catalog_registrations reg ON reg.owner_id=t.owner_id WHERE reg.status='approved' AND t.active=1").all()).results;
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
      if(service.published_revision || service.status!=='rejected')return Response.json({error:'only_unpublished_rejected_services_removable'},{status:409});
      const referenced=(await db.prepare("SELECT COUNT(*) AS count FROM catalog_revisions WHERE service_id=? AND status!='rejected'").bind(id).first())?.count;
      if(referenced)return Response.json({error:'service_has_other_revisions'},{status:409});
      try{
        await db.batch([
          db.prepare("DELETE FROM catalog_revisions WHERE service_id=? AND owner_id=?").bind(id,session.accountId),
          db.prepare("DELETE FROM catalog_services WHERE id=? AND owner_id=? AND published_revision IS NULL").bind(id,session.accountId)
        ]);
      }catch{return Response.json({error:'service_delete_blocked'},{status:409});}
      return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
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
      const body=await request.json().catch(()=>null),date=body?.date,serviceId=body?.serviceId;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!(serviceId==='*'||/^[a-zA-Z0-9-]{16,80}$/.test(serviceId||''))||!Array.isArray(body?.times)||body.times.length>29||body.times.some(t=>!/^\d{2}:\d{2}$/.test(t)))return Response.json({error:'invalid_blocks'},{status:400});
      if(serviceId!=='*' && !(await db.prepare("SELECT id FROM catalog_services WHERE id=? AND owner_id=?").bind(serviceId,session.accountId).first()))return Response.json({error:'service_not_owned'},{status:403});
      const unique=[...new Set(body.times)],writes=[db.prepare("DELETE FROM catalog_booking_blocks WHERE owner_id=? AND slot_date=? AND service_id=?").bind(session.accountId,date,serviceId),...unique.map(t=>db.prepare("INSERT INTO catalog_booking_blocks(owner_id,slot_date,slot_time,service_id) VALUES(?,?,?,?)").bind(session.accountId,date,t,serviceId))];
      await db.batch(writes);
      return Response.json({ok:true,count:unique.length});
    }
    if(role==='customer' && url.pathname==='/api/catalog/workflow/customer/bookings' && request.method==='POST' && env.IDENTITY_DB){
      const body=await request.clone().json().catch(()=>null);
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
      const cosmetics=await cosmeticsRoutes(request,env,url);if(cosmetics)return cosmetics;
      const headers = new Headers(request.headers);
      // Never forward the demo privilege header to the live service.
      headers.delete('x-salonati-app');
      const publicPath=['/api/link/public','/api/catalog/public'].includes(url.pathname)||backendAssets.has(url.pathname);
      const mediaPath=url.pathname.startsWith('/api/catalog/media/');
      if(['admin','salon'].includes(role)&&!publicPath){
        const session=await catalogAppSession(request,env);
        if(session.status!==200){if(mediaPath)headers.delete('cookie');else return Response.json({error:'app_session_required'},{status:session.status});}
      }else if(publicPath||mediaPath)headers.delete('cookie');
      try {
        const result=await env.SALONATI_API.fetch(new Request(request,{headers}));
        if(result.ok&&request.method==='GET'&&['/api/link/public','/api/catalog/public'].includes(url.pathname)&&env.IDENTITY_DB){
          const data=JSON.parse(new TextDecoder().decode(await cosmeticsBody(result,4194304)));
          const samples=new Set((await env.IDENTITY_DB.prepare('SELECT owner_id FROM catalog_sample_owners').all()).results.map(r=>r.owner_id));
          for(const [key,value] of Object.entries(data))if(Array.isArray(value))data[key]=value.filter(item=>!samples.has(item?.ownerId||item?.owner_id||item?.salonId||item?.id));
          const responseHeaders=new Headers(result.headers);for(const name of ['content-length','etag'])responseHeaders.delete(name);responseHeaders.set('Cache-Control','no-store');
          return Response.json(data,{status:result.status,headers:responseHeaders});
        }
        return await protectOwnerBookingContacts(request,url,result);
      }
      catch { return Response.json({error:'service_unavailable'}, {status:503,headers:{'Cache-Control':'no-store'}}); }
    }
    const response = await env.ASSETS.fetch(request);
    if (['customer','salon','cosmetics'].includes(role) && response.ok && response.headers.get('content-type')?.includes('text/html')) {
      const headers=new Headers(response.headers);
      for(const name of ['content-length','etag','content-md5','digest','content-digest','repr-digest'])headers.delete(name);
      headers.set('Cache-Control','private, no-store');
      return new HTMLRewriter().on('head',{element(el){el.prepend('<script>window.SALONATI_ACCOUNT_ID='+JSON.stringify(accountId)+'</script>',{html:true});}}).transform(new Response(response.body,{status:response.status,headers}));
    }
    return response;
    } catch {return Response.json({error:'service_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
  }
};

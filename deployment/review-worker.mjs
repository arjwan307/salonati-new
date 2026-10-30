// Deliberately password-free demo access. Never build this into a clean app.
const role = '__APP_ROLE__';
const cookieName = '__Host-salonati-review-v2';
const cookie = `${cookieName}=1; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
const json = (data, status = 200, headers = {}) => {const h=new Headers(headers);h.set('Cache-Control','no-store');return Response.json(data,{status,headers:h});};
const loginPage = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>دخول صالوناتي</title><style>body{margin:0;background:#f3ebfa;color:#38114f;font:16px Tahoma,sans-serif;display:grid;min-height:100dvh;place-items:center}main{width:min(85%,370px);background:white;padding:28px;border-radius:22px;box-shadow:0 8px 40px #6d3b8d22}label,input,button{display:block;box-sizing:border-box;width:100%;margin:14px 0}input,button{padding:14px;border:1px solid #dbc8eb;border-radius:12px;font:inherit}button{background:#652b91;color:white;cursor:pointer}small{color:#70527f}</style><main><h1>صالوناتي</h1><h2>تسجيل الدخول</h2><form action="/review-login" method="post"><label for="phone">رقم الهاتف</label><input id="phone" name="phone" type="tel" autocomplete="username" required><label for="password">كلمة المرور</label><input id="password" name="password" type="password" autocomplete="current-password" required><button>دخول</button></form><small>نسخة التجربة — يُقبل أي رقم هاتف وكلمة مرور.</small></main></html>`;
const backendAssets = new Set(['/salonati-link.js','/loyalty-ui.js','/vendor/qrcode.js','/vendor/jsQR.js']);
export default {
  async fetch(request, env) {
    try {
    const url = new URL(request.url);
    if (url.hostname !== `salonati-${role}-review.pages.dev`) return json({error:'review_host_required'}, 403);
    const signedIn = (request.headers.get('cookie') || '').split(';').some(c => c.trim() === `${cookieName}=1`);
    if (url.pathname === '/review-login' && request.method === 'POST') {
      if (request.headers.get('origin') !== url.origin) return json({error:'origin_denied'},403);
      if (Number(request.headers.get('content-length') || 0) > 4096) return json({error:'invalid_input'},413);
      const body = new URLSearchParams(new TextDecoder().decode(await cosmeticsBody(request,4096)));
      if (!String(body.get('phone') || '').trim() || !String(body.get('password') || '')) return json({error:'fields_required'},400);
      // Never persist, log or forward demo passwords.
      const headers=new Headers({Location:'/', 'Set-Cookie':cookie,'Cache-Control':'no-store'});
      {
        if(!env.IDENTITY_DB)return json({error:'trial_api_unavailable'},503);
        const id=crypto.randomUUID(),token=asHex(crypto.getRandomValues(new Uint8Array(32))),hash=asHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
        const salt=asHex(crypto.getRandomValues(new Uint8Array(32))),digest=asHex(crypto.getRandomValues(new Uint8Array(32)));
        const create=role==='customer'?env.IDENTITY_DB.prepare('INSERT INTO catalog_customer_accounts(id,username,name,phone,salt,digest,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,'review-'+id,'زبونة تجريبية',normalizePhone(body.get('phone')),salt,digest,new Date().toISOString()):env.IDENTITY_DB.prepare('INSERT INTO catalog_accounts(id,email,role,salt,digest,salon_name,area) VALUES(?,?,?,?,?,?,?)').bind(id,'review-'+id+'@salonati.invalid',role==='admin'?'admin':'owner',salt,digest,role==='cosmetics'?'كوزمتك تجريبي':role==='salon'?'صالون تجريبي':'إدارة التجربة','');
        const session=role==='customer'?env.IDENTITY_DB.prepare("INSERT INTO catalog_customer_sessions(token_hash,customer_id,expires_at) VALUES(?,?,datetime('now','+8 hours'))").bind(hash,id):env.IDENTITY_DB.prepare("INSERT INTO catalog_sessions(token_hash,account_id,expires_at) VALUES(?,?,datetime('now','+8 hours'))").bind(hash,id);
        await env.IDENTITY_DB.batch([create,env.IDENTITY_DB.prepare('INSERT INTO salonati_phone_identities(app,phone,account_id) VALUES(?,?,?)').bind(role,normalizePhone(body.get('phone'))+'#'+id,id),session]);
        headers.append('Set-Cookie',(role==='customer'?'__Host-salonati-customer':'__Host-catalog')+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800');
      }
      return new Response(null,{status:303,headers});
    }
    if ((url.pathname === '/review-logout'||url.pathname==='/api/cosmetics/logout') && request.method === 'POST') {
      if (request.headers.get('origin') !== url.origin) return json({error:'origin_denied'},403);
      const headers=new Headers({Location:'/', 'Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,'Cache-Control':'no-store'});
      headers.append('Set-Cookie','__Host-salonati-customer=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
      headers.append('Set-Cookie','__Host-catalog=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
      return url.pathname==='/api/cosmetics/logout'?json({ok:true},200,headers):new Response(null,{status:303,headers});
    }
    if (!signedIn) {
      if (url.pathname.startsWith('/api/')) return json({error:'login_required'},401);
      return new Response(request.method==='HEAD'?null:loginPage,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
    }
    if (url.pathname.startsWith('/api/') || backendAssets.has(url.pathname)) {
      if(!allowed(url.pathname))return json({error:'app_route_denied'},403);
      if (!env.TRIAL_API) return json({error:'trial_api_unavailable'},503);
      const headers = new Headers(request.headers);
      headers.delete('x-salonati-app');
      const publicPath=['/api/link/public','/api/catalog/public'].includes(url.pathname)||backendAssets.has(url.pathname);
      const mediaPath=url.pathname.startsWith('/api/catalog/media/');
      if(['admin','salon'].includes(role)&&!publicPath&&!url.pathname.startsWith('/api/catalog/admin/cosmetics-')){
        const session=await catalogAppSession(request,env);if(session.status!==200){if(mediaPath)headers.delete('cookie');else return json({error:'app_session_required'},session.status);}
      }else if(publicPath||mediaPath)headers.delete('cookie');
      try {
        const forwarded=new Request(request,{headers});
        const result=await cosmeticsRoutes(forwarded,{...env,SALONATI_API:env.TRIAL_API},url);if(result)return result;
        return await protectOwnerBookingContacts(request,url,await env.TRIAL_API.fetch(forwarded));
      }
      catch { return json({error:'trial_api_unavailable'},503); }
    }
    let accountId='review-'+role;
    if(['admin','salon','cosmetics'].includes(role)&&['/','/index.html'].includes(url.pathname)){
      const session=await catalogAppSession(request,env);if(session.status!==200)return new Response(loginPage,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`}});accountId=session.accountId;
    }
    if(role==='customer'&&['/','/index.html'].includes(url.pathname)){
      const me=await env.TRIAL_API.fetch(new Request(url.origin+'/api/link/customer/me',{headers:request.headers}));
      if(!me.ok)return new Response(loginPage,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`}});
      accountId=(await me.json()).account?.id;if(!/^[a-zA-Z0-9-]{16,80}$/.test(accountId))return json({error:'invalid_session'},401);
    }
    const response=await env.ASSETS.fetch(request);
    if(response.ok&&response.headers.get('content-type')?.includes('text/html')){
      const headers=new Headers(response.headers);for(const name of ['content-length','etag','content-md5','digest','content-digest','repr-digest'])headers.delete(name);headers.set('Cache-Control','private, no-store');
      return new HTMLRewriter().on('head',{element(el){el.prepend('<script>window.SALONATI_ACCOUNT_ID='+JSON.stringify(accountId)+'</script>',{html:true});}}).transform(new Response(response.body,{status:response.status,headers}));
    }
    return response;
    }catch{return json({error:'trial_api_unavailable'},503);}
  }
};

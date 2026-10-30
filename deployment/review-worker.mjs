// Deliberately password-free demo access. Never build this into a clean app.
const role = '__APP_ROLE__';
const cookieName = '__Host-salonati-review';
const cookie = `${cookieName}=1; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
const json = (data, status = 200, headers = {}) => Response.json(data, {status, headers: {'Cache-Control':'no-store', ...headers}});
const loginPage = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>دخول صالوناتي</title><style>body{margin:0;background:#f3ebfa;color:#38114f;font:16px Tahoma,sans-serif;display:grid;min-height:100dvh;place-items:center}main{width:min(85%,370px);background:white;padding:28px;border-radius:22px;box-shadow:0 8px 40px #6d3b8d22}label,input,button{display:block;box-sizing:border-box;width:100%;margin:14px 0}input,button{padding:14px;border:1px solid #dbc8eb;border-radius:12px;font:inherit}button{background:#652b91;color:white;cursor:pointer}small{color:#70527f}</style><main><h1>صالوناتي</h1><h2>تسجيل الدخول</h2><form action="/review-login" method="post"><label for="phone">رقم الهاتف</label><input id="phone" name="phone" type="tel" autocomplete="username" required><label for="password">كلمة المرور</label><input id="password" name="password" type="password" autocomplete="current-password" required><button>دخول</button></form><small>نسخة التجربة — يُقبل أي رقم هاتف وكلمة مرور.</small></main></html>`;
const backendAssets = new Set(['/salonati-link.js','/vendor/qrcode.js','/vendor/jsQR.js']);
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname !== `salonati-${role}-review.pages.dev`) return json({error:'review_host_required'}, 403);
    const signedIn = (request.headers.get('cookie') || '').split(';').some(c => c.trim() === `${cookieName}=1`);
    if (url.pathname === '/review-login' && request.method === 'POST') {
      if (request.headers.get('origin') !== url.origin) return json({error:'origin_denied'},403);
      if (Number(request.headers.get('content-length') || 0) > 4096) return json({error:'invalid_input'},413);
      const body = await request.formData();
      if (!String(body.get('phone') || '').trim() || !String(body.get('password') || '')) return json({error:'fields_required'},400);
      // Never persist, log or forward demo passwords.
      return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':cookie,'Cache-Control':'no-store'}});
    }
    if (url.pathname === '/review-logout' && request.method === 'POST') {
      if (request.headers.get('origin') !== url.origin) return json({error:'origin_denied'},403);
      return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,'Cache-Control':'no-store'}});
    }
    if (!signedIn) {
      if (url.pathname.startsWith('/api/')) return json({error:'login_required'},401);
      return new Response(request.method==='HEAD'?null:loginPage,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
    }
    if (url.pathname.startsWith('/api/') || backendAssets.has(url.pathname)) {
      if (!env.TRIAL_API) return json({error:'trial_api_unavailable'},503);
      const headers = new Headers(request.headers);
      headers.delete('x-salonati-app');
      headers.set('x-salonati-app',role);
      try { return await env.TRIAL_API.fetch(new Request(request,{headers})); }
      catch { return json({error:'trial_api_unavailable'},503); }
    }
    return env.ASSETS.fetch(request);
  }
};

// Live apps use the production API and its existing authenticated sessions.
const role = '__APP_ROLE__';
const backendAssets = new Set(['/salonati-link.js','/loyalty-ui.js','/vendor/qrcode.js','/vendor/jsQR.js']);
function normalizePhone(value) {
  return String(value || '').replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[\s\u200e\u200f\u2066-\u2069()-]/g,'').replace(/^(?:\+964|00964)/,'0');
}
async function phoneLogin(request, env, url) {
  if (!env.IDENTITY_DB) return Response.json({error:'identity_not_configured'},{status:503});
  if (request.headers.get('origin') !== url.origin) return Response.json({error:'origin_denied'},{status:403});
  const d = await request.json().catch(()=>null);
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
    if (url.pathname.startsWith('/api/') || backendAssets.has(url.pathname)) {
      if (!allowed(url.pathname)) return Response.json({error:'app_route_denied'}, {status:403});
      if (!env.SALONATI_API) return Response.json({error:'api_not_configured'}, {status:503});
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

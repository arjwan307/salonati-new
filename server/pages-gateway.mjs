// Each Pages app uses the same backend and databases; host-scoped sessions stay on that app.
const APP=__APP_ROLE__;
const entries={customer:'/customer/',salon:'/',admin:'/admin/moderation'};
const names={customer:'تطبيق الزبونة',salon:'تطبيق الصالون',admin:'إدارة صالوناتي'};
export default {async fetch(request,env){
 if(!env.SALONATI)return new Response('الخدمة غير متاحة مؤقتًا',{status:503});
 const url=new URL(request.url);
 if(url.pathname==='/manifest.webmanifest')return Response.json({name:'صالوناتي | '+names[APP],short_name:'صالوناتي',lang:'ar',dir:'rtl',start_url:'/',scope:'/',display:'standalone',background_color:'#f3ebfa',theme_color:'#4b0c9b'},{headers:{'Cache-Control':'no-store'}});
 if(url.pathname==='/'||url.pathname==='/index.html')url.pathname=entries[APP];
 const response=await env.SALONATI.fetch(new Request(url,request));
 const headers=new Headers(response.headers);headers.set('X-Salonati-App',APP);headers.set('X-Robots-Tag','noindex, nofollow');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}};

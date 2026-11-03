// Server sessions, including restored tabs, are the only authority for opening the app.
(()=>{'use strict';
const request=window.fetch.bind(window);let checking=null,leaving=false;
const conceal=()=>{document.documentElement.style.visibility='hidden';};
const reveal=()=>{document.documentElement.style.visibility='';};
function signedOut(){if(leaving)return;leaving=true;conceal();const account=window.SALONATI_ACCOUNT_ID;if(account)for(const kind of ['salonati_name','salonati_username','salonati_phone','salonati_address','salonati_bookings','salonati_logged_in','salonati_cosmetics_basket'])try{localStorage.removeItem('salonati:'+account+':'+kind);}catch{}document.getElementById('app')?.replaceChildren();document.getElementById('salonati-fixed-nav')?.remove();location.replace('/');}
async function verify(){if(leaving)return;if(checking)return checking;checking=(async()=>{try{const response=await request('/api/link/customer/me',{credentials:'same-origin',cache:'no-store'});if(response.status===401||response.status===403){signedOut();return;}if(!response.ok)throw Error('session_unavailable');const data=await response.json();if(!data.account?.id||data.account.id!==window.SALONATI_ACCOUNT_ID){signedOut();return;}if(typeof state==='object'&&(state.name!==data.account.name||state.phone!==(data.account.phone||''))){state.isLoggedIn=true;state.name=data.account.name||'';state.phone=data.account.phone||'';if(typeof render==='function')render();}reveal();}catch{if(!leaving){document.getElementById('app')?.replaceChildren();document.getElementById('salonati-fixed-nav')?.remove();const main=document.createElement('main');main.className='panel';main.textContent='تعذر التحقق من الجلسة. أعيدي تحميل التطبيق بعد عودة الاتصال.';document.body.replaceChildren(main);reveal();}}finally{checking=null;}})();return checking;}
window.fetch=async function(input,options){const response=await request(input,options);const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/api/')&&response.status===401)signedOut();return response;};
window.addEventListener('pageshow',()=>{conceal();void verify();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)conceal();else void verify();});
window.addEventListener('pagehide',conceal);
setInterval(()=>{if(!document.hidden)void verify();},15000);
conceal();
})();

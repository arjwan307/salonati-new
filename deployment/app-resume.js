// Mobile browsers suspend timers and requests while an app is in the background.
(()=>{'use strict';
const original=window.fetch.bind(window);
window.fetch=function(input,options={}){
 const url=new URL(typeof input==='string'?input:input.url,location.href),method=String(options.method||input?.method||'GET').toUpperCase();
 if(url.origin!==location.origin||!url.pathname.startsWith('/api/')||method!=='GET')return original(input,options);
 const controller=new AbortController(),signal=options.signal||input?.signal;
 const abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(abort,15000);
 return original(input,{...options,cache:'no-store',signal:controller.signal}).finally(()=>{clearTimeout(timeout);signal?.removeEventListener('abort',abort);});
};
let timer,pending=false;
function resume(){pending=true;clearTimeout(timer);timer=setTimeout(()=>{if(document.hidden||navigator.onLine===false)return;if(document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'))return;pending=false;window.dispatchEvent(new Event('salonati:resume'));},200);}
for(const name of ['pageshow','focus','online'])window.addEventListener(name,resume);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume();});
document.addEventListener('focusout',()=>{if(pending)resume();});
// Only actual use renews the two-hour deadline; polling merely checks it.
let activityPending=false,hasSession=false,lastActivityAttempt=-Infinity;
async function sessionActivity(renew){
 if(document.hidden||navigator.onLine===false||activityPending)return;
 if(renew&&Date.now()-lastActivityAttempt<60000)return;
 if(renew)lastActivityAttempt=Date.now();activityPending=true;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{const r=await original('/api/session/activity',{method:renew?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal});if(r.ok)hasSession=true;else if(r.status===401&&hasSession){hasSession=false;document.documentElement.style.visibility='hidden';location.replace('/');}}
 catch{}finally{clearTimeout(timeout);activityPending=false;}
}
for(const name of ['pointerdown','keydown','scroll'])window.addEventListener(name,event=>{if(event.isTrusted)void sessionActivity(true);},{passive:true});
for(const name of ['pageshow','focus','online'])window.addEventListener(name,()=>void sessionActivity(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void sessionActivity(true);});
setInterval(()=>{if(hasSession)void sessionActivity(false);},30000);
})();

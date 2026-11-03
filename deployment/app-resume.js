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
})();

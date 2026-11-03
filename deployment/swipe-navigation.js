// Navigate through the same buttons as taps, preserving their validation and history.
(()=>{'use strict';
let gesture=null,animating=false,suppressUntil=0;
const style=document.createElement('style');style.textContent='html{overflow-x:clip}';document.head.append(style);
const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const root=()=>document.getElementById('app')||document.getElementById('main')||document.querySelector('main');
const visible=el=>el&&!el.hidden&&!el.closest('[hidden]')&&getComputedStyle(el).display!=='none';
function buttons(nav){return nav&&visible(nav)?Array.from(nav.querySelectorAll('button')).filter(b=>visible(b)&&!b.disabled):[];}
function selected(list){return list.findIndex(b=>b.matches('.on,.active,[aria-current="page"],[aria-selected="true"]'));}
function destination(dx,startX){
 const rtl=getComputedStyle(document.documentElement).direction==='rtl',step=(dx>0?1:-1)*(rtl?1:-1),surface=root();
 const back=surface?.querySelector('header button.back')||document.getElementById('salonBackButton');
 const width=window.innerWidth;
 if(visible(back)&&(rtl?startX>width-56&&dx<0:startX<56&&dx>0))return {button:back,key:'back'};
 const local=surface?.querySelector('.tabs');
 const nav=buttons(local).length>1?local:document.getElementById('adminNav')||document.getElementById('nav')||document.querySelector('#salonati-fixed-nav nav,nav.nav');
 const list=buttons(nav),current=selected(list),next=current+step;
 if(current>=0){if(next<0||next>=list.length)return null;return {button:list[next],key:(nav.id||nav.className)+':'+list[current].textContent.trim()+':'+list[next].textContent.trim()};}
 return visible(back)&&(rtl?dx<0:dx>0)?{button:back,key:'back'}:null;
}
function reset(surface){surface.style.removeProperty('transform');surface.style.removeProperty('transition');surface.style.removeProperty('will-change');}
function settle(surface,transform,done){
 if(reduced()){surface.style.transform=transform;done();return;}
 surface.style.transition='transform 180ms cubic-bezier(.2,.8,.2,1)';surface.style.transform=transform;
 let completed=false;const finish=()=>{if(completed)return;completed=true;surface.removeEventListener('transitionend',end);clearTimeout(timer);done();};
 const end=event=>{if(event.target===surface&&event.propertyName==='transform')finish();};
 const timer=setTimeout(finish,230);surface.addEventListener('transitionend',end);
}
function cancel(){const g=gesture;gesture=null;if(g?.locked){animating=true;settle(g.surface,'translate3d(0,0,0)',()=>{reset(g.surface);animating=false;});}}
document.addEventListener('input',event=>{if(event.target.matches('input,textarea,[contenteditable="true"]'))event.target.dataset.salonatiSwipeDirty='true';},true);
document.addEventListener('change',event=>{if(event.target.matches('select,input[type="file"]'))event.target.dataset.salonatiSwipeDirty='true';},true);
document.addEventListener('touchstart',event=>{
 if(animating||event.touches.length!==1){cancel();return;}
 const target=event.target,surface=root(),point=event.touches[0];
 if(!surface?.contains(target)||document.querySelector('dialog[open]')||target.closest('button,a,input,textarea,select,label,video,audio,[contenteditable="true"],.sa-banner,.thumbs,[data-no-swipe]')||document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')||surface.querySelector('[data-salonati-swipe-dirty]'))return;
 // Leave the browser's native edge gesture and horizontal carousels intact.
 if(point.clientX<20||point.clientX>window.innerWidth-20)return;
 for(let node=target;node&&node!==surface;node=node.parentElement)if(node.scrollWidth>node.clientWidth+4&&/auto|scroll/.test(getComputedStyle(node).overflowX))return;
 gesture={surface,x:point.clientX,y:point.clientY,dx:0,started:performance.now(),locked:false,key:null};
},{passive:true});
document.addEventListener('touchmove',event=>{
 const g=gesture;if(!g)return;if(event.touches.length!==1){cancel();return;}
 const point=event.touches[0],dx=point.clientX-g.x,dy=point.clientY-g.y;
 if(!g.locked){if(Math.max(Math.abs(dx),Math.abs(dy))<10)return;if(Math.abs(dy)>Math.abs(dx)*.75){gesture=null;return;}g.locked=true;g.surface.style.willChange='transform';g.surface.style.transition='none';}
 if(!event.cancelable){cancel();return;}event.preventDefault();g.dx=dx;
 const next=destination(dx,g.x);g.key=next?.key||null;
 const distance=next?Math.sign(dx)*Math.min(Math.abs(dx),window.innerWidth*.8):dx*.16;
 g.surface.style.transform=`translate3d(${distance}px,0,0)`;
},{passive:false});
document.addEventListener('touchend',()=>{
 const g=gesture;if(!g)return;gesture=null;if(!g.locked)return;
 suppressUntil=Date.now()+400;
 const next=destination(g.dx,g.x),distance=Math.abs(g.dx),velocity=distance/Math.max(1,performance.now()-g.started);
 if(!next||next.key!==g.key||!(distance>Math.max(56,window.innerWidth*.18)||(distance>35&&velocity>.5))){animating=true;settle(g.surface,'translate3d(0,0,0)',()=>{reset(g.surface);animating=false;});return;}
 animating=true;const direction=Math.sign(g.dx);
 settle(g.surface,`translate3d(${direction*window.innerWidth}px,0,0)`,()=>{
  const current=destination(g.dx,g.x);
  if(!current||current.key!==next.key){reset(g.surface);animating=false;return;}
  try{current.button.click();}catch(error){reset(g.surface);animating=false;throw error;}
  const incoming=root();reset(g.surface);if(!incoming){animating=false;return;}
  incoming.style.transition='none';incoming.style.transform=`translate3d(${-direction*window.innerWidth}px,0,0)`;incoming.style.willChange='transform';
  requestAnimationFrame(()=>requestAnimationFrame(()=>settle(incoming,'translate3d(0,0,0)',()=>{reset(incoming);animating=false;})));
 });
},{passive:true});
document.addEventListener('touchcancel',cancel,{passive:true});
// Suppress only the synthesized tap following a drag, never the button.click above.
document.addEventListener('click',event=>{if(event.isTrusted&&Date.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
window.addEventListener('pagehide',()=>{if(gesture)reset(gesture.surface);gesture=null;});
})();

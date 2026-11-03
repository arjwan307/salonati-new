import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInContext} from 'node:vm';
const require=createRequire(process.env.SALONATI_JSDOM_PACKAGE||'/tmp/salonati-ui/package.json'),{JSDOM}=require('jsdom');
const source=await readFile('deployment/swipe-navigation.js','utf8');
for(const layout of ['customer','salon','cosmetics','admin']){
 const dom=new JSDOM('<html style="direction:rtl"><head></head><body><main id="'+(layout==='customer'?'app':'main')+'"><p id="surface">الرئيسية</p></main><nav id="'+(layout==='admin'?'adminNav':'nav')+'"><button class="on">الرئيسية</button><button>الحجوزات</button><button>الحساب</button></nav></body></html>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,c=dom.getInternalVMContext();
 w.matchMedia=()=>({matches:true});w.requestAnimationFrame=fn=>fn();let current=0;
 const nav=w.document.querySelector('nav'),surface=w.document.querySelector('main');
 const choose=index=>{current=index;[...nav.children].forEach((b,i)=>b.className=i===index?'on':'');surface.innerHTML='<p id="surface">'+nav.children[index].textContent+'</p>';};[...nav.children].forEach((b,i)=>b.onclick=()=>choose(i));
 const touch=(type,x,y,target=w.document.getElementById('surface'))=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'||type==='touchcancel'?[]:[{clientX:x,clientY:y}]});target.dispatchEvent(e);return e;};
 const swipe=(x,dx,dy=0,target)=>{touch('touchstart',x,100,target);const move=touch('touchmove',x+dx,100+dy,target);touch('touchend',x+dx,100+dy,target);return move;};
 try{
  runInContext(source,c);touch('touchstart',180,100);const move=touch('touchmove',430,102);assert.equal(move.defaultPrevented,true);assert.match(surface.style.transform,/250px/);touch('touchend',430,102);assert.equal(current,1);assert.match(surface.textContent,/الحجوزات/);assert.equal(surface.style.transform,'');
  swipe(430,-250);assert.equal(current,0);assert.equal(swipe(180,5,180).defaultPrevented,false);assert.equal(current,0);swipe(180,16);assert.equal(current,0);swipe(10,250);assert.equal(current,0);
  touch('touchstart',180,100);touch('touchmove',430,100);touch('touchcancel',430,100);assert.equal(current,0);assert.equal(surface.style.transform,'');
  const input=w.document.createElement('input');surface.append(input);input.dispatchEvent(new w.Event('input',{bubbles:true}));swipe(180,250);assert.equal(current,0);input.remove();
  surface.innerHTML='<div class="tabs"><button class="on">الخدمات</button><button>قسم المحجبات</button><button>قسم العرائس</button></div><p id="surface">الخدمات</p>';let section=0;const local=surface.querySelector('.tabs');[...local.children].forEach((b,i)=>b.onclick=()=>{section=i;[...local.children].forEach((x,j)=>x.className=j===i?'on':'');});swipe(180,250);assert.equal(section,1);assert.equal(current,0);swipe(180,250);assert.equal(section,2);
  const gallery=w.document.createElement('div');gallery.style.overflowX='auto';gallery.textContent='صور';Object.defineProperty(gallery,'scrollWidth',{value:500});Object.defineProperty(gallery,'clientWidth',{value:200});surface.append(gallery);swipe(430,-250,0,gallery);assert.equal(section,2);
  console.log('PASS: '+layout+' swipe changes real navigation, tracks the finger, preserves vertical/carousel scrolling and drafts, handles cancellation and nested salon sections');
 }finally{w.close();}
}
// Exercise both animation phases, including the transition-end fallback cleanup.
{
 const dom=new JSDOM('<html style="direction:rtl"><head></head><body><main id="app"><p>الرئيسية</p></main><nav id="nav"><button class="on">الرئيسية</button><button>الحجوزات</button></nav></body></html>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,surface=w.document.querySelector('main'),pending=new Map();let timer=0,navigated=false;
 w.matchMedia=()=>({matches:false});w.requestAnimationFrame=fn=>fn();w.setTimeout=fn=>{pending.set(++timer,fn);return timer;};w.clearTimeout=id=>pending.delete(id);w.document.querySelectorAll('nav button')[1].onclick=()=>{navigated=true;surface.innerHTML='<p>حجوزاتي</p>';};
 const touch=(type,x)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[{clientX:x,clientY:100}]});surface.querySelector('p').dispatchEvent(e);};
 try{runInContext(source,dom.getInternalVMContext());touch('touchstart',180);touch('touchmove',430);touch('touchend',430);assert.equal(navigated,false);assert.match(surface.style.transition,/180ms/);[...pending.values()][0]();assert.equal(navigated,true);assert.match(surface.textContent,/حجوزاتي/);[...pending.values()][0]();assert.equal(surface.style.transform,'');assert.equal(surface.style.willChange,'');console.log('PASS: outgoing and incoming screens animate through actual navigation and clean up even without transitionend');}finally{w.close();}
}

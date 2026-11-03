import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInContext} from 'node:vm';
const require=createRequire('/tmp/salonati-ui/package.json'),{JSDOM}=require('jsdom'),html=await readFile('release/customer/index.html','utf8');
const dom=new JSDOM(html,{url:'https://salonati-customer-clean.pages.dev',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,c=dom.getInternalVMContext();
w.document.documentElement.style.direction='rtl';w.matchMedia=()=>({matches:true});w.scrollTo=()=>{};w.setInterval=()=>0;w.requestAnimationFrame=fn=>fn();w.MutationObserver=class{observe(){}disconnect(){}};
w.fetch=async input=>{const path=String(input);return Response.json(path.includes('notifications')?{notifications:[],unread:0,offerSeq:0}:path.includes('approved-catalog')?{salons:[],services:[],team:[]}:path.includes('bookings')?{bookings:[]}:path.includes('cosmetics/public')?{stores:[]}:path.includes('popular-services')?{services:[]}:{campaigns:[],ads:[]});};
try{
 for(const script of w.document.querySelectorAll('script'))if(!script.src&&script.textContent.trim())runInContext(script.textContent,c);
 runInContext(await readFile('google-apps/customer/public/__salonati_ads.js','utf8'),c);
 runInContext(await readFile('deployment/customer-experience.js','utf8'),c);
 runInContext(await readFile('deployment/swipe-navigation.js','utf8'),c);
 await new Promise(resolve=>setImmediate(resolve));
 // jsdom outside-only does not compile inline attributes; invoke the real nav handler.
 w.document.addEventListener('click',event=>{const button=event.target.closest('nav button');if(button?.getAttribute('onclick'))runInContext(button.getAttribute('onclick'),c);});
 const swipe=(direction)=>{const target=w.document.querySelector('#app button')||w.document.querySelector('#app');for(const [type,x] of [['touchstart',180],['touchmove',180+direction*70],['touchend',180+direction*70]]){const event=new w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,'touches',{value:type==='touchend'?[]:[{clientX:x,clientY:250}]});target.dispatchEvent(event);}};
 for(let i=0;i<3;i++){swipe(1);assert.equal(runInContext('state.page',c),'bookings');swipe(-1);assert.equal(runInContext('state.page',c),'home');}
 console.log('PASS: full customer renderer plus history, notifications and swipe scripts navigate forwards and back repeatedly with short swipes starting on buttons');
}finally{w.close();}

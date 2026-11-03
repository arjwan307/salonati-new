import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInContext,runInNewContext} from 'node:vm';
const require=createRequire(process.env.SALONATI_JSDOM_PACKAGE||'/tmp/salonati-ui/package.json');
const {JSDOM}=require('jsdom');
const html=await readFile('release/customer/index.html','utf8');
const ads=await readFile('release/customer/__salonati_ads.js','utf8');
let catalog={salons:[],services:[],team:[]};
const dom=new JSDOM(html,{url:'https://salonati-customer-clean.pages.dev',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,context=dom.getInternalVMContext();
w.scrollTo=()=>{};w.matchMedia=()=>({matches:false});w.fetch=async input=>{const path=String(input);return Response.json(path.includes('approved-catalog')?catalog:path.includes('cosmetics/public')?{stores:[]}:path.includes('/config')?{ads:[]}:path.includes('bookings')?{bookings:[]}:{ads:[]});};
w.setInterval=()=>0;w.clearInterval=()=>{};w.MutationObserver=class{observe(){}disconnect(){}};
try{
 for(const script of w.document.querySelectorAll('script')){
  if(script.src){if(script.src.endsWith('/__salonati_ads.js'))runInContext(ads,context);}
  else if(script.textContent.trim())runInContext(script.textContent,context);
 }
 await new Promise(resolve=>setImmediate(resolve));
 const evaluate=code=>runInContext(code,context);
 for(const category of ['hair','makeup','skin','nails']){w.salonatiOpenCategory(category);assert.match(w.document.getElementById('app').textContent,/لا توجد خدمات معتمدة/);assert.equal(w.document.querySelectorAll('.category-service-card').length,0);assert.equal(w.document.querySelectorAll('nav.nav').length,1);}
 assert.equal(evaluate('services.length'),0);w.go('home');assert.equal(w.document.getElementById('popularServices'),null);
 catalog={salons:[{ownerId:'owner-1',name:'Approved salon',area:'Test'}],services:[{id:'service-1',ownerId:'owner-1',name:'مكياج معتمد',category:'makeup',price:73500,minutes:55,discountPrice:null},{id:'orphan',ownerId:'missing',name:'Hidden service',category:'makeup',price:1,minutes:1}],team:[]};
 await evaluate('loadApprovedCatalog()');w.salonatiOpenCategory('makeup');assert.equal(w.document.querySelectorAll('.category-service-card').length,1);assert.match(w.document.getElementById('app').textContent,/73,500/);assert.doesNotMatch(w.document.getElementById('app').textContent,/Hidden service|مكياج عروس/);
 w.salonatiCategoryService(1);assert.match(w.document.getElementById('app').textContent,/Approved salon/);assert.equal(w.document.querySelectorAll('nav.nav').length,1);
 catalog={salons:[],services:[],team:[]};await evaluate('loadApprovedCatalog()');assert.match(w.document.getElementById('app').textContent,/لا توجد خدمات معتمدة/);w.salonatiCategorySalon(1);assert.equal(evaluate('state.selectedServices.length'),0);
 catalog={salons:[{ownerId:'owner-1',name:'Approved salon'}],services:[{id:'service-1',ownerId:'owner-1',name:'مكياج معتمد',category:'makeup',price:73500,minutes:55,discountPrice:null}],team:[]};await evaluate('loadApprovedCatalog()');evaluate("state.salon=1;state.page='booking';state.selectedServices=[1]");catalog={salons:[],services:[],team:[]};await evaluate('loadApprovedCatalog()');assert.equal(evaluate('state.page'), 'home');assert.equal(evaluate('services.length'),0);assert.equal(evaluate('state.selectedServices.length'),0);
 console.log('PASS: empty catalog has no invented services/prices/popular cards; only approved owner services appear; one nav; withdrawn selection is cleared');
}finally{w.close();}
// A restored app must discard personal UI and return to login after server revocation.
const guard=await readFile('deployment/customer-session.js','utf8');
const events={},elements={app:{replaceChildren(){this.cleared=true;}},'salonati-fixed-nav':{remove(){this.removed=true;}}},removed=[];let redirect,checks=0;
const sandbox={window:{SALONATI_ACCOUNT_ID:'customer-1',fetch:async()=>{checks++;return Response.json({error:'login_required'},{status:401});},addEventListener:(name,fn)=>events[name]=fn},document:{documentElement:{style:{}},addEventListener:(name,fn)=>events[name]=fn,getElementById:id=>elements[id]},localStorage:{removeItem:k=>removed.push(k)},location:{href:'https://salonati-customer-clean.pages.dev',origin:'https://salonati-customer-clean.pages.dev',replace:path=>redirect=path},setInterval:()=>0,URL};
runInNewContext(guard,sandbox);await events.pageshow();await new Promise(resolve=>setImmediate(resolve));assert.equal(redirect,'/');assert.equal(elements.app.cleared,true);assert.equal(elements['salonati-fixed-nav'].removed,true);assert.ok(removed.includes('salonati:customer-1:salonati_bookings'));assert.equal(checks,1);
console.log('PASS: restored/revoked customer session hides and clears private UI and scoped personal cache, then returns to login');
const source=await readFile('deployment/live-worker.mjs','utf8'),cosmetics=await readFile('deployment/cosmetics-api.mjs','utf8');const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source.replaceAll('__APP_ROLE__','customer')+'\n'+cosmetics).toString('base64'));
let privateAssetReads=0;const env={IDENTITY_DB:{prepare:()=>({bind(){return this;},first:async()=>null})},SALONATI_API:{fetch:async()=>Response.json({error:'login_required'},{status:401})},ASSETS:{fetch:async()=>{privateAssetReads++;return new Response('<main>PRIVATE SHELL</main>',{headers:{'Content-Type':'text/html'}});}}};
for(const path of ['/','/index.html','/apps/customer/index.html','/old-entry']){const r=await worker.fetch(new Request('https://salonati-customer-clean.pages.dev'+path,{headers:{cookie:'__Host-salonati-customer='+'1'.repeat(64)}}),env);const body=await r.text();assert.match(body,/id="auth"/);assert.doesNotMatch(body,/PRIVATE SHELL/);assert.match(r.headers.get('cache-control'),/no-store/);}
assert.equal(privateAssetReads,2);
console.log('PASS: deleted customer cookie cannot open root, index, legacy HTML or fallback SPA asset shell');

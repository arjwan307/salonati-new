import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInContext} from 'node:vm';
const require=createRequire(process.env.SALONATI_JSDOM_PACKAGE||'/tmp/salonati-ui/package.json');const {JSDOM}=require('jsdom');
const source=await readFile('deployment/app-resume.js','utf8');
const dom=new JSDOM('<main id="app"><input value="unsaved"></main><nav id="salonati-fixed-nav"></nav>',{url:'https://salonati-customer-clean.pages.dev',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,context=dom.getInternalVMContext(),timers=new Map();let next=0,calls=[],resumes=0;
w.setTimeout=(fn,delay)=>{timers.set(++next,{fn,delay});return next;};w.clearTimeout=id=>timers.delete(id);w.setInterval=()=>0;
w.fetch=(input,options)=>{calls.push({input,options});if(String(input)==='/api/session/activity')return Promise.resolve(Response.json({ok:true}));return new Promise((resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(Error('aborted'))));};
const flush=delay=>{for(const [id,timer] of [...timers])if(timer.delay===delay){timers.delete(id);timer.fn();}};
try{
 runInContext(source,context);w.addEventListener('salonati:resume',()=>resumes++);
 for(const event of ['focus','online','pageshow'])w.dispatchEvent(new w.Event(event));flush(200);await new Promise(resolve=>setImmediate(resolve));assert.equal(resumes,1);
 w.document.querySelector('input').focus();w.dispatchEvent(new w.Event('online'));flush(200);assert.equal(resumes,1);w.document.querySelector('input').blur();flush(200);assert.equal(resumes,2);assert.equal(w.document.querySelector('input').value,'unsaved');
 const stalled=w.fetch('/api/customer/approved-catalog');const rejection=assert.rejects(stalled,/aborted/);assert.equal(calls.at(-1).options.cache,'no-store');flush(15000);await rejection;
 void w.fetch('/api/orders',{method:'POST'});assert.equal([...timers.values()].filter(t=>t.delay===15000).length,0);
 console.log('PASS: resume events coalesce, wait for editing, preserve drafts, and abort stalled reads without retrying writes');
 let offline=true;w.SALONATI_ACCOUNT_ID='customer-1';w.fetch=async()=>{if(offline)throw Error('offline');return Response.json({account:{id:'customer-1',name:'Customer',phone:''}});};
 runInContext(await readFile('deployment/customer-session.js','utf8'),context);
 w.dispatchEvent(new w.Event('pageshow'));await new Promise(resolve=>setImmediate(resolve));assert.ok(w.document.getElementById('salonati-connection-notice'));assert.equal(w.document.querySelector('input').value,'unsaved');assert.equal(w.document.documentElement.style.visibility,'hidden');
 offline=false;w.dispatchEvent(new w.Event('online'));await new Promise(resolve=>setImmediate(resolve));assert.equal(w.document.getElementById('salonati-connection-notice'),null);assert.equal(w.document.documentElement.style.visibility,'');assert.ok(w.document.getElementById('salonati-fixed-nav'));assert.equal(w.document.querySelector('input').value,'unsaved');
 console.log('PASS: a transient session check failure conceals private data without destroying the app, then automatically recovers online');
}finally{w.close();}

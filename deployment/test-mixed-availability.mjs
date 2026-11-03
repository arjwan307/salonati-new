import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInContext} from 'node:vm';
const require=createRequire(process.env.SALONATI_JSDOM_PACKAGE||'/tmp/salonati-ui/package.json'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<main></main>',{url:'https://salonati-customer-clean.pages.dev',runScripts:'outside-only'}),w=dom.window,c=dom.getInternalVMContext();
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.setInterval=()=>0;w.setTimeout=()=>0;w.clearTimeout=()=>{};
let blocks=[{date:'2026-11-17',time:'14:30',serviceId:'makeup'}];w.fetch=async()=>Response.json({blocks});w.render=()=>{};w.go=page=>runInContext(`state.page=${JSON.stringify(page)}`,c);
const html=await readFile('google-apps/customer/apps/customer/index.html','utf8');
try{
 runInContext("const salons=[{id:1,ownerId:'owner'}],services=[{id:1,serverId:'makeup',name:'مكياج',price:50},{id:2,serverId:'hair',name:'قص الشعر',price:20}];const state={salon:1,page:'booking',selectedServices:[1,2],hijabServiceIds:[1,2],staffChoices:{1:'a',2:'b'},date:'2026-11-17',time:''};",c);
 runInContext(html.slice(html.indexOf('const salonatiClosedSlots='),html.indexOf('let bookingCustomerProfile=')),c);
 await runInContext('fetchClosedSlots()',c);runInContext("announceClosedBooking(state.date,'2:30 م')",c);
 const dialog=w.document.getElementById('salonatiUnavailableDialog');assert.match(dialog.textContent,/مكياج/);assert.match(dialog.textContent,/قص الشعر/);assert.equal(runInContext('state.selectedServices.length',c),2,'the app must not silently drop a service');
 dialog.querySelector('button').click();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(Array.from(runInContext('state.selectedServices',c)),[2]);assert.equal(runInContext('state.time',c),'2:30 م');assert.equal(runInContext('state.page',c),'summary');assert.equal(runInContext('state.staffChoices[1]',c),undefined);assert.equal(runInContext('state.staffChoices[2]',c),'b');
 blocks=[{date:'2026-11-17',time:'*',serviceId:'*'}];runInContext("state.page='booking';state.time='';state.selectedServices=[1,2]",c);await runInContext('fetchClosedSlots()',c);runInContext("announceClosedBooking(state.date,'2:30 م')",c);assert.doesNotMatch(w.document.getElementById('salonatiUnavailableDialog').textContent,/متابعة بالخدمات المتاحة فقط/);
 console.log('PASS: mixed availability names both services, preserves the full selection until explicit consent, then keeps only available services and recalculates the selection; full closure offers no partial booking');
}finally{w.close();}

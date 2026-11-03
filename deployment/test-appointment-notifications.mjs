import assert from 'node:assert/strict';
import {createECDH,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fixture,owner,customer} from './audit-db-test-helper.mjs';
import {collectReminders,deliverReminders,encryptPush} from './customer-notifier.mjs';
const require=createRequire('/tmp/salonati-push-test/package.json'),ece=require('http_ece');
const privateKey=createECDH('prime256v1');privateKey.generateKeys();const auth=randomBytes(16),keys={p256dh:privateKey.getPublicKey().toString('base64url'),auth:auth.toString('base64url')};
const payload={kind:'reminder3',body:'اختبار التذكير',unread:2},encrypted=await encryptPush(keys,payload);
assert.deepEqual(JSON.parse(ece.decrypt(Buffer.from(encrypted),{version:'aes128gcm',privateKey,authSecret:auth}).toString()),payload);
console.log('PASS: encrypted Web Push payload decrypts with the independent http_ece implementation');
const {sqlite,db}=fixture(),salon='11111111-1111-1111-1111-111111111111',a='22222222-2222-2222-2222-222222222222',b='33333333-3333-3333-3333-333333333333';owner(sqlite,salon);customer(sqlite,a);customer(sqlite,b);
sqlite.prepare("INSERT INTO catalog_media(id,owner_id,object_key,mime,size) VALUES('facade',?,'facade','image/png',10)").run(salon);
sqlite.prepare("INSERT INTO catalog_registrations(owner_id,contact_name,phone,address,facade_media_id,status,submitted_at) VALUES(?,'test','07700000000','test','facade','approved','test')").run(salon);
const put=(id,minutes,status='confirmed',who=a)=>sqlite.prepare("INSERT INTO catalog_live_bookings(id,owner_id,customer_id,customer_name,phone,services,starts_at,ends_at,total,status,request_key,request_hash,created_at) VALUES(?,?,?,'test','07700000000','[]',?,?,100,?,?,?,?)").run(id,salon,who,new Date(Date.now()+minutes*60000).toISOString(),new Date(Date.now()+(minutes+30)*60000).toISOString(),status,id,id,new Date().toISOString());
put('day',1439);put('three',179);put('pending',179,'pending');put('cancelled',1439,'cancelled');put('future',1800);put('other',179,'confirmed',b);put('past-window',120);
await collectReminders(db);await collectReminders(db);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM salonati_customer_notifications').get().n,3);assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM salonati_customer_notifications WHERE customer_id=?").get(a).n,2);
sqlite.prepare("INSERT INTO catalog_customer_sessions VALUES('expired',?,datetime('now','-1 hour'))").run(a);
sqlite.prepare("INSERT INTO salonati_push_subscriptions(id,customer_id,token_hash,endpoint,p256dh,auth) VALUES('device',?,'expired','https://fcm.googleapis.com/test',?,?)").run(a,keys.p256dh,keys.auth);
const signing=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),env={DB:db,VAPID_PRIVATE_KEY:JSON.stringify(await crypto.subtle.exportKey('jwk',signing.privateKey)),VAPID_PUBLIC_KEY:'test'};
const original=globalThis.fetch,sends=[];
try{
 globalThis.fetch=async(url,options)=>{sends.push(JSON.parse(ece.decrypt(Buffer.from(options.body),{version:'aes128gcm',privateKey,authSecret:auth}).toString()));return new Response(null,{status:201});};
 assert.equal((await deliverReminders(env)).sent,2);assert.deepEqual(sends.map(n=>n.kind).sort(),['reminder24','reminder3']);assert.ok(sends.every(n=>n.unread===2&&n.url==='/?bookings=1'));assert.equal((await deliverReminders(env)).sent,0);
 // A changed start time creates a new reminder, not a repeat of the old slot.
 sqlite.prepare("UPDATE catalog_live_bookings SET starts_at=? WHERE id='three'").run(new Date(Date.now()+178*60000).toISOString());await collectReminders(db);assert.equal((await deliverReminders(env)).sent,1);
 sqlite.prepare("UPDATE catalog_live_bookings SET starts_at=?,status='cancelled' WHERE id='day'").run(new Date(Date.now()+1438*60000).toISOString());assert.equal((await deliverReminders(env)).sent,0);
 sqlite.exec("DELETE FROM catalog_customer_sessions");sqlite.prepare("UPDATE catalog_live_bookings SET starts_at=? WHERE id='three'").run(new Date(Date.now()+177*60000).toISOString());assert.equal((await deliverReminders(env)).sent,0);
 assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM catalog_rate WHERE key LIKE 'push-reminder:%'").get().n,0);
 console.log('PASS: 24h/3h reminders, independent expired-login consent, per-device deduplication, rescheduling, cancellation and explicit session revocation');
}finally{globalThis.fetch=original;}
// Authenticated inbox and read receipts never expose or mark another customer's reminders.
const token='c'.repeat(64),hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');sqlite.prepare("INSERT INTO catalog_customer_sessions VALUES(?,?,datetime('now','+1 hour'))").run(hash,a);
const source=await readFile('deployment/live-worker.mjs','utf8'),extra=await readFile('deployment/cosmetics-api.mjs','utf8'),worker=(await import('data:text/javascript;base64,'+Buffer.from(source.replaceAll('__APP_ROLE__','customer')+'\n'+extra).toString('base64'))).default;
const origin='https://salonati-customer-clean.pages.dev',request=(path,body)=>new Request(origin+'/api/customer/'+path,{method:body===undefined?'GET':'POST',headers:{cookie:'__Host-salonati-customer='+token,Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
let response=await worker.fetch(request('notifications'),{IDENTITY_DB:db}),inbox=await response.json();assert.equal(response.status,200);assert.ok(inbox.notifications.every(n=>n.id!==sqlite.prepare('SELECT id FROM salonati_customer_notifications WHERE customer_id=?').get(b).id));
const otherId=sqlite.prepare('SELECT id FROM salonati_customer_notifications WHERE customer_id=?').get(b).id;
response=await worker.fetch(request('notifications/read',{offerSeq:0,ids:[otherId,...inbox.notifications.map(n=>n.id)]}),{IDENTITY_DB:db});assert.equal(response.status,200);assert.equal(sqlite.prepare('SELECT read_at FROM salonati_customer_notifications WHERE id=?').get(otherId).read_at,null);
response=await worker.fetch(request('push',{endpoint:'https://fcm.googleapis.com/new',keys}),{IDENTITY_DB:db});assert.equal(response.status,200);assert.equal(sqlite.prepare("SELECT p256dh FROM salonati_push_subscriptions WHERE endpoint='https://fcm.googleapis.com/new'").get().p256dh,keys.p256dh);
response=await worker.fetch(request('push',{endpoint:'https://fcm.googleapis.com/new',keys:{p256dh:'invalid',auth:'invalid'}}),{IDENTITY_DB:db});assert.equal(response.status,400);
console.log('PASS: customer-scoped inbox/read receipts and validated encrypted subscription registration');

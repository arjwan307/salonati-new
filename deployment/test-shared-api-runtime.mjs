// Fully local Workers/D1/R2 test. No Cloudflare credentials or remote bindings.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {Miniflare}=await import(process.env.SALONATI_MINIFLARE_MODULE?pathToFileURL(process.env.SALONATI_MINIFLARE_MODULE).href:'miniflare');
const mf=new Miniflare({modules:true,scriptPath:new URL('../workers/salonati-api/worker.mjs',import.meta.url).pathname,compatibilityDate:'2026-07-30',d1Databases:['MODERATION_DB'],r2Buckets:['MEDIA']});
const salon='11111111-1111-1111-1111-111111111111',admin='22222222-2222-2222-2222-222222222222',customer='33333333-3333-3333-3333-333333333333',service='44444444-4444-4444-4444-444444444444',revision='55555555-5555-5555-5555-555555555555',ad='66666666-6666-6666-6666-666666666666',approved='77777777-7777-7777-7777-777777777777',pending='88888888-8888-8888-8888-888888888888',media='99999999-9999-9999-9999-999999999999',privateMedia='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const hex=a=>Buffer.from(a).toString('hex'),hash=async v=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
const ownerToken='1'.repeat(64),customerToken='2'.repeat(64),adminToken='3'.repeat(64),origin='https://salonati-api.test';
const fetch=(path,{token,customerCookie=false,method='GET',body}={})=>mf.dispatchFetch(origin+path,{method,headers:{Origin:origin,...(token?{cookie:(customerCookie?'__Host-salonati-customer':'__Host-catalog')+'='+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
try{
 const db=await mf.getD1Database('MODERATION_DB'),r2=await mf.getR2Bucket('MEDIA');
 const schema=await readFile(new URL('../docs/audit-20261103/schema.sql',import.meta.url),'utf8');
 for(const statement of schema.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
 await db.batch([
  db.prepare("INSERT INTO catalog_accounts(id,email,role,salt,digest) VALUES(?,'owner@test.invalid','owner','salt','digest')").bind(salon),
  db.prepare("INSERT INTO catalog_accounts(id,email,role,salt,digest) VALUES(?,'admin@test.invalid','admin','salt','digest')").bind(admin),
  db.prepare("INSERT INTO salonati_phone_identities(app,phone,account_id) VALUES('salon','07700000000',?)").bind(salon),
  db.prepare("INSERT INTO catalog_customer_accounts VALUES(?,'synthetic','Synthetic','07700000000','salt','digest','test')").bind(customer),
  db.prepare("INSERT INTO catalog_sessions VALUES(?,?,datetime('now','+1 day'))").bind(await hash(ownerToken),salon),
  db.prepare("INSERT INTO catalog_sessions VALUES(?,?,datetime('now','+1 day'))").bind(await hash(adminToken),admin),
  db.prepare("INSERT INTO catalog_customer_sessions VALUES(?,?,datetime('now','+1 day'))").bind(await hash(customerToken),customer),
  db.prepare("INSERT INTO catalog_media(id,owner_id,object_key,mime,size) VALUES(?,?,'approved','image/png',3)").bind(media,salon),
  db.prepare("INSERT INTO catalog_media(id,owner_id,object_key,mime,size) VALUES(?,?,'private','image/png',3)").bind(privateMedia,salon),
  db.prepare("INSERT INTO catalog_registrations(owner_id,contact_name,phone,address,facade_media_id,status,submitted_at) VALUES(?,'Synthetic','07700000000','Synthetic',?,'approved','test')").bind(salon,media),
  db.prepare('INSERT INTO catalog_services(id,owner_id,latest_revision,published_revision) VALUES(?,?,?,?)').bind(service,salon,revision,revision),
  db.prepare("INSERT INTO catalog_revisions(id,service_id,owner_id,name,category,price,minutes,status) VALUES(?,?,?,'Synthetic','hair',100,30,'approved')").bind(revision,service,salon),
  db.prepare('INSERT INTO catalog_advertisements(id,owner_id,latest_revision,published_revision) VALUES(?,?,?,?)').bind(ad,salon,pending,approved),
  db.prepare("INSERT INTO catalog_ad_revisions(id,ad_id,owner_id,title,placement,media_id,status) VALUES(?,?,?,'Approved','salon',?,'approved')").bind(approved,ad,salon,media),
  db.prepare("INSERT INTO catalog_ad_revisions(id,ad_id,owner_id,title,placement,media_id,status) VALUES(?,?,?,'Pending','salon',?,'pending')").bind(pending,ad,salon,privateMedia)
 ]);
 await r2.put('approved',new Uint8Array([1,2,3]));await r2.put('private',new Uint8Array([4,5,6]));
 const catalog=await (await fetch('/api/catalog/public')).json();assert.deepEqual(catalog.salons[0].gallery.map(r=>r.revisionId),[approved]);
 assert.equal((await fetch('/api/catalog/media/'+privateMedia)).status,404);
 const preview=await fetch('/api/catalog/media/'+privateMedia,{token:ownerToken});assert.equal(preview.status,200);assert.deepEqual([...new Uint8Array(await preview.arrayBuffer())],[4,5,6]);
 assert.equal((await fetch('/api/catalog/media/'+media)).status,200);
 console.log('PASS workerd/D1/R2: publication selection, private media boundary and authorized object reads');
 const instant=new Date(Date.now()+86400000),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant),time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baghdad',hour:'2-digit',minute:'2-digit',hour12:false}).format(instant);
 const booking={ownerId:salon,serviceIds:[service],startsAt:instant.toISOString(),name:'Synthetic customer',phone:'07700000000',paymentMethod:'cash',expectedTotal:100,requestKey:crypto.randomUUID()};
 await db.prepare("INSERT INTO catalog_booking_blocks VALUES(?,?,?,'*')").bind(salon,day,time).run();
 assert.equal((await fetch('/api/catalog/workflow/customer/bookings',{token:customerToken,customerCookie:true,method:'POST',body:booking})).status,409);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM catalog_live_bookings').first()).n,0);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM catalog_workflow_notifications').first()).n,0);
 await db.prepare('DELETE FROM catalog_booking_blocks').run();
 let r=await fetch('/api/catalog/workflow/customer/bookings',{token:customerToken,customerCookie:true,method:'POST',body:booking});assert.equal(r.status,201,await r.clone().text());const created=await r.json();
 r=await fetch('/api/catalog/workflow/customer/bookings',{token:customerToken,customerCookie:true,method:'POST',body:booking});assert.equal(r.status,200);assert.equal((await r.json()).id,created.id);
 const list=await (await fetch('/api/catalog/workflow/owner/bookings',{token:ownerToken})).json();assert.equal(list.bookings[0].phone,'');
 await db.prepare("INSERT INTO salonati_admin_account_controls(app,owner_id,status) VALUES('salon',?,'deleted')").bind(salon).run();
 assert.equal((await fetch('/api/catalog/me',{token:ownerToken})).status,401);
 const hidden=await (await fetch('/api/catalog/public')).json();assert.equal(hidden.salons.length,0);
 console.log('PASS workerd/D1: blocked slot, atomic booking/notification, idempotent retry, pending contact privacy, deleted account rejection');
 await db.prepare("INSERT INTO salonati_push_subscriptions(id,customer_id,token_hash,endpoint) VALUES('device',?,?,'https://fcm.googleapis.com/test')").bind(customer,await hash(customerToken)).run();
 assert.equal((await fetch('/api/link/customer/logout',{token:customerToken,customerCookie:true,method:'POST',body:{}})).status,200);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM catalog_customer_sessions').first()).n,0);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM salonati_push_subscriptions').first()).n,0);
 assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
 for(const path of ['/','/customer/','/admin/moderation','/salonati-link.js'])assert.equal((await fetch(path)).status,200,path);
 console.log('PASS workerd/D1: transactional logout, no FK violations; existing HTML and script endpoints load');
}finally{await mf.dispose();}

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {fixture,owner,customer} from './audit-db-test-helper.mjs';
const target=process.argv[2]||new URL('../workers/salonati-api/worker.mjs',import.meta.url).pathname;
const api=(await import(pathToFileURL(target))).default;
const id={salon:'11111111-1111-1111-1111-111111111111',cosmetics:'22222222-2222-2222-2222-222222222222',admin:'33333333-3333-3333-3333-333333333333',staff:'44444444-4444-4444-4444-444444444444',customer:'55555555-5555-5555-5555-555555555555',other:'66666666-6666-6666-6666-666666666666',service:'77777777-7777-7777-7777-777777777777',revision:'88888888-8888-8888-8888-888888888888',facade:'99999999-9999-9999-9999-999999999999',ad:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',approved:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',pending:'cccccccc-cccc-cccc-cccc-cccccccccccc',mediaApproved:'dddddddd-dddd-dddd-dddd-dddddddddddd',mediaPending:'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'};
const password='synthetic-password-only';
const hex=a=>Buffer.from(a).toString('hex');const hash=async x=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)));
const salt='synthetic-salt';const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
const digest=hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256));
const tokens=Object.fromEntries(['salon','cosmetics','admin','staff','customer','other'].map((r,i)=>[r,String(i+1).repeat(64)]));
const tokenHashes=Object.fromEntries(await Promise.all(Object.entries(tokens).map(async([r,t])=>[r,await hash(t)])));
async function setup(){
 const {sqlite,db}=fixture();
 for(const role of ['salon','cosmetics','admin','staff','other'])owner(sqlite,id[role],role==='staff'?'admin':role==='other'?'salon':role,role==='admin'?'admin':'owner');
 customer(sqlite,id.customer);
 sqlite.prepare('UPDATE catalog_accounts SET salt=?,digest=?').run(salt,digest);
 sqlite.prepare('UPDATE catalog_customer_accounts SET salt=?,digest=?').run(salt,digest);
 for(const role of ['salon','cosmetics','admin','staff','other'])sqlite.prepare("INSERT INTO catalog_sessions VALUES(?,?,datetime('now','+1 day'))").run(tokenHashes[role],id[role]);
 sqlite.prepare("INSERT INTO catalog_customer_sessions VALUES(?,?,datetime('now','+1 day'))").run(tokenHashes.customer,id.customer);
 sqlite.prepare("INSERT INTO catalog_admin_staff VALUES(?,'Test staff','[\"finance_view\"]',1,?,'test','test')").run(id.staff,id.admin);
 for(const [media,object] of [[id.facade,'facade-key'],[id.mediaApproved,'approved-key'],[id.mediaPending,'pending-key']])sqlite.prepare("INSERT INTO catalog_media(id,owner_id,object_key,mime,size) VALUES(?,?,?,'image/png',3)").run(media,id.salon,object);
 sqlite.prepare("INSERT INTO catalog_registrations(owner_id,contact_name,phone,address,facade_media_id,status,submitted_at) VALUES(?,'Synthetic owner','07700000000','Synthetic address',?,'approved','test')").run(id.salon,id.facade);
 sqlite.prepare('INSERT INTO catalog_services(id,owner_id,latest_revision,published_revision) VALUES(?,?,?,?)').run(id.service,id.salon,id.revision,id.revision);
 sqlite.prepare("INSERT INTO catalog_revisions(id,service_id,owner_id,name,category,price,minutes,status) VALUES(?,?,?,'Synthetic service','hair',100,30,'approved')").run(id.revision,id.service,id.salon);
 sqlite.prepare('INSERT INTO catalog_advertisements(id,owner_id,latest_revision,published_revision) VALUES(?,?,?,?)').run(id.ad,id.salon,id.pending,id.approved);
 for(const [revision,media,status] of [[id.approved,id.mediaApproved,'approved'],[id.pending,id.mediaPending,'pending']])sqlite.prepare("INSERT INTO catalog_ad_revisions(id,ad_id,owner_id,title,placement,media_id,status) VALUES(?,?,?,'Synthetic ad','salon',?,?)").run(revision,id.ad,id.salon,media,status);
 sqlite.exec("CREATE TRIGGER catalog_live_no_overlap BEFORE INSERT ON catalog_live_bookings WHEN NEW.status IN('pending','confirmed') AND EXISTS(SELECT 1 FROM catalog_live_bookings b WHERE b.owner_id=NEW.owner_id AND b.status IN('pending','confirmed') AND b.starts_at<NEW.ends_at AND b.ends_at>NEW.starts_at) BEGIN SELECT RAISE(ABORT,'slot_unavailable'); END");
 let reads=0;const env={MODERATION_DB:db,MEDIA:{async get(){reads++;return {body:new Uint8Array([1,2,3])};}},get mediaReads(){return reads;}};
 return {sqlite,db,env};
}
function req(path,{role,method='GET',body,origin='https://salonati-api.test',headers={}}={}){
 const h={Origin:origin,...headers};if(role)h.cookie=(role==='customer'?'__Host-salonati-customer':'__Host-catalog')+'='+tokens[role];
 if(body)h['Content-Type']='application/json';return new Request('https://salonati-api.test'+path,{method,headers:h,...(body?{body:JSON.stringify(body)}:{})});
}
const send=(e,path,options)=>api.fetch(req(path,options),e.env);
const count=(e,t)=>e.sqlite.prepare('SELECT COUNT(*) n FROM '+t).get().n;
const control=(e,state)=>e.sqlite.prepare("INSERT OR REPLACE INTO salonati_admin_account_controls(app,owner_id,status) VALUES('salon',?,?)").run(id.salon,state);
const booking=()=>({ownerId:id.salon,serviceIds:[id.service],startsAt:new Date(Date.now()+86400000).toISOString(),name:'Synthetic customer',phone:'07700000000',notes:'Synthetic private notes',paymentMethod:'cash',expectedTotal:100,requestKey:crypto.randomUUID()});
{
 const e=await setup();let r=await send(e,'/api/catalog/public');assert.equal(r.status,200);let d=await r.json();assert.equal(d.salons.length,1);assert.deepEqual(d.salons[0].gallery.map(x=>x.revisionId),[id.approved]);
 r=await send(e,'/api/catalog/media/'+id.mediaPending);assert.equal(r.status,404);assert.equal(e.env.mediaReads,0);
 r=await send(e,'/api/catalog/media/'+id.mediaPending,{role:'other'});assert.equal(r.status,404);
 r=await send(e,'/api/catalog/media/'+id.mediaPending,{role:'staff'});assert.equal(r.status,404);
 assert.equal((await send(e,'/api/catalog/media/'+id.mediaPending,{role:'salon'})).status,200);
 assert.equal((await send(e,'/api/catalog/media/'+id.mediaPending,{role:'admin'})).status,200);
 assert.equal((await send(e,'/api/catalog/media/'+id.mediaApproved)).status,200);
 control(e,'deleted');d=await (await send(e,'/api/catalog/public')).json();assert.equal(d.salons.length,0);assert.equal(d.products.length,0);assert.equal(d.advertisements.length,0);
 assert.equal((await send(e,'/api/catalog/media/'+id.mediaApproved)).status,404);
 console.log('PASS: direct shared API publishes only approved revision/media, retains prior approval, enforces media ownership and staff permissions, hides deleted salon');
}
{
 const e=await setup();for(const state of ['suspended','deleted']){
  control(e,state);assert.equal((await send(e,'/api/catalog/me',{role:'salon'})).status,401);
  assert.equal((await send(e,'/api/link/team',{role:'salon',method:'POST',body:{name:'test'}})).status,401);
  const before=count(e,'catalog_sessions');const r=await send(e,'/api/catalog/login',{method:'POST',body:{email:id.salon+'@test.invalid',password}});assert.equal(r.status,401);assert.equal(r.headers.get('set-cookie'),null);assert.equal(count(e,'catalog_sessions'),before);
 }
 assert.equal(count(e,'catalog_team'),0);
 assert.equal((await send(e,'/api/catalog/services',{role:'cosmetics'})).status,403);
 assert.equal((await send(e,'/api/link/team',{role:'cosmetics'})).status,403);
 assert.equal((await send(e,'/api/catalog/me',{role:'cosmetics'})).status,200);
 assert.equal((await send(e,'/api/catalog/finance/statement',{role:'cosmetics'})).status,200);
 assert.equal((await send(e,'/api/catalog/reviews',{role:'staff'})).status,403);
 assert.equal((await send(e,'/api/catalog/admin/staff',{role:'salon'})).status,401);
 assert.equal((await send(e,'/api/catalog/admin/staff',{headers:{'x-salonati-app':'admin'}})).status,401);
 assert.equal((await send(e,'/api/link/team',{role:'other',method:'POST',body:{name:'test'},origin:'https://foreign.test'})).status,403);
 assert.equal((await send(e,'/api/catalog/login',{method:'POST',body:{email:id.other+'@test.invalid',password}})).status,200);
 console.log('PASS: suspended/deleted sessions and fresh login rejected; cosmetics cannot use salon endpoints; valid finance/me and login retained; staff/CSRF/forged-header checks');
}
{
 const e=await setup();const d=booking();let r=await send(e,'/api/catalog/workflow/customer/bookings',{role:'customer',method:'POST',body:d});assert.equal(r.status,201,await r.clone().text());const created=await r.json();
 r=await send(e,'/api/catalog/workflow/customer/bookings',{role:'customer',method:'POST',body:d});assert.equal(r.status,200);assert.equal((await r.json()).id,created.id);assert.equal(count(e,'catalog_live_bookings'),1);assert.equal(count(e,'catalog_workflow_notifications'),1);
 const ownerView=await (await send(e,'/api/catalog/workflow/owner/bookings',{role:'salon'})).json();assert.equal(ownerView.bookings[0].phone,'');assert.notEqual(ownerView.bookings[0].name,d.name);
 e.sqlite.prepare("UPDATE catalog_live_bookings SET status='confirmed'").run();const accepted=await (await send(e,'/api/catalog/workflow/owner/bookings',{role:'salon'})).json();assert.equal(accepted.bookings[0].phone,d.phone);
 r=await send(e,'/api/catalog/workflow/customer/bookings',{role:'customer',method:'POST',body:{...d,requestKey:crypto.randomUUID()}});assert.equal(r.status,409);assert.equal(count(e,'catalog_live_bookings'),1);
 console.log('PASS: valid booking, idempotent retry, overlap rejection and pending contact privacy at source');
}
for(const race of ['disabled','closed','unpublished','customer_deleted']){
 const e=await setup(),d=booking(),original=e.db.batch.bind(e.db);let fired=false;
 e.db.batch=async statements=>{if(!fired&&statements[0]?.sql.includes('INSERT INTO catalog_live_bookings')){fired=true;
  if(race==='disabled')control(e,'suspended');
  if(race==='unpublished')e.sqlite.prepare('UPDATE catalog_services SET published_revision=NULL').run();
  if(race==='customer_deleted'){e.sqlite.prepare('DELETE FROM catalog_customer_sessions').run();e.sqlite.prepare("DELETE FROM salonati_phone_identities WHERE app='customer'").run();e.sqlite.prepare('DELETE FROM catalog_customer_accounts').run();}
  if(race==='closed'){const instant=new Date(d.startsAt),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant),time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baghdad',hour:'2-digit',minute:'2-digit',hour12:false}).format(instant);e.sqlite.prepare("INSERT INTO catalog_booking_blocks VALUES(?,?,?,'*')").run(id.salon,day,time);}
 }return original(statements);};
 const r=await send(e,'/api/catalog/workflow/customer/bookings',{role:'customer',method:'POST',body:d});assert.equal(r.status,409,race+': '+await r.clone().text());assert.equal(fired,true);for(const table of ['catalog_live_bookings','catalog_workflow_notifications','catalog_loyalty_rewards'])assert.equal(count(e,table),0,race+': '+table);assert.deepEqual(e.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
}
console.log('PASS: atomic insert rejects disable, closure, unpublish and customer-deletion races with no orphan booking/notification/reward');
{
 const e=await setup();e.sqlite.prepare("INSERT INTO salonati_push_subscriptions(id,customer_id,token_hash,endpoint) VALUES('device',?,?,'https://fcm.googleapis.com/test')").run(id.customer,tokenHashes.customer);
 assert.equal((await send(e,'/api/link/customer/logout',{role:'customer',method:'POST',body:{}})).status,200);assert.equal(count(e,'catalog_customer_sessions'),0);assert.equal(count(e,'salonati_push_subscriptions'),0);
 assert.equal((await send(e,'/api/link/customer/me',{role:'customer'})).status,401);
 console.log('PASS: direct customer logout atomically revokes session and its push subscription');
}
for(const change of ['password_changed','staff_disabled']){
 const e=await setup(),role=change==='password_changed'?'other':'staff',prepare=e.db.prepare.bind(e.db),before=count(e,'catalog_sessions');let fired=false;
 e.db.prepare=sql=>{const q=prepare(sql);if(sql.startsWith('INSERT INTO catalog_sessions')){const run=q.run.bind(q);q.run=async()=>{fired=true;if(change==='password_changed')e.sqlite.prepare('UPDATE catalog_accounts SET digest=? WHERE id=?').run('rotated-digest',id[role]);else e.sqlite.prepare('UPDATE catalog_admin_staff SET active=0 WHERE account_id=?').run(id.staff);return run();};}return q;};
 const r=await send(e,'/api/catalog/login',{method:'POST',body:{email:id[role]+'@test.invalid',password}});assert.equal(r.status,401,change);assert.equal(fired,true);assert.equal(r.headers.get('set-cookie'),null);assert.equal(count(e,'catalog_sessions'),before);
}
console.log('PASS: credentials rotated or staff disabled during login cannot mint a fresh session');
{
 const e=await setup();e.sqlite.prepare('INSERT INTO catalog_loyalty_settings VALUES(?,?,?)').run(id.salon,id.service,'test');
 for(let n=0;n<3;n++)e.sqlite.prepare("INSERT INTO catalog_live_bookings(id,owner_id,customer_id,customer_name,phone,services,starts_at,ends_at,total,status,request_key,request_hash,created_at) VALUES(?,?,?,'Synthetic','07700000000','[]',?, ?,100,'completed',?,'test','test')").run(crypto.randomUUID(),id.salon,id.customer,'2026-01-01T00:00:00Z','2026-01-01T00:30:00Z',crypto.randomUUID());
 const d={...booking(),rewardServiceId:id.service,expectedTotal:0},batch=e.db.batch.bind(e.db);let fired=false;
 e.db.batch=async q=>{if(q[0]?.sql.includes('INSERT INTO catalog_live_bookings')){fired=true;control(e,'deleted');}return batch(q);};
 const r=await send(e,'/api/catalog/workflow/customer/bookings',{role:'customer',method:'POST',body:d});assert.equal(r.status,409,await r.clone().text());assert.equal(fired,true);assert.equal(count(e,'catalog_live_bookings'),3);assert.equal(count(e,'catalog_loyalty_rewards'),0);assert.equal(count(e,'catalog_workflow_notifications'),0);
}
console.log('PASS: a real eligible loyalty reward is not inserted when disable wins the booking race');
console.log('Shared API regression tests passed');

{
 const e=await setup();
 e.sqlite.prepare("INSERT INTO salonati_admin_account_controls(app,owner_id,status) VALUES('salon',?,'deleted')").run(id.salon);
 e.sqlite.prepare('INSERT INTO catalog_sample_owners(owner_id) VALUES(?)').run(id.other);
 const response=await send(e,'/api/catalog/finance/options',{role:'admin'});assert.equal(response.status,200);const data=await response.json();assert.deepEqual(data.owners.map(o=>o.id),[id.cosmetics]);
 e.sqlite.prepare("INSERT INTO salonati_admin_account_controls(app,owner_id,status) VALUES('cosmetics',?,'deleted')").run(id.cosmetics);
 const empty=await send(e,'/api/catalog/finance/options',{role:'admin'});assert.deepEqual((await empty.json()).owners,[]);
 assert.equal(count(e,'catalog_accounts'),5);
}
console.log('PASS: finance owner options exclude deleted accounts, sample owners and staff; valid owners remain and records are retained');
{
 const e=await setup();e.env.LEGACY_DB={prepare(){return {all:async()=>({results:[]})};}};
 const bookingId='ffffffff-ffff-ffff-ffff-ffffffffffff';
 e.sqlite.prepare("INSERT INTO catalog_live_bookings(id,owner_id,customer_id,customer_name,phone,services,starts_at,ends_at,total,status,request_key,request_hash,created_at) VALUES(?,?,?,'Synthetic','07700000000','[]','2026-01-01T00:00:00Z','2026-01-01T00:30:00Z',100,'confirmed',?,'test','2026-01-01')").run(bookingId,id.salon,id.customer,crypto.randomUUID());
 let groups=await send(e,'/api/catalog/admin/bookings',{role:'admin'});assert.equal((await groups.json()).salons.length,1);
 for(const mode of ['deleted','sample']){
  if(mode==='deleted')control(e,'deleted');else{e.sqlite.prepare('DELETE FROM salonati_admin_account_controls').run();e.sqlite.prepare('INSERT INTO catalog_sample_owners(owner_id) VALUES(?)').run(id.salon);}
  groups=await send(e,'/api/catalog/admin/bookings',{role:'admin'});assert.deepEqual((await groups.json()).salons,[]);
  assert.equal((await send(e,'/api/catalog/admin/bookings/salon?salonId=live:'+id.salon,{role:'admin'})).status,404);
  assert.equal((await send(e,'/api/catalog/admin/bookings/detail?id='+bookingId,{role:'admin'})).status,404);
  assert.equal(count(e,'catalog_live_bookings'),1);
 }
}
console.log('PASS: deleted/sample salon booking summaries and direct drilldowns are hidden; active summaries work and booking records remain');
{
 const e=await setup();
 for(const [category,name,expectedCategory] of [['hijab','مكياج محجبات','makeup'],['brides','باقة العرائس','hair']]){
  let r=await send(e,'/api/catalog/services',{role:'salon',method:'POST',body:{name,category,price:200,minutes:45,mediaId:id.facade}});assert.equal(r.status,201,await r.clone().text());const created=await r.json();
  const stored=e.sqlite.prepare('SELECT category,section,status FROM catalog_revisions WHERE id=?').get(created.revisionId);assert.equal(stored.category,expectedCategory);assert.equal(stored.section,category);assert.equal(stored.status,'pending');
  const reviews=await (await send(e,'/api/catalog/reviews',{role:'admin'})).json();assert.equal(reviews.reviews.find(v=>v.revisionId===created.revisionId).section,category);
  r=await send(e,'/api/catalog/reviews/'+created.revisionId,{role:'admin',method:'POST',body:{action:'approve'}});assert.equal(r.status,200,await r.clone().text());
  const publicData=await (await send(e,'/api/catalog/public')).json();assert.equal(publicData.salons.find(s=>s.id===id.salon).services.find(v=>v.id===created.id).section,category);
  const own=await (await send(e,'/api/catalog/services',{role:'salon'})).json();assert.equal(own.services.find(v=>v.id===created.id).section,category);
 }
}
console.log('PASS: hijab and brides selections persist, remain pending until admin approval, and retain their section in owner and public reads');

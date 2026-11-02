import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,owner,customer} from './audit-db-test-helper.mjs';
const worker=await readFile(new URL('./live-worker.mjs',import.meta.url),'utf8'),extra=await readFile(new URL('./cosmetics-api.mjs',import.meta.url),'utf8');
const modules={};for(const role of ['salon','admin','customer','cosmetics'])modules[role]=await import('data:text/javascript;base64,'+Buffer.from(worker.replaceAll('__APP_ROLE__',role)+'\n'+extra+'\nexport {catalogAppSession,filterPublishedGallery};').toString('base64'));
const {sqlite,db}=fixture(),id='11111111-1111-1111-1111-111111111111',admin='22222222-2222-2222-2222-222222222222',cust='33333333-3333-3333-3333-333333333333',store='44444444-4444-4444-4444-444444444444';
owner(sqlite,id);owner(sqlite,admin,'admin','admin');owner(sqlite,store,'cosmetics');customer(sqlite,cust);
const token='a'.repeat(64),tokenHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
sqlite.prepare("INSERT INTO catalog_sessions VALUES(?,?,datetime('now','+1 day'))").run(tokenHash,id);
let actor={id:admin,role:'admin'},calls=0;
const env={IDENTITY_DB:db,SALONATI_API:{async fetch(request){calls++;if(request.url.endsWith('/me'))return Response.json({account:actor});return Response.json({ok:true});}}};
function request(role,path,method='GET',body){const origin=`https://salonati-${role}-clean.pages.dev`;return new Request(origin+path,{method,headers:{cookie:'__Host-catalog='+token,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
assert.equal((await modules.salon.catalogAppSession(request('salon','/'),env)).status,200);
for(const status of ['suspended','deleted']){
 sqlite.prepare("INSERT OR REPLACE INTO salonati_admin_account_controls(app,owner_id,status) VALUES('salon',?,?)").run(id,status);
 for(const [path,method,body] of [['/api/catalog/services/'+id,'DELETE'],['/api/catalog/products/'+id,'DELETE'],['/api/booking/blocks','PUT',{date:'2026-11-03',serviceIds:['*'],times:[]}],['/api/salon/home-profile','GET']]) {
  const r=await modules.salon.default.fetch(request('salon',path,method,body),env);assert.equal(r.status,401,`${status}: ${path}`);
 }
}
assert.equal(calls,0);console.log('PASS: disabled/deleted salons cannot reach early local mutation/profile handlers');
sqlite.prepare("DELETE FROM salonati_admin_account_controls WHERE owner_id=?").run(id);
// An alias alone never upgrades an owner to administrator.
sqlite.prepare("UPDATE salonati_phone_identities SET app='admin' WHERE account_id=?").run(id);
assert.equal((await modules.admin.catalogAppSession(request('admin','/'),env)).status,401);
sqlite.prepare("UPDATE salonati_phone_identities SET app='salon' WHERE account_id=?").run(id);
// Test local admin handlers with real admin session and restricted staff actor from API.
sqlite.prepare('UPDATE catalog_sessions SET account_id=? WHERE token_hash=?').run(admin,tokenHash);
actor={id:admin,role:'admin',staff:true,permissions:['finance_view']};
assert.equal((await modules.admin.default.fetch(request('admin','/api/catalog/admin/salon-manage','POST',{action:'delete',ownerId:id}),env)).status,403);
assert.equal((await modules.admin.default.fetch(request('admin','/api/support/contacts','POST',{phone:'',whatsapp:'',email:''}),env)).status,403);
console.log('PASS: database role checks and staff permission checks on local admin operations');
// Revocation and disabled-state changes commit together.
actor={id:admin,role:'admin'};
sqlite.prepare("INSERT INTO catalog_media(id,owner_id,object_key,mime,size) VALUES(?,?,?,'image/png',10)").run('facade',id,'facade-key');
sqlite.prepare("INSERT INTO catalog_registrations(owner_id,contact_name,phone,address,facade_media_id,status,submitted_at) VALUES(?,'test','07700000000','test','facade','approved','test')").run(id);
sqlite.prepare("INSERT INTO catalog_sessions VALUES('other-device',?,datetime('now','+1 day'))").run(id);
let r=await modules.admin.default.fetch(request('admin','/api/catalog/admin/salon-manage','POST',{action:'suspend',ownerId:id}),env);assert.equal(r.status,200);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM catalog_sessions WHERE account_id=?').get(id).n,0);
r=await modules.customer.default.fetch(request('customer','/api/customer/approved-catalog'),env);assert.equal(r.status,200);assert.deepEqual((await r.json()).salons,[]);
console.log('PASS: atomic session revocation and blocked salons excluded from alternate catalog');
sqlite.prepare("DELETE FROM salonati_admin_account_controls WHERE owner_id=?").run(id);
sqlite.prepare("INSERT INTO catalog_media(id,owner_id,object_key,mime,size) VALUES(?,?,?,'image/png',10)").run(id,id,'ad-key');
sqlite.prepare('INSERT INTO catalog_advertisements(id,owner_id,latest_revision) VALUES(?,?,?)').run('ad',id,'pending-ad');
sqlite.prepare("INSERT INTO catalog_ad_revisions(id,ad_id,owner_id,title,placement,media_id,status) VALUES('pending-ad','ad',?,'test','salon',?,'pending')").run(id,id);
r=await modules.customer.default.fetch(request('customer','/api/catalog/media/'+id),env);assert.equal(r.status,404);
const data={salons:[{id,gallery:[{revisionId:'pending-ad',mediaUrl:'pending-url'}],thumbnail:'pending-url'}]};await modules.customer.filterPublishedGallery(data,db);assert.deepEqual(data.salons[0].gallery,[]);assert.equal(data.salons[0].thumbnail,null);
sqlite.prepare("UPDATE catalog_ad_revisions SET status='approved' WHERE id='pending-ad'").run();sqlite.prepare("UPDATE catalog_advertisements SET published_revision='pending-ad'").run();
const published={salons:[{id,gallery:[{revisionId:'pending-ad',mediaUrl:'approved-url'}],thumbnail:'approved-url'}]};await modules.customer.filterPublishedGallery(published,db);assert.equal(published.salons[0].gallery.length,1);
console.log('PASS: pending ad metadata/media blocked; approved published gallery retained');
// A hidden cosmetics store cannot receive orders via a remembered direct store ID.
const state={store:{active:true},products:[{id:1,name:'test',price:10,stock:2}],offers:[]};
sqlite.prepare("INSERT INTO cosmetics_owner_state(owner_id,state_json,published_json,updated_at) VALUES(?,?,?,'test')").run(store,JSON.stringify(state),JSON.stringify(state));
sqlite.prepare("INSERT INTO salonati_admin_account_controls VALUES('cosmetics',?,'suspended',CURRENT_TIMESTAMP)").run(store);
actor={id:cust,name:'Test',phone:'07700000000',registered:true};
r=await modules.customer.default.fetch(request('customer','/api/cosmetics/customer/orders','POST',{ownerId:store,items:[{id:1,quantity:1}],requestKey:'request-key-000001',address:'Test',name:'Test',phone:'07700000000',paymentMethod:'cash',expectedTotal:10}),env);assert.equal(r.status,409);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM cosmetics_orders').get().n,0);
console.log('PASS: direct checkout rejects suspended cosmetics store');
for(const role of Object.keys(modules)){
 const path=role==='admin'?'/api/catalog/workflow/owner/bookings':'/api/catalog/admin/bookings';assert.equal((await modules[role].default.fetch(request(role,path),env)).status,403);
}
assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);console.log('PASS: four role route boundaries; no FK violations');

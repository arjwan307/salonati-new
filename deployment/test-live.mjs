import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const worker=await readFile(new URL('./live-worker.mjs',import.meta.url),'utf8');
const cosmetics=await readFile(new URL('./cosmetics-api.mjs',import.meta.url),'utf8');
async function app(role){return (await import('data:text/javascript;base64,'+Buffer.from(worker.replaceAll('__APP_ROLE__',role)+'\n'+cosmetics+'\nexport {cosmeticsState,cosmeticsOrder};').toString('base64')));}
const owner='11111111-1111-1111-1111-111111111111',customer='22222222-2222-2222-2222-222222222222';
const otherOwner='33333333-3333-3333-3333-333333333333';
const stockState=stock=>({store:{name:'Test store',phone:'07720000000',area:'Test area',address:'Test address',lat:'33.3',lng:'44.4',active:true},products:[{id:1,name:'Test product',price:12500,oldPrice:0,stock,category:'makeup',description:'Test',image:'https://example.invalid/image.png'}],offers:[]});
const modules={};for(const role of ['customer','salon','admin','cosmetics'])modules[role]=await app(role);
for(const role of Object.keys(modules)){
 let calls=0;const env={SALONATI_API:{fetch:()=>{calls++;return Response.json({error:'login_required'},{status:401});}}};
 const path=role==='admin'?'/api/catalog/workflow/owner/bookings':'/api/catalog/admin/bookings';
 assert.equal((await modules[role].default.fetch(new Request(`https://salonati-${role}-clean.pages.dev`+path),env)).status,403);assert.equal(calls,0);
 assert.equal((await modules[role].default.fetch(new Request(`https://salonati-${role}-review.pages.dev/api/catalog/public`),env)).status,403);
}
console.log('Four app boundaries and live/review host separation passed');
{
 const response=await modules.salon.default.fetch(new Request('https://salonati-salon-clean.pages.dev/api/catalog/workflow/owner/bookings',{headers:{cookie:'__Host-catalog='+'1'.repeat(64)}}),{IDENTITY_DB:{prepare:()=>({bind:()=>({first:async()=>({account_id:owner})})})},SALONATI_API:{fetch:()=>Response.json({bookings:[{id:'pending',status:'pending',name:'Private customer',phone:'07720000000',notes:'Private notes'},{id:'confirmed',status:'confirmed',name:'Accepted customer',phone:'07720000000'}]})}});
 const d=await response.json();assert.equal(d.bookings[0].phone,'');assert.notEqual(d.bookings[0].name,'Private customer');assert.equal(d.bookings[1].name,'Accepted customer');
 console.log('Salon contact information is withheld until booking acceptance');
}
let capturedCheckout,capturedReject;
function environment(mode){
 const queries=[];
 const db={prepare(sql){const q={sql,params:[],bind(...params){this.params=params;return this;},async first(){queries.push(this);if(sql.includes('salonati_phone_identities'))return {phone:'07720000000'};if(sql.includes('SELECT hits'))return {hits:1};if(sql.includes('request_hash'))return null;if(sql==='SELECT id FROM cosmetics_orders WHERE customer_id=? AND request_key=?')return {id:123};if(sql.includes('SELECT * FROM cosmetics_orders WHERE id=? AND owner_id=?'))return {id:123,owner_id:owner,customer_id:customer,status:'pending',items_json:JSON.stringify([{id:1,name:'Test product',price:12500,quantity:1}])};if(sql.includes('FROM cosmetics_owner_state'))return {state_json:JSON.stringify(stockState(mode==='reject'?0:1)),published_json:JSON.stringify(stockState(mode==='reject'?0:1)),version:mode==='reject'?2:1};return null;},async all(){queries.push(this);return {results:[]};},async run(){queries.push(this);return {meta:{changes:1}};}};return q;},async batch(statements){const result=statements.map(q=>({sql:q.sql,params:q.params}));if(mode==='checkout')capturedCheckout=result;if(mode==='reject')capturedReject=result;return statements.map(()=>({meta:{changes:1}}));}};
 return {queries,IDENTITY_DB:db,SALONATI_API:{fetch(request){assert.equal(request.headers.get('x-salonati-app'),null);return Response.json({account:mode==='checkout'?{id:customer,name:'Test customer',phone:'07720000000',registered:true}:{id:owner,role:'owner',salonName:'Test store'}});}}};
}
let env=environment('checkout');let base='https://salonati-customer-clean.pages.dev';
const order={ownerId:owner,customerId:'forged-customer',items:[{id:1,quantity:1,price:1}],name:'Test customer',phone:'07720000000',address:'Test delivery address',paymentMethod:'cash',expectedTotal:1,requestKey:'test-request-key-00001'};
const sendOrder=d=>modules.customer.default.fetch(new Request(base+'/api/cosmetics/customer/orders',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','x-salonati-app':'admin'},body:JSON.stringify(d)}),env);
assert.equal((await sendOrder(order)).status,409);assert.equal(capturedCheckout,undefined);
const placed=await sendOrder({...order,expectedTotal:12500});assert.equal(placed.status,201);assert.equal((await placed.json()).total,12500);
assert.equal(capturedCheckout[0].params[1],customer);assert.equal(JSON.parse(capturedCheckout[0].params[7])[0].price,12500);
assert.ok(env.queries.filter(q=>q.sql.includes('FROM cosmetics_owner_state')).every(q=>q.params[0]===owner));
console.log('Checkout uses the authenticated customer and published prices; forged price/customer fields rejected');
env=environment('reject');base='https://salonati-cosmetics-clean.pages.dev';
const rejected=await modules.cosmetics.default.fetch(new Request(base+'/api/cosmetics/orders/status',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({id:123,ownerId:otherOwner,status:'rejected'})}),env);
assert.equal(rejected.status,200);assert.equal(capturedReject[0].params[3],owner);
const masked=modules.cosmetics.cosmeticsOrder({id:1,owner_id:owner,customer_name:'Private name',phone:'07720000000',address:'Private address',items_json:'[]',total:1,status:'pending',created_at:new Date().toISOString()},false);
assert.notEqual(masked.name,'Private name');assert.equal(masked.phone,'');assert.notEqual(masked.address,'Private address');
assert.throws(()=>modules.cosmetics.cosmeticsState({...stockState(1),products:[{...stockState(1).products[0],image:'javascript:alert(1)'}]}));
console.log('Owner-scoped updates, pending customer-detail privacy, and image URL validation passed');
{
 const e={IDENTITY_DB:{},SALONATI_API:{fetch:()=>Response.json({account:{id:owner,role:'admin',staff:true,permissions:['finance_view']}})}};
 const r=await modules.admin.default.fetch(new Request('https://salonati-admin-clean.pages.dev/api/catalog/admin/cosmetics-reviews'),e);assert.equal(r.status,403);
}
for(const role of ['customer','salon','cosmetics']){
 let created;const database={prepare(sql){return {sql,params:[],bind(...params){this.params=params;return this;},run:async()=>({meta:{changes:1}}),first:async()=>({hits:1})};},batch:async q=>{created=q;return q.map(()=>({meta:{changes:1}}));}};
 const origin=`https://salonati-${role}-clean.pages.dev`,path=role==='customer'?'/api/link/customer/register':role==='cosmetics'?'/api/cosmetics/register':'/api/catalog/register';
 const r=await modules[role].default.fetch(new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Test account',salonName:'Test salon',phone:'0772 000 0000',password:'test-password-only',role:'admin'})}),{IDENTITY_DB:database,SALONATI_API:{}});
 assert.equal(r.status,201);assert.equal(created.length,3);assert.equal(created[1].params[0],role);assert.equal(created[1].params[1],'07720000000');assert.ok(r.headers.get('set-cookie').includes('HttpOnly'));if(role!=='customer')assert.ok(created[0].sql.includes("'owner'"));
}
console.log('Staff review permissions and self-registration role escalation checks passed');
{
 let reads=0;const e={MEDIA:{get:()=>{reads++;throw Error('private object must not be read');}},IDENTITY_DB:{prepare(sql){return {bind(){return this;},first:async()=>sql.includes('FROM cosmetics_media')?{id:'44444444-4444-4444-4444-444444444444',owner_id:otherOwner,object_key:'private-other-object',mime:'image/png',size:67}:sql.includes('salonati_phone_identities')?{phone:'07720000000'}:null};}},SALONATI_API:{fetch:()=>Response.json({account:{id:owner,role:'owner'}})}};
 const r=await modules.cosmetics.default.fetch(new Request('https://salonati-cosmetics-clean.pages.dev/api/cosmetics/media/44444444-4444-4444-4444-444444444444'),e);assert.equal(r.status,404);assert.equal(reads,0);
 console.log('A guessed private image ID cannot read another store’s R2 object');
}
const sql=await readFile(new URL('./cosmetics.sql',import.meta.url),'utf8');
const python=String.raw`
import sys,json,sqlite3
d=json.load(sys.stdin);c=sqlite3.connect(':memory:')
c.execute('PRAGMA foreign_keys=ON')
c.executescript('CREATE TABLE catalog_accounts(id TEXT PRIMARY KEY); CREATE TABLE catalog_customer_accounts(id TEXT PRIMARY KEY);'+d['schema'])
for actor in [d['owner'],d['otherOwner']]:c.execute('INSERT INTO catalog_accounts VALUES(?)',(actor,))
c.execute('INSERT INTO catalog_customer_accounts VALUES(?)',(d['customer'],))
c.execute("INSERT INTO cosmetics_owner_state(owner_id,state_json,published_json,version,updated_at) VALUES(?,?,?,1,'test')",(d['owner'],json.dumps(d['state']),json.dumps(d['state'])))
c.commit()
def batch(statements):
 with c:
  for q in statements:c.execute(q['sql'],q['params'])
batch(d['checkout']);batch(d['checkout'])
assert c.execute('SELECT COUNT(*) FROM cosmetics_orders').fetchone()[0]==1
assert json.loads(c.execute('SELECT state_json FROM cosmetics_owner_state').fetchone()[0])['products'][0]['stock']==0
c.execute('UPDATE cosmetics_orders SET id=123');c.commit()
batch(d['reject']);batch(d['reject'])
assert c.execute('SELECT status FROM cosmetics_orders WHERE id=123').fetchone()[0]=='rejected'
assert json.loads(c.execute('SELECT state_json FROM cosmetics_owner_state').fetchone()[0])['products'][0]['stock']==1
print('Real SQLite: duplicate checkout cannot oversell; repeated rejection cannot double-restock')
`;
const result=spawnSync('python',['-c',python],{input:JSON.stringify({schema:sql,owner,otherOwner,customer,state:stockState(1),checkout:capturedCheckout,reject:capturedReject}),encoding:'utf8'});
assert.equal(result.status,0,result.stderr);process.stdout.write(result.stdout);
console.log('Live API checks passed');

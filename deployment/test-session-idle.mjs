import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,owner,customer} from './audit-db-test-helper.mjs';
const source=await readFile('deployment/live-worker.mjs','utf8'),extra=await readFile('deployment/cosmetics-api.mjs','utf8');
for(const role of ['salon','admin','customer','cosmetics']){
 const {sqlite,db}=fixture(),id='11111111-1111-1111-1111-111111111111',isCustomer=role==='customer';
 if(isCustomer)customer(sqlite,id);else owner(sqlite,id,role,role==='admin'?'admin':'owner');
 const table=isCustomer?'catalog_customer_sessions':'catalog_sessions',token='b'.repeat(64),hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex'),cookie=(isCustomer?'__Host-salonati-customer':'__Host-catalog')+'='+token;
 sqlite.prepare(`INSERT INTO ${table} VALUES(?,?,datetime('now','+30 minutes'))`).run(hash,id);
 const worker=(await import('data:text/javascript;base64,'+Buffer.from(source.replaceAll('__APP_ROLE__',role)+'\n'+extra).toString('base64'))).default;
 const origin=`https://salonati-${role}-clean.pages.dev`,request=(method,sourceOrigin=origin)=>new Request(origin+'/api/session/activity',{method,headers:{cookie,Origin:sourceOrigin}}),env={IDENTITY_DB:db};
 const deadline=()=>sqlite.prepare(`SELECT expires_at FROM ${table} WHERE token_hash=?`).get(hash).expires_at;
 const original=deadline();assert.equal((await worker.fetch(request('GET'),env)).status,200);assert.equal(deadline(),original,'background checks must not renew');
 assert.equal((await worker.fetch(request('POST','https://untrusted.invalid'),env)).status,403);assert.equal(deadline(),original);
 const active=await worker.fetch(request('POST'),env);assert.equal(active.status,200);assert.match(active.headers.get('set-cookie'),/Max-Age=7200/);assert.ok(Math.abs(Date.parse(deadline()+'Z')-Date.now()-7200000)<3000);
 sqlite.prepare(`UPDATE ${table} SET expires_at=datetime('now','-1 second')`).run();const expired=deadline();assert.equal((await worker.fetch(request('POST'),env)).status,401);assert.equal(deadline(),expired,'expired sessions must not be revived');
 sqlite.close();
}
console.log('PASS: all four apps renew only on user activity, enforce two hours of inactivity, reject cross-origin renewal, and cannot revive expired sessions');

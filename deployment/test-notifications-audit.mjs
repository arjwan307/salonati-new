import assert from 'node:assert/strict';
import {fixture,customer} from './audit-db-test-helper.mjs';
import {deliverOffers} from './customer-notifier.mjs';
const {sqlite,db}=fixture(),id='11111111-1111-1111-1111-111111111111';customer(sqlite,id);
sqlite.exec("INSERT INTO salonati_notification_settings VALUES('started_at','2026-11-03'); INSERT INTO salonati_offer_notifications(id,title,body) VALUES('offer','test','test')");
sqlite.prepare("INSERT INTO catalog_customer_sessions VALUES('token',?,datetime('now','+1 day'))").run(id);
sqlite.prepare("INSERT INTO salonati_push_subscriptions(id,customer_id,token_hash,endpoint) VALUES('device',?,'token','https://fcm.googleapis.com/test')").run(id);
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const env={DB:db,VAPID_PRIVATE_KEY:JSON.stringify(await crypto.subtle.exportKey('jwk',pair.privateKey)),VAPID_PUBLIC_KEY:'test-public-key'};
let sends=0,release,startedResolve;const started=new Promise(r=>startedResolve=r),hold=new Promise(r=>release=r),original=globalThis.fetch;
try{
 globalThis.fetch=async()=>{sends++;startedResolve();await hold;return new Response(null,{status:201});};
 const first=deliverOffers(env);await started;assert.equal((await deliverOffers(env)).sent,0);release();assert.equal((await first).sent,1);assert.equal(sends,1);
 assert.equal((await deliverOffers(env)).sent,0);assert.equal(sends,1);
 sqlite.exec("UPDATE salonati_push_subscriptions SET last_seq=0; DELETE FROM catalog_customer_sessions");
 assert.equal((await deliverOffers(env)).sent,0);assert.equal(sends,1);
 assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM catalog_rate WHERE key LIKE 'push-delivery:%'").get().n,0);
 console.log('PASS: overlapping cron lease, checkpoint prevents repeated sends, revoked session receives no push, leases released');
}finally{globalThis.fetch=original;release?.();}

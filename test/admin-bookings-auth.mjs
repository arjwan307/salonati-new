import assert from 'node:assert/strict';
import {moderationRoutes} from '../server/moderation.mjs';
const urls=['admin/bookings','admin/bookings/salon?salonId=s1','admin/bookings/detail?id=b1'];
for(const route of urls){
 const request=new Request('https://example.invalid/api/catalog/'+route);
 let r=await moderationRoutes(request,{MODERATION_DB:{}});
 assert.equal(r.status,401);
 let touchedLegacy=false;
 const env={MODERATION_DB:{prepare(){return {bind(){return this},async first(){return {id:'owner',role:'owner'}}}}},get LEGACY_DB(){touchedLegacy=true;throw Error('unauthorized legacy access')}};
 r=await moderationRoutes(new Request(request,{headers:{cookie:'__Host-catalog='+'a'.repeat(64)}}),env);
 assert.equal(r.status,403);assert.equal(touchedLegacy,false);
}
console.log('PASS: all three booking endpoints reject guests and salon accounts before reading booking data');

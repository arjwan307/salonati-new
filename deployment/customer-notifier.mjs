const encode=value=>btoa(String.fromCharCode(...new Uint8Array(value))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const text64=value=>encode(new TextEncoder().encode(JSON.stringify(value)));
export async function vapidAuthorization(endpoint,env){const header=text64({typ:'JWT',alg:'ES256'}),payload=text64({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+43200,sub:'https://salonati-customer-clean.pages.dev'}),input=header+'.'+payload;const key=await crypto.subtle.importKey('jwk',JSON.parse(env.VAPID_PRIVATE_KEY),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(input));return 'vapid t='+input+'.'+encode(signature)+', k='+env.VAPID_PUBLIC_KEY;}
export async function collectOffers(db){
 const since=(await db.prepare("SELECT value FROM salonati_notification_settings WHERE key='started_at'").first()).value;
 const queries=[
  db.prepare("SELECT 'campaign:'||id||':'||updated_at AS id,title,'عرض جديد من إدارة صالوناتي' AS body FROM catalog_campaigns WHERE active=1 AND julianday(updated_at)>julianday(?) ORDER BY updated_at DESC LIMIT 30").bind(since),
  db.prepare("SELECT 'discount:'||r.id AS id,r.name AS title,'خصم جديد على خدمة معتمدة' AS body FROM catalog_services s JOIN catalog_revisions r ON r.id=s.published_revision JOIN catalog_registrations reg ON reg.owner_id=s.owner_id AND reg.status='approved' LEFT JOIN salonati_admin_account_controls c ON c.app='salon' AND c.owner_id=s.owner_id WHERE r.status='approved' AND r.active=1 AND COALESCE(c.status,'active')='active' AND r.discount_price IS NOT NULL AND julianday(r.discount_start)<=julianday('now') AND julianday(r.discount_end)>julianday('now') AND (julianday(COALESCE(r.reviewed_at,r.created_at))>julianday(?) OR julianday(r.discount_start)>julianday(?)) LIMIT 30").bind(since,since),
  db.prepare("SELECT 'cosmetics:'||o.owner_id||':'||json_extract(o.published_json,'$.offers') AS id,json_extract(o.published_json,'$.store.name') AS title,'عروض جديدة من متاجر الكوزمتك المعتمدة' AS body FROM cosmetics_owner_state o LEFT JOIN salonati_admin_account_controls c ON c.app='cosmetics' AND c.owner_id=o.owner_id WHERE o.review_status='approved' AND o.published_json IS NOT NULL AND json_extract(o.published_json,'$.store.active')=1 AND json_array_length(o.published_json,'$.offers')>0 AND COALESCE(c.status,'active')='active' AND julianday(o.updated_at)>julianday(?) LIMIT 30").bind(since)
 ];
 const results=await Promise.all(queries.map(q=>q.all()));const rows=results.flatMap(r=>r.results);for(const row of rows)row.id=encode(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(row.id)));if(rows.length)await db.batch(rows.map(r=>db.prepare('INSERT OR IGNORE INTO salonati_offer_notifications(id,title,body) VALUES(?,?,?)').bind(r.id,String(r.title||'عرض جديد').slice(0,160),r.body)));
}
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const join=(...values)=>{const out=new Uint8Array(values.reduce((n,v)=>n+v.length,0));let i=0;for(const v of values){out.set(v,i);i+=v.length;}return out;};
const bytes=value=>new TextEncoder().encode(value);
async function hkdf(value,salt,info,length){const key=await crypto.subtle.importKey('raw',value,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,length*8));}
// RFC 8291: one aes128gcm record, with a fresh ECDH key and salt for each send.
export async function encryptPush(subscription,payload){
 const client=decode(subscription.p256dh),auth=decode(subscription.auth),pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const publicKey=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey)),peer=await crypto.subtle.importKey('raw',client,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=await crypto.subtle.deriveBits({name:'ECDH',public:peer},pair.privateKey,256),ikm=await hkdf(shared,auth,join(bytes('WebPush: info\0'),client,publicKey),32),salt=crypto.getRandomValues(new Uint8Array(16));
 const key=await hkdf(ikm,salt,bytes('Content-Encoding: aes128gcm\0'),16),nonce=await hkdf(ikm,salt,bytes('Content-Encoding: nonce\0'),12),plain=join(bytes(JSON.stringify(payload)),new Uint8Array([2]));
 if(plain.length>3500)throw Error('push_payload_too_large');
 const aes=await crypto.subtle.importKey('raw',key,'AES-GCM',false,['encrypt']),encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},aes,plain));
 return join(salt,new Uint8Array([0,0,16,0,65]),publicKey,encrypted);
}
async function unread(db,id){const row=await db.prepare("SELECT (SELECT COUNT(*) FROM salonati_offer_notifications WHERE seq>COALESCE((SELECT offer_seq FROM salonati_notification_reads WHERE customer_id=?),0))+(SELECT COUNT(*) FROM salonati_customer_notifications n JOIN catalog_live_bookings b ON b.id=n.booking_id WHERE n.customer_id=? AND n.read_at IS NULL AND b.status='confirmed' AND b.starts_at=n.starts_at AND b.started_at IS NULL AND julianday(b.starts_at)>julianday('now') AND NOT EXISTS(SELECT 1 FROM salonati_admin_account_controls c WHERE c.app='salon' AND c.owner_id=b.owner_id AND c.status!='active')) AS count").bind(id,id).first();return row.count;}
async function lease(db,key){const now=Math.floor(Date.now()/1000);return db.prepare('INSERT INTO catalog_rate(key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET expires_at=excluded.expires_at WHERE catalog_rate.expires_at<=? RETURNING key').bind(key,now+120,now).first();}
async function sendPush(subscription,env,payload,ttl=3600){
 const headers={Authorization:await vapidAuthorization(subscription.endpoint,env),TTL:String(ttl),Urgency:payload.kind==='offer'?'low':'high'};
 const body=subscription.p256dh&&subscription.auth?await encryptPush(subscription,payload):undefined;
 if(body){headers['Content-Encoding']='aes128gcm';headers['Content-Type']='application/octet-stream';}
 return fetch(subscription.endpoint,{method:'POST',redirect:'error',headers,body,signal:AbortSignal.timeout(10000)});
}
// Expired login cookies do not revoke device consent. Explicit logout deletes the
// session and its subscription; deletion/revocation therefore still stops push.
const consent="JOIN catalog_customer_accounts a ON a.id=p.customer_id JOIN catalog_customer_sessions s ON s.token_hash=p.token_hash AND s.customer_id=p.customer_id";
export async function deliverOffers(env){
 const db=env.DB;await collectOffers(db);const latest=(await db.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM salonati_offer_notifications').first()).seq;if(!latest)return {sent:0};
 const subscribers=(await db.prepare("SELECT p.* FROM salonati_push_subscriptions p "+consent+" WHERE p.last_seq<? ORDER BY p.updated_at LIMIT 50").bind(latest).all()).results;let sent=0;
 for(const p of subscribers){const key='push-delivery:'+p.id;if(!await lease(db,key))continue;
  try{
   const current=await db.prepare("SELECT p.id FROM salonati_push_subscriptions p "+consent+" WHERE p.id=? AND p.token_hash=? AND p.last_seq<?").bind(p.id,p.token_hash,latest).first();if(!current)continue;
   const response=await sendPush(p,env,{kind:'offer',title:'صالوناتي',body:'لديكِ عروض وخصومات جديدة. افتحي التطبيق للاطلاع عليها.',tag:'salonati-offers',url:'/?notifications=1',unread:await unread(db,p.customer_id)});
   if(response.ok){await db.prepare('UPDATE salonati_push_subscriptions SET last_seq=? WHERE id=? AND token_hash=?').bind(latest,p.id,p.token_hash).run();sent++;}
   else if([404,410].includes(response.status))await db.prepare('DELETE FROM salonati_push_subscriptions WHERE id=? AND token_hash=?').bind(p.id,p.token_hash).run();
  }catch{console.warn('push_delivery_retry');}finally{await db.prepare('DELETE FROM catalog_rate WHERE key=?').bind(key).run();}
 }
 return {sent};
}
export async function collectReminders(db){
 for(const [kind,hours] of [['reminder24',24],['reminder3',3]]){
  const rows=(await db.prepare("SELECT b.id,b.customer_id,b.starts_at FROM catalog_live_bookings b JOIN catalog_customer_accounts a ON a.id=b.customer_id JOIN catalog_registrations r ON r.owner_id=b.owner_id AND r.status='approved' WHERE b.status='confirmed' AND b.started_at IS NULL AND julianday(b.starts_at)>julianday('now') AND julianday(b.starts_at)<=julianday('now',?) AND julianday(b.starts_at)>julianday('now',?) AND NOT EXISTS(SELECT 1 FROM salonati_admin_account_controls c WHERE c.app='salon' AND c.owner_id=b.owner_id AND c.status!='active') AND NOT EXISTS(SELECT 1 FROM catalog_sample_owners o WHERE o.owner_id=b.owner_id) ORDER BY b.starts_at LIMIT 100").bind('+'+hours+' hours','+'+(hours*60-15)+' minutes').all()).results;
  for(const row of rows){const id=encode(await crypto.subtle.digest('SHA-256',bytes(row.id+'|'+row.starts_at+'|'+kind)));await db.prepare('INSERT OR IGNORE INTO salonati_customer_notifications(id,customer_id,booking_id,starts_at,kind,title,body) VALUES(?,?,?,?,?,?,?)').bind(id,row.customer_id,row.id,row.starts_at,kind,'تذكير بموعدكِ — صالوناتي',hours===24?'تذكير: موعد حجزكِ المؤكد بعد نحو يوم. افتحي حجوزاتي لمراجعة التفاصيل.':'تذكير: موعد حجزكِ المؤكد بعد نحو ٣ ساعات. افتحي حجوزاتي لمراجعة التفاصيل.').run();}
 }
}
export async function deliverReminders(env){
 const db=env.DB;await collectReminders(db);
 const rows=(await db.prepare("SELECT p.*,n.id AS notification_id,n.title,n.body,n.kind,n.starts_at,n.booking_id FROM salonati_customer_notifications n JOIN catalog_live_bookings b ON b.id=n.booking_id JOIN salonati_push_subscriptions p ON p.customer_id=n.customer_id "+consent+" WHERE n.read_at IS NULL AND b.status='confirmed' AND b.started_at IS NULL AND b.starts_at=n.starts_at AND julianday(b.starts_at)>julianday('now') AND julianday(n.created_at)>julianday('now','-15 minutes') AND NOT EXISTS(SELECT 1 FROM salonati_notification_deliveries d WHERE d.subscription_id=p.id AND d.notification_id=n.id) AND NOT EXISTS(SELECT 1 FROM salonati_admin_account_controls c WHERE c.app='salon' AND c.owner_id=b.owner_id AND c.status!='active') ORDER BY n.created_at LIMIT 100").all()).results;let sent=0;
 for(const n of rows){const key='push-reminder:'+n.id+':'+n.notification_id;if(!await lease(db,key))continue;
  try{
   const current=await db.prepare("SELECT p.id FROM salonati_push_subscriptions p "+consent+" JOIN salonati_customer_notifications n ON n.customer_id=p.customer_id JOIN catalog_live_bookings b ON b.id=n.booking_id WHERE p.id=? AND p.token_hash=? AND n.id=? AND n.read_at IS NULL AND b.status='confirmed' AND b.started_at IS NULL AND b.starts_at=n.starts_at AND julianday(b.starts_at)>julianday('now') AND NOT EXISTS(SELECT 1 FROM salonati_notification_deliveries d WHERE d.subscription_id=p.id AND d.notification_id=n.id) AND NOT EXISTS(SELECT 1 FROM salonati_admin_account_controls c WHERE c.app='salon' AND c.owner_id=b.owner_id AND c.status!='active')").bind(n.id,n.token_hash,n.notification_id).first();if(!current)continue;
   const response=await sendPush(n,env,{kind:n.kind,title:n.title,body:n.body,tag:'salonati-'+n.notification_id,url:'/?bookings=1',unread:await unread(db,n.customer_id)},Math.min(900,Math.max(60,Math.floor((Date.parse(n.starts_at)-Date.now())/1000))));
   if(response.ok){await db.prepare('INSERT OR IGNORE INTO salonati_notification_deliveries(subscription_id,notification_id) SELECT id,? FROM salonati_push_subscriptions WHERE id=? AND token_hash=?').bind(n.notification_id,n.id,n.token_hash).run();sent++;}
   else if([404,410].includes(response.status))await db.prepare('DELETE FROM salonati_push_subscriptions WHERE id=? AND token_hash=?').bind(n.id,n.token_hash).run();
  }catch{console.warn('reminder_push_retry');}finally{await db.prepare('DELETE FROM catalog_rate WHERE key=?').bind(key).run();}
 }
 return {sent};
}
export default {fetch(){return new Response('Not found',{status:404});},async scheduled(controller,env){const reminders=await deliverReminders(env),offers=await deliverOffers(env);console.log(JSON.stringify({event:'customer_push',reminders:reminders.sent,offers:offers.sent}));}};

// Included in the Pages worker. Identity always comes from verified sessions.
const cosmeticsJson = (value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function protectOwnerBookingContacts(request,url,response){
 if(role!=='salon'||request.method!=='GET'||url.pathname!=='/api/catalog/workflow/owner/bookings'||!response.ok)return response;
 const data=JSON.parse(new TextDecoder().decode(await cosmeticsBody(response,4194304)));
 if(Array.isArray(data.bookings))data.bookings=data.bookings.map(b=>['confirmed','completed'].includes(b.status)?b:{...b,name:'زبونة',phone:'',notes:'تظهر تفاصيل الزبونة بعد قبول الحجز'});
 return cosmeticsJson(data,response.status);
}
async function cosmeticsBody(request,max=1048576){
 const reader=request.body?.getReader();if(!reader)throw Object.assign(Error('invalid_input'),{status:400});
 const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Object.assign(Error('body_too_large'),{status:413});}chunks.push(value);}
 const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;
}
async function cosmeticsInput(request){try{return JSON.parse(new TextDecoder().decode(await cosmeticsBody(request)));}catch(e){if(e.status)throw e;throw Object.assign(Error('invalid_input'),{status:400});}}
async function cosmeticsSession(request,env,kind){
 if(kind==='customer'&&role!=='customer'||kind==='admin'&&role!=='admin'||kind==='owner'&&role!=='cosmetics')return null;
 const headers=new Headers(request.headers);headers.delete('x-salonati-app');
 const path=kind==='customer'?'/api/link/customer/me':'/api/catalog/me';
 const response=await env.SALONATI_API.fetch(new Request(new URL(path,request.url),{headers}));
 if(!response.ok)return null;const account=(await response.json()).account;if(!account?.id)return null;
 if(kind==='customer')return account;
 if(kind==='admin')return account.role==='admin'?account:null;
 if(account.role!=='owner')return null;
 const identity=await env.IDENTITY_DB.prepare("SELECT phone FROM salonati_phone_identities WHERE app='cosmetics' AND account_id=?").bind(account.id).first();
 return identity?{...account,phone:env.REVIEW_MODE==='enabled'?identity.phone.split('#')[0]:identity.phone}:null;
}
function cosmeticsPermit(actor,permission){return actor&&(!actor.staff||(actor.permissions||[]).includes(permission));}
function cosmeticsText(value,max=2000){const s=String(value??'').trim();if(s.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f<>]/.test(s))throw Object.assign(Error('invalid_input'),{status:400});return s;}
function cosmeticsImage(value){if(!value)return '';const s=String(value);if(/^\/api\/cosmetics\/media\/[a-f0-9-]{36}$/.test(s))return s;let u;try{u=new URL(s);}catch{throw Object.assign(Error('invalid_image'),{status:400});}if(u.protocol!=='https:'||u.username||u.password||s.length>2048)throw Object.assign(Error('invalid_image'),{status:400});return u.href;}
function cosmeticsState(value){
 if(!value||!value.store||!Array.isArray(value.products)||value.products.length>300||!Array.isArray(value.offers)||value.offers.length>100)throw Object.assign(Error('invalid_input'),{status:400});
 const store={};for(const [key,max] of Object.entries({name:100,area:100,address:500,phone:25,openTime:30,closeTime:30,about:2000,lat:30,lng:30,facadeUrl:2048}))store[key]=cosmeticsText(value.store[key],max);store.active=value.store.active===true;store.facadeUrl=cosmeticsImage(store.facadeUrl);
 if(store.lat&&(!Number.isFinite(Number(store.lat))||Math.abs(Number(store.lat))>90)||store.lng&&(!Number.isFinite(Number(store.lng))||Math.abs(Number(store.lng))>180))throw Object.assign(Error('invalid_location'),{status:400});
 const products=value.products.map(p=>{if(!Number.isSafeInteger(p.id)||p.id<1||!Number.isSafeInteger(p.price)||p.price<1||p.price>1000000000||!Number.isSafeInteger(p.stock)||p.stock<0||p.stock>1000000||!['makeup','skincare','perfumes','hair','accessories'].includes(p.category))throw Object.assign(Error('invalid_product'),{status:400});const name=cosmeticsText(p.name,100);if(!name)throw Object.assign(Error('invalid_product'),{status:400});return {id:p.id,name,price:p.price,oldPrice:Number.isSafeInteger(p.oldPrice)&&p.oldPrice>=0&&p.oldPrice<=1000000000?p.oldPrice:0,stock:p.stock,category:p.category,description:cosmeticsText(p.description),image:cosmeticsImage(p.image)};});
 if(new Set(products.map(p=>p.id)).size!==products.length)throw Object.assign(Error('invalid_product'),{status:400});
 const offers=value.offers.map(o=>{const title=cosmeticsText(o.title,120);if(!Number.isSafeInteger(o.id)||o.id<1||!title)throw Object.assign(Error('invalid_offer'),{status:400});const mediaUrl=typeof o.mediaUrl==='string'&&/^\/api\/cosmetics\/media\/[a-f0-9-]{36}$/.test(o.mediaUrl)?o.mediaUrl:'';const mediaType=mediaUrl&&['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'].includes(o.mediaType)?o.mediaType:'';return {id:o.id,title,discount:cosmeticsText(o.discount,100),details:cosmeticsText(o.details),mediaUrl:mediaType?mediaUrl:'',mediaType};});if(new Set(offers.map(o=>o.id)).size!==offers.length)throw Object.assign(Error('invalid_offer'),{status:400});return {store,products,offers};
}
function cosmeticsEmpty(account){return {store:{name:account.salonName||'',phone:account.phone||'',area:'',address:'',openTime:'8:00 ص',closeTime:'10:00 م',about:'',lat:'',lng:'',active:false},products:[],offers:[]};}
function cosmeticsOrder(row,privateDetails=true){return {id:row.id,storeId:row.owner_id,name:privateDetails?row.customer_name:'زبونة',phone:privateDetails?row.phone:'',address:privateDetails?row.address:'تظهر بيانات التوصيل بعد قبول الطلب',items:JSON.parse(row.items_json).map(p=>p.name+(p.quantity>1?' × '+p.quantity:'')),total:row.total,date:row.created_at.slice(0,10),time:row.created_at.slice(11,16),status:row.status,createdAt:row.created_at};}
async function cosmeticsLimit(db,id,action,max){const key=asHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id+':cosmetics:'+action+':'+Math.floor(Date.now()/600000))));await db.prepare('INSERT INTO catalog_rate(key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1').bind(key,Math.floor(Date.now()/1000)+1200).run();return (await db.prepare('SELECT hits FROM catalog_rate WHERE key=?').bind(key).first()).hits<=max;}
async function cosmeticsRoutes(request,env,url){
 const path=url.pathname;if(!path.startsWith('/api/cosmetics/')&&!path.startsWith('/api/catalog/admin/cosmetics-'))return null;
 if(!env.IDENTITY_DB||!env.SALONATI_API)return cosmeticsJson({error:'service_unavailable'},503);
 if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)return cosmeticsJson({error:'origin_denied'},403);
 const db=env.IDENTITY_DB;
 try{
  if(path==='/api/cosmetics/public'&&request.method==='GET'){
   const rows=(await db.prepare('SELECT owner_id,state_json,published_json FROM cosmetics_owner_state WHERE published_json IS NOT NULL').all()).results;
   const stores=rows.flatMap(r=>{const p=JSON.parse(r.published_json),current=JSON.parse(r.state_json);if(!p.store.active)return [];return [{id:r.owner_id,store:p.store,products:p.products.flatMap(item=>{const live=current.products.find(x=>x.id===item.id);return live&&live.stock>0?[{...item,stock:live.stock}]:[]}),offers:p.offers}];});return cosmeticsJson({stores});
  }
  const mediaMatch=/^\/api\/cosmetics\/media\/([a-f0-9-]{36})$/.exec(path);
  if(mediaMatch&&['GET','HEAD'].includes(request.method)){
   if(!env.MEDIA)return cosmeticsJson({error:'media_unavailable'},503);
   const row=await db.prepare('SELECT * FROM cosmetics_media WHERE id=?').bind(mediaMatch[1]).first();if(!row)return cosmeticsJson({error:'not_found'},404);
   const published=await db.prepare("SELECT owner_id FROM cosmetics_owner_state WHERE owner_id=? AND published_json IS NOT NULL AND json_extract(published_json,'$.store.active')=1 AND EXISTS(SELECT 1 FROM json_each(published_json,'$.products') p WHERE json_extract(p.value,'$.image')=?)").bind(row.owner_id,path).first();
   if(!published){const actor=await cosmeticsSession(request,env,'owner'),admin=actor?null:await cosmeticsSession(request,env,'admin');if(actor?.id!==row.owner_id&&!cosmeticsPermit(admin,'reviews'))return cosmeticsJson({error:'not_found'},404);}
   const object=await env.MEDIA.get(row.object_key);if(!object)return cosmeticsJson({error:'not_found'},404);return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':row.mime,'Content-Length':String(row.size),'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
  }
  if(path.startsWith('/api/catalog/admin/cosmetics-')){
   const actor=await cosmeticsSession(request,env,'admin');if(!actor)return cosmeticsJson({error:'admin_required'},403);
   if(path==='/api/catalog/admin/cosmetics-stores'&&request.method==='GET'){
    if(!cosmeticsPermit(actor,'reviews'))return cosmeticsJson({error:'permission_denied'},403);
    const rows=(await db.prepare("SELECT owner_id,state_json,published_json,review_status,review_reason,updated_at FROM cosmetics_owner_state ORDER BY updated_at DESC LIMIT 250").all()).results;
    return cosmeticsJson({stores:rows.map(r=>{const state=JSON.parse(r.state_json);const published=r.published_json?JSON.parse(r.published_json):null;return {ownerId:r.owner_id,store:state.store,publishedStore:published?.store||null,status:r.review_status,reason:r.review_reason,updatedAt:r.updated_at};})});
   }
   if(path==='/api/catalog/admin/cosmetics-counts'&&request.method==='GET'){
    const counts=await Promise.all([cosmeticsPermit(actor,'reviews')?db.prepare("SELECT COUNT(*) AS n FROM cosmetics_owner_state WHERE review_status='pending'").first():Promise.resolve({n:0}),cosmeticsPermit(actor,'bookings')?db.prepare("SELECT COUNT(*) AS n FROM cosmetics_orders WHERE status='pending'").first():Promise.resolve({n:0})]);return cosmeticsJson({reviews:counts[0].n,orders:counts[1].n});
   }
   if(path==='/api/catalog/admin/cosmetics-reviews'){
    if(!cosmeticsPermit(actor,'reviews'))return cosmeticsJson({error:'permission_denied'},403);
    if(request.method==='GET'){const rows=(await db.prepare("SELECT owner_id,state_json,version,review_status,review_reason,updated_at FROM cosmetics_owner_state WHERE review_status='pending' ORDER BY updated_at DESC LIMIT 200").all()).results;return cosmeticsJson({reviews:rows.map(r=>({...r,state:JSON.parse(r.state_json),state_json:undefined}))});}
    if(request.method==='POST'){const d=await cosmeticsInput(request);if(!['approved','rejected'].includes(d.status)||!Number.isSafeInteger(d.version))return cosmeticsJson({error:'invalid_input'},400);const reason=cosmeticsText(d.reason,500);if(d.status==='rejected'&&!reason)return cosmeticsJson({error:'reason_required'},400);const row=await db.prepare('SELECT state_json,version FROM cosmetics_owner_state WHERE owner_id=?').bind(String(d.ownerId||'')).first();if(!row||row.version!==d.version)return cosmeticsJson({error:'review_stale'},409);const state=JSON.parse(row.state_json);if(d.status==='approved'&&(!state.store.name||!state.store.address||!/^07\d{9}$/.test(normalizePhone(state.store.phone))||!state.store.lat||!state.store.lng))return cosmeticsJson({error:'store_details_required'},400);const r=await db.prepare("UPDATE cosmetics_owner_state SET review_status=?,review_reason=?,reviewed_by=?,published_json=CASE WHEN ?='approved' THEN state_json ELSE published_json END WHERE owner_id=? AND version=? AND review_status='pending'").bind(d.status,reason,actor.id,d.status,d.ownerId,d.version).run();return r.meta.changes?cosmeticsJson({ok:true}):cosmeticsJson({error:'review_stale'},409);}
   }
   if(path==='/api/catalog/admin/cosmetics-orders'&&request.method==='GET'){if(!cosmeticsPermit(actor,'bookings'))return cosmeticsJson({error:'permission_denied'},403);const rows=(await db.prepare('SELECT * FROM cosmetics_orders ORDER BY created_at DESC LIMIT 200').all()).results;return cosmeticsJson({orders:rows.map(r=>cosmeticsOrder(r))});}
   return cosmeticsJson({error:'not_found'},404);
  }
  if(path.startsWith('/api/cosmetics/customer/')){
   const customer=await cosmeticsSession(request,env,'customer');if(!customer)return cosmeticsJson({error:'login_required'},401);
   if(path!=='/api/cosmetics/customer/orders')return cosmeticsJson({error:'not_found'},404);
   if(request.method==='GET'){const rows=(await db.prepare('SELECT * FROM cosmetics_orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 200').bind(customer.id).all()).results;return cosmeticsJson({orders:rows.map(r=>cosmeticsOrder(r))});}
   if(request.method==='POST'){
    const d=await cosmeticsInput(request);if(typeof d.ownerId!=='string'||!Array.isArray(d.items)||!d.items.length||d.items.length>30||!/^[-a-zA-Z0-9]{16,80}$/.test(d.requestKey||''))return cosmeticsJson({error:'invalid_order'},400);
    const address=cosmeticsText(d.address,500),phone=normalizePhone(d.phone||customer.phone),name=cosmeticsText(d.name||customer.name,100);if(!address||!name||!/^07\d{9}$/.test(phone)||d.paymentMethod!=='cash')return cosmeticsJson({error:'delivery_details_required'},400);
    const quantities=new Map();for(const item of d.items){if(!Number.isSafeInteger(item.id)||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>30)return cosmeticsJson({error:'invalid_order'},400);quantities.set(item.id,(quantities.get(item.id)||0)+item.quantity);if(quantities.get(item.id)>30)return cosmeticsJson({error:'invalid_order'},400);}
    const hash=asHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({ownerId:d.ownerId,items:[...quantities].sort((a,b)=>a[0]-b[0]),address,phone,name,paymentMethod:'cash',expectedTotal:d.expectedTotal}))));
    const prior=await db.prepare('SELECT id,request_hash,total FROM cosmetics_orders WHERE customer_id=? AND request_key=?').bind(customer.id,d.requestKey).first();if(prior)return prior.request_hash===hash?cosmeticsJson({id:prior.id,total:prior.total}):cosmeticsJson({error:'request_conflict'},409);
    if(!await cosmeticsLimit(db,customer.id,'order',40))return cosmeticsJson({error:'too_many_attempts'},429);
    const row=await db.prepare('SELECT state_json,published_json,version FROM cosmetics_owner_state WHERE owner_id=? AND published_json IS NOT NULL').bind(d.ownerId).first();if(!row)return cosmeticsJson({error:'store_unavailable'},409);const current=JSON.parse(row.state_json),published=JSON.parse(row.published_json);if(!published.store.active)return cosmeticsJson({error:'store_unavailable'},409);
    const items=[];let total=0;for(const [id,quantity] of quantities){const p=published.products.find(x=>x.id===id),live=current.products.find(x=>x.id===id);if(!p||!live||live.stock<quantity)return cosmeticsJson({error:'stock_unavailable'},409);items.push({id,name:p.name,price:p.price,quantity});total+=p.price*quantity;live.stock-=quantity;p.stock=live.stock;}
    if(!Number.isSafeInteger(total)||total!==d.expectedTotal)return cosmeticsJson({error:'quote_changed'},409);const now=new Date().toISOString();
    const results=await db.batch([
     db.prepare("INSERT INTO cosmetics_orders(owner_id,customer_id,request_key,request_hash,customer_name,phone,address,items_json,total,status,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,'pending',?,? FROM cosmetics_owner_state WHERE owner_id=? AND version=?").bind(d.ownerId,customer.id,d.requestKey,hash,name,phone,address,JSON.stringify(items),total,now,now,d.ownerId,row.version),
     db.prepare('UPDATE cosmetics_owner_state SET state_json=?,published_json=?,version=version+1 WHERE owner_id=? AND version=? AND EXISTS(SELECT 1 FROM cosmetics_orders WHERE customer_id=? AND request_key=?)').bind(JSON.stringify(current),JSON.stringify(published),d.ownerId,row.version,customer.id,d.requestKey)
    ]);
    if(!results[0].meta.changes)return cosmeticsJson({error:'order_conflict'},409);const order=await db.prepare('SELECT id FROM cosmetics_orders WHERE customer_id=? AND request_key=?').bind(customer.id,d.requestKey).first();return cosmeticsJson({id:order.id,total},201);
   }
   return cosmeticsJson({error:'method_not_allowed'},405);
  }
  const owner=await cosmeticsSession(request,env,'owner');if(!owner)return cosmeticsJson({error:'owner_required'},403);
  if(path==='/api/cosmetics/me'&&request.method==='GET')return cosmeticsJson({account:{id:owner.id,phone:owner.phone,name:owner.salonName,role:'cosmetics'}});
  if(path==='/api/cosmetics/logout'&&request.method==='POST')return env.SALONATI_API.fetch(new Request(new URL('/api/catalog/logout',request.url),request));
  if(path==='/api/cosmetics/state'){
   if(request.method==='GET'){const row=await db.prepare('SELECT * FROM cosmetics_owner_state WHERE owner_id=?').bind(owner.id).first();const rows=(await db.prepare('SELECT * FROM cosmetics_orders WHERE owner_id=? ORDER BY created_at DESC LIMIT 200').bind(owner.id).all()).results;return cosmeticsJson({state:{...(row?JSON.parse(row.state_json):cosmeticsEmpty(owner)),orders:rows.map(r=>cosmeticsOrder(r,['accepted','completed'].includes(r.status)))},version:row?.version||0,status:row?.review_status||'unsubmitted',reason:row?.review_reason||''});}
   if(request.method==='POST'){const d=await cosmeticsInput(request);if(!Number.isSafeInteger(d.version)||d.version<0)return cosmeticsJson({error:'invalid_input'},400);const state=cosmeticsState(d.state);const now=new Date().toISOString();let r;if(d.version===0){try{r=await db.prepare("INSERT INTO cosmetics_owner_state(owner_id,state_json,version,review_status,updated_at) VALUES(?,?,1,'pending',?)").bind(owner.id,JSON.stringify(state),now).run();}catch(e){if(/unique/i.test(e.message))return cosmeticsJson({error:'state_conflict'},409);throw e;}}else r=await db.prepare("UPDATE cosmetics_owner_state SET state_json=?,version=version+1,review_status='pending',review_reason='',updated_at=? WHERE owner_id=? AND version=?").bind(JSON.stringify(state),now,owner.id,d.version).run();return r.meta.changes?cosmeticsJson({version:d.version+1,status:'pending'}):cosmeticsJson({error:'state_conflict'},409);}
  }
  if(path==='/api/cosmetics/media'&&request.method==='POST'){
   if(!env.MEDIA)return cosmeticsJson({error:'media_unavailable'},503);if(!await cosmeticsLimit(db,owner.id,'media',30))return cosmeticsJson({error:'too_many_attempts'},429);const bytes=await cosmeticsBody(request,8388608),mime=request.headers.get('content-type')?.split(';')[0];const magic=(s,o=0)=>[...s].every((c,i)=>bytes[o+i]===c.charCodeAt(0));const valid=mime==='image/png'&&bytes[0]===137&&magic('PNG\r\n\x1a\n',1)||mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255||mime==='image/gif'&&(magic('GIF87a')||magic('GIF89a'))||mime==='image/webp'&&magic('RIFF')&&magic('WEBP',8)||mime==='video/mp4'&&magic('ftyp',4)||mime==='video/webm'&&bytes[0]===26&&bytes[1]===69&&bytes[2]===223&&bytes[3]===163;if(!valid)return cosmeticsJson({error:'invalid_image'},400);const id=crypto.randomUUID(),key='cosmetics/'+owner.id+'/'+id;await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});await db.prepare('INSERT INTO cosmetics_media(id,owner_id,object_key,mime,size) VALUES(?,?,?,?,?)').bind(id,owner.id,key,mime,bytes.length).run();return cosmeticsJson({id,url:'/api/cosmetics/media/'+id},201);
  }
  if(path==='/api/cosmetics/orders'&&request.method==='GET'){const rows=(await db.prepare('SELECT * FROM cosmetics_orders WHERE owner_id=? ORDER BY created_at DESC LIMIT 200').bind(owner.id).all()).results;return cosmeticsJson({orders:rows.map(r=>cosmeticsOrder(r,['accepted','completed'].includes(r.status)))});}
  if(path==='/api/cosmetics/orders/status'&&request.method==='POST'){
   const d=await cosmeticsInput(request);if(!Number.isSafeInteger(d.id)||!['accepted','rejected','completed'].includes(d.status))return cosmeticsJson({error:'invalid_input'},400);const order=await db.prepare('SELECT * FROM cosmetics_orders WHERE id=? AND owner_id=?').bind(d.id,owner.id).first();if(!order)return cosmeticsJson({error:'not_found'},404);if(order.status===d.status)return cosmeticsJson({ok:true});const from=d.status==='completed'?'accepted':'pending';if(order.status!==from)return cosmeticsJson({error:'order_conflict'},409);
   if(d.status==='rejected'){
    const row=await db.prepare('SELECT * FROM cosmetics_owner_state WHERE owner_id=?').bind(owner.id).first(),state=JSON.parse(row.state_json),published=row.published_json?JSON.parse(row.published_json):null;for(const item of JSON.parse(order.items_json)){const p=state.products.find(x=>x.id===item.id),q=published?.products.find(x=>x.id===item.id);if(p)p.stock+=item.quantity;if(q&&p)q.stock=p.stock;}const marker=crypto.randomUUID();const result=await db.batch([db.prepare("UPDATE cosmetics_orders SET status='rejected',updated_at=?,transition_key=? WHERE id=? AND owner_id=? AND status='pending' AND EXISTS(SELECT 1 FROM cosmetics_owner_state WHERE owner_id=? AND version=?)").bind(new Date().toISOString(),marker,d.id,owner.id,owner.id,row.version),db.prepare('UPDATE cosmetics_owner_state SET state_json=?,published_json=?,version=version+1 WHERE owner_id=? AND version=? AND EXISTS(SELECT 1 FROM cosmetics_orders WHERE id=? AND owner_id=? AND transition_key=?)').bind(JSON.stringify(state),published?JSON.stringify(published):null,owner.id,row.version,d.id,owner.id,marker)]);return result[0].meta.changes?cosmeticsJson({ok:true}):cosmeticsJson({error:'order_conflict'},409);
   }
   const r=await db.prepare('UPDATE cosmetics_orders SET status=?,updated_at=? WHERE id=? AND owner_id=? AND status=?').bind(d.status,new Date().toISOString(),d.id,owner.id,from).run();return r.meta.changes?cosmeticsJson({ok:true}):cosmeticsJson({error:'order_conflict'},409);
  }
  return cosmeticsJson({error:'not_found'},404);
 }catch(e){return cosmeticsJson({error:e.status?e.message:'service_unavailable'},e.status||503);}
}

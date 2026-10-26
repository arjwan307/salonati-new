function registrationView(r,origin){return {ownerId:r.owner_id,salonName:r.salon_name,area:r.area,email:r.email,contactName:r.contact_name,phone:r.phone,address:r.address,latitude:r.latitude,longitude:r.longitude,facadeMediaId:r.facade_media_id,facadeUrl:origin+'/api/catalog/media/'+r.facade_media_id,status:r.status,reason:r.reason,revision:r.revision,submittedAt:r.submitted_at,reviewedAt:r.reviewed_at}}
async function registrationRoutes(request,env,actor,url){const path=url.pathname,db=env.MODERATION_DB;
 if(path==='/api/catalog/registration'){
  if(actor.role!=='owner')return catalogJson({error:'owner_required'},403);
  if(request.method==='GET'){const row=await db.prepare('SELECT r.*,a.salon_name,a.area,a.email,a.latitude,a.longitude FROM catalog_registrations r JOIN catalog_accounts a ON a.id=r.owner_id WHERE owner_id=?').bind(actor.id).first();return catalogJson({registration:row?registrationView(row,url.origin):null})}
  if(request.method==='POST'){
   const d=await catalogJsonBody(request),name=String(d.salonName||'').trim(),area=String(d.area||'').trim(),contact=String(d.contactName||'').trim(),phone=String(d.phone||'').trim(),address=String(d.address||'').trim();
   if(!name||name.length>100||!area||area.length>100||!contact||contact.length>120||!/^\+?[0-9 ()-]{7,25}$/.test(phone)||!address||address.length>500||!Number.isFinite(d.latitude)||d.latitude< -90||d.latitude>90||!Number.isFinite(d.longitude)||d.longitude< -180||d.longitude>180)return catalogJson({error:'registration_details_required'},400);
   const media=await db.prepare("SELECT id FROM catalog_media WHERE id=? AND owner_id=? AND mime IN ('image/jpeg','image/png','image/webp','image/gif')").bind(d.facadeMediaId||'',actor.id).first();if(!media)return catalogJson({error:'facade_required'},400);
   const old=await db.prepare('SELECT status FROM catalog_registrations WHERE owner_id=?').bind(actor.id).first();if(old?.status==='approved')return catalogJson({error:'registration_already_approved'},409);
   const statements=[db.prepare("INSERT INTO catalog_registrations(owner_id,contact_name,phone,address,facade_media_id,status,submitted_at) VALUES(?,?,?,?,?,'pending',?) ON CONFLICT(owner_id) DO UPDATE SET contact_name=excluded.contact_name,phone=excluded.phone,address=excluded.address,facade_media_id=excluded.facade_media_id,status='pending',reason='',revision=catalog_registrations.revision+1,submitted_at=excluded.submitted_at,reviewed_at=NULL,reviewer=NULL WHERE catalog_registrations.status!='approved'").bind(actor.id,contact,phone,address,d.facadeMediaId,new Date().toISOString()),db.prepare("UPDATE catalog_accounts SET salon_name=?,area=?,latitude=?,longitude=? WHERE id=? AND EXISTS(SELECT 1 FROM catalog_registrations WHERE owner_id=? AND status='pending')").bind(name,area,d.latitude,d.longitude,actor.id,actor.id)];const results=await db.batch(statements);if(!results[0].meta.changes)return catalogJson({error:'registration_already_approved'},409);
   return catalogJson({status:'pending'},201);
  }
 }
 if(path==='/api/catalog/admin/registrations'&&request.method==='GET'){
  if(actor.role!=='admin')return catalogJson({error:'admin_required'},403);
  const rows=(await db.prepare('SELECT r.*,a.salon_name,a.area,a.email,a.latitude,a.longitude FROM catalog_registrations r JOIN catalog_accounts a ON a.id=r.owner_id ORDER BY r.submitted_at DESC').all()).results;
  return catalogJson({registrations:rows.map(r=>registrationView(r,url.origin))});
 }
 if(path==='/api/catalog/admin/registrations/review'&&request.method==='POST'){
  if(actor.role!=='admin')return catalogJson({error:'admin_required'},403);
  const d=await catalogJsonBody(request),reason=String(d.reason||'').trim();if(!['approve','reject'].includes(d.action)||!Number.isSafeInteger(d.revision)||d.revision<1||reason.length>500)return catalogJson({error:'invalid_action'},400);if(d.action==='reject'&&!reason)return catalogJson({error:'reason_required'},400);
  const status=d.action==='approve'?'approved':'rejected';const result=await db.prepare("UPDATE catalog_registrations SET status=?,reason=?,reviewed_at=?,reviewer=? WHERE owner_id=? AND revision=? AND status='pending' AND EXISTS(SELECT 1 FROM catalog_accounts a WHERE a.id=catalog_registrations.owner_id AND a.latitude BETWEEN -90 AND 90 AND a.longitude BETWEEN -180 AND 180)").bind(status,reason,new Date().toISOString(),actor.id,d.ownerId||'',d.revision).run();if(!result.meta.changes)return catalogJson({error:'review_stale'},409);return catalogJson({status});
 }
 return null;
}

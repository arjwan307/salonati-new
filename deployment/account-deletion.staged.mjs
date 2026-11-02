// Staged service only: deliberately not imported by any live route or scheduled worker.
// No production adapter/CLI is provided. Migration and production execution require approval.
const apps = new Set(['customer','salon','cosmetics']);
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const quote = name => '"'+name.replaceAll('"','""')+'"';
const blockers = (app,id) => app==='customer' ? [
 ['catalog_live_bookings','customer_id'],['cosmetics_orders','customer_id'],
 ['catalog_loyalty_rewards','customer_id'],['catalog_visit_ratings','customer_id']
] : [
 ['catalog_live_bookings','owner_id'],['cosmetics_orders','owner_id'],
 ['catalog_fee_agreements','owner_id'],['catalog_financial_events','owner_id'],
 ['catalog_admin_payments','owner_id'],['catalog_admin_expenses','owner_id'],
 ['catalog_cash_receipts','owner_id'],['catalog_admin_staff','account_id'],
 ['catalog_delivery_grants','account_id'],['catalog_source_links','owner_id']
];
export async function inspectDeletion(db,app,id,expectedSchema) {
 if(!apps.has(app)||! /^[a-zA-Z0-9-]{16,80}$/.test(id))throw Error('invalid_subject');
 const actual=(await db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'salonati_deletion_%' ORDER BY name").all()).results;
 if(JSON.stringify(actual)!==JSON.stringify(expectedSchema))throw Error('schema_review_required');
 const table=app==='customer'?'catalog_customer_accounts':'catalog_accounts';
 const account=await db.prepare(`SELECT id FROM ${table} WHERE id=?${app==='customer'?'':" AND role='owner'"}`).bind(id).first();
 if(!account)throw Error('account_not_found');
 const aliases=(await db.prepare('SELECT app FROM salonati_phone_identities WHERE account_id=?').bind(id).all()).results;
 if(aliases.length!==1||aliases[0].app!==app)throw Error('ambiguous_identity');
 const found=[];
 if(app!=='customer'){
  const shared=await db.prepare("SELECT COUNT(*) AS n FROM cosmetics_owner_state o JOIN (SELECT id,owner_id FROM cosmetics_media UNION ALL SELECT id,owner_id FROM catalog_media) m ON instr(o.state_json,m.id)>0 OR instr(COALESCE(o.published_json,''),m.id)>0 WHERE m.owner_id=? AND o.owner_id!=?").bind(id,id).first();
  if(shared.n)found.push({table:'cross_account_media_json',count:shared.n});
 }
 for(const [table,column] of blockers(app,id)) {
  const row=await db.prepare(`SELECT COUNT(*) AS n FROM ${quote(table)} WHERE ${quote(column)}=?`).bind(id).first();
  if(row.n)found.push({table,count:row.n});
 }
 // History is deliberately blocked, never silently purged or called anonymized.
 return {app,subjectHash:await hash(app+':'+id),blockers:found,policy:found.length?'retention_decision_required':'no_history'};
}
export async function deleteTestAccount(db,{app,id,expectedSchema,environment,approvalReference}) {
 if(environment!=='isolated-test'||!approvalReference)throw Error('isolated_test_only');
 if(!apps.has(app)||! /^[a-zA-Z0-9-]{16,80}$/.test(id))throw Error('invalid_subject');
 const previous=await db.prepare('SELECT id,state FROM salonati_deletion_jobs WHERE subject_hash=?').bind(await hash(app+':'+id)).first();if(previous)return previous;
 const plan=await inspectDeletion(db,app,id,expectedSchema);
 if(plan.blockers.length)throw Error('retention_decision_required');
 const existing=await db.prepare('SELECT id,state FROM salonati_deletion_jobs WHERE subject_hash=?').bind(plan.subjectHash).first();
 if(existing)return existing;
 const job=crypto.randomUUID(),writes=[];
 // Evaluate blockers again INSIDE the same transaction as the deletes.
 const terms=blockers(app,id).map(([t,c])=>`EXISTS(SELECT 1 FROM ${quote(t)} WHERE ${quote(c)}=?)`),params=blockers(app,id).map(()=>id);
 if(app!=='customer'){
  terms.push("EXISTS(SELECT 1 FROM cosmetics_owner_state o JOIN (SELECT id,owner_id FROM cosmetics_media UNION ALL SELECT id,owner_id FROM catalog_media) m ON instr(o.state_json,m.id)>0 OR instr(COALESCE(o.published_json,''),m.id)>0 WHERE m.owner_id=? AND o.owner_id!=?)");params.push(id,id);
 }
 const forbidden=terms.join(' OR ');
 writes.push(db.prepare(`INSERT INTO salonati_deletion_jobs(id,subject_hash,app,state,approval_reference) VALUES(?,?,?,CASE WHEN ${forbidden} THEN 'blocked' ELSE 'files_pending' END,?)`).bind(job,plan.subjectHash,app,...params,approvalReference));
 const del=(table,column='owner_id')=>writes.push(db.prepare(`DELETE FROM ${quote(table)} WHERE ${quote(column)}=?`).bind(id));
 if(app==='customer') {
  del('salonati_push_subscriptions','customer_id');del('catalog_customer_sessions','customer_id');del('catalog_guest_sessions','customer_id');
 } else {
  for(const table of ['catalog_media','cosmetics_media'])writes.push(db.prepare(`INSERT OR IGNORE INTO salonati_deletion_objects(job_id,object_key) SELECT ?,object_key FROM ${table} WHERE owner_id=? AND object_key NOT LIKE 'https://%'`).bind(job,id));
  del('catalog_sessions','account_id');
  // Revisions own foreign keys to their parent and media; remove leaves first.
  for(const t of ['catalog_services','catalog_products','catalog_advertisements'])writes.push(db.prepare(`UPDATE ${t} SET latest_revision=NULL,published_revision=NULL WHERE owner_id=?`).bind(id));
  writes.push(db.prepare('DELETE FROM catalog_audit WHERE actor_id=? OR revision_id IN (SELECT id FROM catalog_revisions WHERE owner_id=? UNION SELECT id FROM catalog_product_revisions WHERE owner_id=? UNION SELECT id FROM catalog_ad_revisions WHERE owner_id=?)').bind(id,id,id,id));
  for(const t of ['catalog_visual_services','catalog_loyalty_settings','catalog_revisions','catalog_product_revisions','catalog_ad_revisions','catalog_registrations','catalog_services','catalog_products','catalog_advertisements','catalog_team','catalog_booking_blocks','catalog_visual_salons','catalog_sample_owners','cosmetics_owner_state','catalog_media','cosmetics_media'])del(t);
  writes.push(db.prepare('DELETE FROM salonati_admin_account_controls WHERE app=? AND owner_id=?').bind(app,id));
 }
 writes.push(db.prepare('DELETE FROM salonati_phone_identities WHERE app=? AND account_id=?').bind(app,id));
 del(app==='customer'?'catalog_customer_accounts':'catalog_accounts','id');
 // D1 batch rolls back every statement on any FK, policy CHECK, or other failure.
 await db.batch(writes);
 return {id:job,state:'files_pending'};
}
export async function resumeDeletionFiles(db,media,jobId) {
 const job=await db.prepare('SELECT id,state FROM salonati_deletion_jobs WHERE id=?').bind(jobId).first();
 if(!job)throw Error('job_not_found');if(job.state==='complete')return {state:'complete'};
 const rows=(await db.prepare("SELECT object_key FROM salonati_deletion_objects WHERE job_id=? AND state='pending' LIMIT 50").bind(jobId).all()).results;
 for(const row of rows) {
  // Cross-table shared keys are retained, even after the owner's metadata is gone.
  const shared=await db.prepare('SELECT object_key FROM catalog_media WHERE object_key=? UNION ALL SELECT object_key FROM cosmetics_media WHERE object_key=? LIMIT 1').bind(row.object_key,row.object_key).first();
  if(shared){await db.prepare("UPDATE salonati_deletion_objects SET state='retained_shared' WHERE job_id=? AND object_key=?").bind(jobId,row.object_key).run();continue;}
  try {await media.delete(row.object_key);await db.prepare("UPDATE salonati_deletion_objects SET state='deleted',attempts=attempts+1 WHERE job_id=? AND object_key=?").bind(jobId,row.object_key).run();}
  catch {await db.prepare('UPDATE salonati_deletion_objects SET attempts=attempts+1 WHERE job_id=? AND object_key=?').bind(jobId,row.object_key).run();}
 }
 const pending=await db.prepare("SELECT COUNT(*) AS n FROM salonati_deletion_objects WHERE job_id=? AND state='pending'").bind(jobId).first();
 if(!pending.n)await db.prepare("UPDATE salonati_deletion_jobs SET state='complete',completed_at=CURRENT_TIMESTAMP WHERE id=?").bind(jobId).run();
 return {state:pending.n?'files_pending':'complete'};
}

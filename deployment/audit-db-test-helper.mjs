import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 sqlite.exec(readFileSync(new URL('../docs/audit-20261103/schema.sql',import.meta.url),'utf8'));
 const db={prepare(sql){let params=[];return {sql,bind(...p){params=p;return this;},async first(){return sqlite.prepare(sql).get(...params)||null;},async all(){return {results:sqlite.prepare(sql).all(...params)};},async run(){const r=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(r.changes)}};},execute(){const r=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(r.changes)}};}};},async batch(statements){sqlite.exec('BEGIN');try{const r=statements.map(q=>q.execute());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {sqlite,db};
}
export function owner(sqlite,id,app='salon',role='owner'){
 sqlite.prepare('INSERT INTO catalog_accounts(id,email,role,salt,digest) VALUES(?,?,?,?,?)').run(id,id+'@test.invalid',role,'test-salt','test-digest');
 sqlite.prepare('INSERT INTO salonati_phone_identities(app,phone,account_id) VALUES(?,?,?)').run(app,id,id);
}
export function customer(sqlite,id){sqlite.prepare('INSERT INTO catalog_customer_accounts VALUES(?,?,?,?,?,?,?)').run(id,id,'Test customer','07700000000','salt','digest','2026-11-03');sqlite.prepare('INSERT INTO salonati_phone_identities(app,phone,account_id) VALUES(?,?,?)').run('customer',id,id);}

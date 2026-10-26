import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));const out=process.argv[2]||'/tmp/salonati-pages';const template=fs.readFileSync(path.join(root,'server/pages-gateway.mjs'),'utf8');
for(const role of ['customer','salon','admin']){const dir=path.join(out,'salonati-'+role);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'_worker.js'),template.replace('__APP_ROLE__',JSON.stringify(role)));fs.writeFileSync(path.join(dir,'_routes.json'),JSON.stringify({version:1,include:['/*'],exclude:[]}));}
console.log(JSON.stringify({directory:out,branch:'new',backend:process.env.SALONATI_BACKEND||'salonati-api',apps:['salonati-customer','salonati-salon','salonati-admin']}));

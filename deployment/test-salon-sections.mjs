import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInContext} from 'node:vm';
const require=createRequire(process.env.SALONATI_JSDOM_PACKAGE||'/tmp/salonati-ui/package.json');const {JSDOM}=require('jsdom');
const source=await readFile('release/salon/owner-publishing.js','utf8'),end=source.indexOf('const mediaMarkup=');assert.ok(end>0);
const dom=new JSDOM('<main></main>',{runScripts:'outside-only'}),w=dom.window;
w.services=()=>'<input id="sname"><button id="saveServiceButton">حفظ</button>';w.edit=null;w.serviceCatFilter='all';
try{runInContext(source.slice(0,end)+'})();',dom.getInternalVMContext());for(const category of ['hijab','brides']){w.serviceCatFilter=category;w.document.querySelector('main').innerHTML=w.services();const select=w.document.getElementById('serviceCategory');assert.equal(select.value,category);assert.equal(select.querySelector('option[value="hijab"]').textContent,'قسم المحجبات');assert.equal(select.querySelector('option[value="brides"]').textContent,'قسم العرائس');}console.log('PASS: salon service dropdown includes both sections and preserves selected section');}finally{w.close();}

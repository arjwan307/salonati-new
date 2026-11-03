import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInContext} from 'node:vm';
const require=createRequire('/tmp/salonati-ui/package.json'),{JSDOM}=require('jsdom');
const dom=new JSDOM(await readFile('release/cosmetics/index.html','utf8'),{url:'https://salonati-cosmetics-clean.pages.dev',runScripts:'outside-only'}),w=dom.window,c=dom.getInternalVMContext(),stored=[];
const image='/api/cosmetics/media/11111111-1111-1111-1111-111111111111';
w.scrollTo=()=>{};w.setInterval=()=>0;w.fetch=async(input,options={})=>{const path=String(input);if(path.endsWith('/media'))return Response.json({url:image});if(path.endsWith('/state')&&options.method==='POST'){stored.push(JSON.parse(options.body));return Response.json({version:stored.length,status:'pending'});}return Response.json(path.endsWith('/state')?{state:{store:{name:'Cosmetics',active:true},products:[],offers:[],orders:[]},version:0,status:'unsubmitted'}:{orders:[]});};
try{
 runInContext(await readFile('release/cosmetics/cosmetics/owner/app.js','utf8'),c);await new Promise(r=>setImmediate(r));runInContext("page='products';render()",c);
 assert.equal(w.document.querySelectorAll('[name="productPlacement"]').length,3);w.document.querySelector('[value="management"]').checked=true;
 for(const [id,value] of [['pname','Lipstick'],['pprice','100'],['poldprice','200'],['pstock','2'],['pdesc','Beauty product']])w.document.getElementById(id).value=value;
 await w.uploadCosmeticsImage({target:{files:[new w.File(['synthetic'],'product.png',{type:'image/png'})]}});assert.equal(w.document.getElementById('pname').value,'Lipstick');assert.equal(w.document.querySelector('[name="productPlacement"][value="management"]').checked,true);
 await w.saveProductData();assert.deepEqual(stored[0].state.products[0].placements,['cosmetics','management']);assert.equal(stored[0].state.products[0].image,image);
 runInContext("page='offers';render()",c);assert.equal(w.document.querySelectorAll('[name="offerPlacement"]').length,3);w.document.querySelector('[name="offerPlacement"][value="cosmetics"]').checked=false;w.document.querySelector('[name="offerPlacement"][value="cosmetics-discounts"]').checked=true;w.document.getElementById('otitle').value='Beauty discount';w.cosmeticsOfferMedia={url:image,type:'image/png'};await w.saveOffer();assert.deepEqual(stored.at(-1).state.offers[0].placements,['cosmetics-discounts']);
 console.log('PASS: product and offer destinations are selected and saved; upload preserves form data and destination selections');
}finally{w.close();}

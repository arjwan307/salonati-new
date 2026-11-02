// Booking closures by salon, date and one service or all services.
(()=>{
const hoursStyle=document.createElement('style');hoursStyle.textContent="\n.salon-hours-page{--hours-ink:#422259;--hours-accent:#80509d;direction:rtl}\n.salon-hours-page>h2{margin-bottom:4px;color:var(--hours-ink)}\n.salon-hours-page .hours-intro{font-size:13px;color:#886e98;margin:0 0 22px;line-height:1.8}\n.salon-hours-page .card{border:1px solid #e7daef;border-radius:22px;background:linear-gradient(145deg,#fffefd,#fcf8ff);box-shadow:0 5px 18px #6941800c;padding:18px;margin:12px 0}\n.salon-hours-page .hours-day-card .between{align-items:center;gap:12px}\n.salon-hours-page .hours-day-card b{font-size:16px;color:var(--hours-ink)}\n.salon-hours-page .hours-day-card label.row{gap:7px;font-size:12px;color:#7d628d;flex-direction:row}\n.salon-hours-page input[type=checkbox]{accent-color:var(--hours-accent);cursor:pointer}\n.salon-hours-page .hours-day-card summary{font-size:13px;color:#81658f;padding-top:10px;line-height:1.8;cursor:pointer}\n.salon-hours-page .hours-day-card:has(.between input:not(:checked)){background:#f5f1f7}\n.salon-hours-page .hours-day-card:has(.between input:not(:checked)) summary{opacity:.5}\n.salon-hours-page .booking-closure-card{margin-top:24px;padding:20px 16px}\n.salon-hours-page .booking-closure-card h3{font-size:18px;color:var(--hours-ink);margin:0 0 20px}\n.salon-hours-page .booking-closure-card>label{display:block;font-size:12px;color:#82668f;margin:16px 0 7px;font-weight:600}\n.salon-hours-page select,.salon-hours-page input[type=date]{min-height:48px;width:100%;padding:10px 12px;border:1px solid #ddc9e8;border-radius:13px;background:#fff;color:var(--hours-ink);font:inherit;font-size:14px}\n.salon-hours-page select:focus,.salon-hours-page input[type=date]:focus{outline:2px solid #cfb3df;outline-offset:2px}\n.salon-hours-page .booking-closure-card>.small{font-size:12px;color:#8b7396;line-height:1.9;margin:16px 0}\n.salon-hours-page .booking-slot-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}\n.salon-hours-page .booking-slot-option{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;margin:0;padding:12px 3px;min-height:65px;border:1px solid #ded0e8;border-radius:14px;background:#faf7fc;color:#9c8ba7;font-size:14px;line-height:1.5;cursor:pointer;font-weight:650}\n.salon-hours-page .booking-slot-option input{position:absolute;opacity:0;width:1px;height:1px}\n.salon-hours-page .booking-slot-option:after{content:'مغلق';font-size:10px;font-weight:400;color:#aa97b2}\n.salon-hours-page .booking-slot-option:has(input:checked){background:linear-gradient(145deg,#f7edfc,#eee1f7);border-color:#ceb0e0;color:#65337e;box-shadow:inset 0 1px 0 #fff}\n.salon-hours-page .booking-slot-option:has(input:checked):after{content:'متاح ✓';color:#9871af}\n.salon-hours-page .booking-slot-option:focus-within{outline:2px solid var(--hours-accent);outline-offset:2px}\n.salon-hours-page>button.full{margin-top:18px;border-radius:16px;padding:14px;background:linear-gradient(130deg,#a16bb9,#71358f);color:#fff;box-shadow:0 5px 14px #794a9829}\n@media(max-width:340px){.salon-hours-page .booking-slot-grid{gap:6px}.salon-hours-page .booking-slot-option{font-size:12px}}\n";document.head.append(hoursStyle);
const slots=()=>Array.from({length:29},(_,i)=>{const m=480+i*30;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')});
const opt=v=>slots().map(t=>'<option value="'+t+'" '+(t===v?'selected':'')+'>'+formatHour12(t)+'</option>').join('');
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Baghdad'});
const owner=()=>String(window.SALONATI_ACCOUNT_ID||'');
let selectionDate=today(),selectionService='*',blocks=[],loaded=false,blockSaveQueue=Promise.resolve(),pendingBlockSaves=0,blockSaveMessage='جارٍ تحميل المواعيد من الخادم…';
const services=()=>Array.isArray(db?.services)?db.services.filter(s=>s.id&&s.active!==false&&s.publicationStatus!=='rejected'):[];
const scopeIds=value=>value.startsWith('group:')?services().filter(s=>s.name===decodeURIComponent(value.slice(6))).map(s=>String(s.id)):[value];
const duplicateNames=()=>[...new Set(services().map(s=>s.name))].filter(name=>services().filter(s=>s.name===name).length>1);
const scopeOptions=()=>duplicateNames().map(name=>{const value='group:'+encodeURIComponent(name);return '<option value="'+value+'" '+(selectionService===value?'selected':'')+'>جميع الخدمات باسم: '+esc(name)+'</option>';}).join('')+services().map(s=>{const same=services().filter(v=>v.name===s.name),label=esc(s.name)+(same.length>1?' — خدمة '+(same.findIndex(v=>v.id===s.id)+1):'');return '<option value="'+esc(s.id)+'" '+(selectionService===String(s.id)?'selected':'')+'>'+label+'</option>';}).join('');
const filtered=()=>{const ids=scopeIds(selectionService);return new Set(slots().filter(time=>ids.every(id=>blocks.some(b=>b.date===selectionDate&&b.time===time&&b.serviceId===id))));};
async function saveScope(date,value,times){const ids=scopeIds(value);if(!ids.length)throw Error('service_unavailable');const payload=ids.length>1?{date,serviceIds:ids,times}:{date,serviceId:ids[0],times};const r=await fetch('/api/booking/blocks',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw Error('save_failed');blocks=blocks.filter(b=>!(b.date===date&&ids.includes(b.serviceId))).concat(ids.flatMap(serviceId=>times.map(time=>({date,time,serviceId}))));}

const slotMarkup=()=>{const disabled=filtered();return '<div class="card booking-closure-card"><h3>إتاحة مواعيد الحجز</h3><label>تاريخ الحجز</label><input type="date" id="bookingSlotDate" value="'+esc(selectionDate)+'" onchange="window.redrawBookingSlots()"><label>تطبيق الإغلاق على</label><select id="bookingServiceScope" onchange="window.redrawBookingSlots()"><option value="*">جميع الخدمات</option>'+scopeOptions()+'</select><p class="small">اختاري الأوقات المتاحة للحجز. أزيلي التحديد لإغلاق الموعد للخدمة المختارة. اضغطي على الوقت المغلق لإعادته متاحًا. تُحفظ التغييرات فورًا.</p><p id="bookingSlotSaveStatus" role="status" aria-live="polite">'+esc(blockSaveMessage)+'</p><div class="booking-slot-grid">'+slots().map(t=>'<label class="booking-slot-option"><input type="checkbox" data-booking-slot="'+t+'" '+(!disabled.has(t)?'checked':'')+' '+(!loaded?'disabled':'')+'> '+formatHour12(t)+'</label>').join('')+'</div></div>'};
window.redrawBookingSlots=()=>{selectionDate=document.getElementById('bookingSlotDate')?.value||selectionDate;selectionService=document.getElementById('bookingServiceScope')?.value||'*';const el=document.getElementById('bookingSlots');if(el)el.innerHTML=slotMarkup()};
function blockSaveStatus(message){blockSaveMessage=message;const status=document.getElementById('bookingSlotSaveStatus');if(status)status.textContent=message;for(const id of ['bookingSlotDate','bookingServiceScope']){const el=document.getElementById(id);if(el)el.disabled=pendingBlockSaves>0;}}
document.addEventListener('change',event=>{
 if(!event.target.matches?.('[data-booking-slot]')||!loaded)return;
 const reopening=event.target.checked;
 const date=document.getElementById('bookingSlotDate')?.value||selectionDate,serviceId=document.getElementById('bookingServiceScope')?.value||'*',times=[...document.querySelectorAll('[data-booking-slot]')].filter(el=>!el.checked).map(el=>el.dataset.bookingSlot);
 pendingBlockSaves++;blockSaveStatus('جارٍ حفظ تغيير الموعد…');
 blockSaveQueue=blockSaveQueue.catch(()=>{}).then(async()=>{
  await saveScope(date,serviceId,times);
 }).then(()=>{pendingBlockSaves--;blockSaveStatus(pendingBlockSaves?'جارٍ حفظ بقية التغييرات…':reopening?'تم فتح الموعد؛ متاح للحجز الآن.':'تم إغلاق الموعد للخدمات المحددة.');},()=>{pendingBlockSaves--;blockSaveStatus('لم يُحفظ التغيير. تحققي من الاتصال وأعيدي المحاولة.');if(!pendingBlockSaves){window.redrawBookingSlots();toast('تعذر حفظ تغيير الموعد؛ أُعيدت الحالة المحفوظة.');}});
});
async function refreshBlocks(){
 const id=owner();if(!/^[a-zA-Z0-9-]{16,80}$/.test(id))return;
 try{const r=await fetch('/api/booking/blocks?ownerId='+encodeURIComponent(id),{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error('load_failed');const d=await r.json();blocks=Array.isArray(d.blocks)?d.blocks:[];loaded=true;blockSaveMessage='الأوقات محدّثة. كل تغيير يُحفظ تلقائيًا.';window.redrawBookingSlots()}catch{toast('تعذر تحميل الأوقات المغلقة من السيرفر')}
}
hours=()=>'<section class="salon-hours-page"><h2>أوقات العمل</h2><p class="hours-intro">نظّمي أيام العمل والمواعيد المتاحة لزبوناتكِ</p>'+db.hours.map((h,i)=>'<div class="card hours-day-card"><div class="between"><b>'+esc(h.day)+'</b><label class="row" style="margin:0"><input type="checkbox" style="width:18px" id="enabled'+i+'" '+(h.enabled?'checked':'')+'> مفتوح</label></div><details><summary>من '+formatHour12(h.open)+' إلى '+formatHour12(h.close)+'</summary><div class="two"><div><label>من</label><select id="from'+i+'">'+opt(h.open)+'</select></div><div><label>إلى</label><select id="to'+i+'">'+opt(h.close)+'</select></div></div></details></div>').join('')+'<div id="bookingSlots">'+slotMarkup()+'</div>'+button('حفظ أوقات العمل','saveHours()','full')+'</section>';
saveHours=async()=>{
 if(!loaded){toast('انتظري تحميل الأوقات من الخادم قبل الحفظ');return;}
 await blockSaveQueue;
 const day=document.getElementById('bookingSlotDate')?.value||selectionDate,serviceId=document.getElementById('bookingServiceScope')?.value||'*';
 const arr=db.hours.map((h,i)=>({...h,enabled:document.getElementById('enabled'+i).checked,open:val('from'+i),close:val('to'+i)}));
 if(arr.some(h=>h.enabled&&h.open>=h.close)){toast('وقت الإغلاق يجب أن يكون بعد الافتتاح');return}
 const times=[...document.querySelectorAll('[data-booking-slot]')].filter(e=>!e.checked).map(e=>e.dataset.bookingSlot);
 try{
  await saveScope(day,serviceId,times);
  db.hours=arr;save();toast('تم حفظ الأوقات المغلقة لدى السيرفر والزبونة');
 }catch(e){toast('لم تُحفظ الإغلاقات: '+e.message)}
};
const priorRender=render;
render=function(){
 priorRender();
 if(page!=='hours')return;
 const main=document.getElementById('main');
 if(!main)return;
 if(!main.querySelector('#bookingSlots')){
  const panel=document.createElement('div');
  panel.id='bookingSlots';
  panel.innerHTML=slotMarkup();
  main.append(panel);
 }
};
const oldGo=go;
go=function(page){const result=oldGo.apply(this,arguments);if(page==='hours')void refreshBlocks();return result};
setTimeout(()=>{if(document.getElementById('bookingSlots'))void refreshBlocks()},1000);
})();



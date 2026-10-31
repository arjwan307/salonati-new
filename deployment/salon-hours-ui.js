// Booking closures by salon, date and one service or all services.
(()=>{
const slots=()=>Array.from({length:29},(_,i)=>{const m=480+i*30;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')});
const opt=v=>slots().map(t=>'<option value="'+t+'" '+(t===v?'selected':'')+'>'+formatHour12(t)+'</option>').join('');
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Baghdad'});
const owner=()=>String(window.SALONATI_ACCOUNT_ID||'');
let selectionDate=today(),selectionService='*',blocks=[],loaded=false;
const services=()=>Array.isArray(db?.services)?db.services.filter(s=>s.id&&s.publicationStatus==='approved'):[];
const filtered=()=>new Set(blocks.filter(b=>b.date===selectionDate&&b.serviceId===selectionService).map(b=>b.time));
const slotMarkup=()=>{const disabled=filtered();return '<div class="card"><h3>إيقاف أوقات الحجز</h3><label>تاريخ الحجز</label><input type="date" id="bookingSlotDate" value="'+esc(selectionDate)+'" onchange="window.redrawBookingSlots()"><label>تطبيق الإغلاق على</label><select id="bookingServiceScope" onchange="window.redrawBookingSlots()"><option value="*">جميع الخدمات</option>'+services().map(s=>'<option value="'+esc(s.id)+'" '+(selectionService===String(s.id)?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select><p class="small">إزالة علامة التأشير تغلق الوقت في تطبيق الزبونة للخدمة المحددة فقط، أو لكل الخدمات.</p><div class="two">'+slots().map(t=>'<label class="row" style="margin:0"><input type="checkbox" style="width:18px" data-booking-slot="'+t+'" '+(!disabled.has(t)?'checked':'')+'> '+formatHour12(t)+'</label>').join('')+'</div></div>'};
window.redrawBookingSlots=()=>{selectionDate=document.getElementById('bookingSlotDate')?.value||selectionDate;selectionService=document.getElementById('bookingServiceScope')?.value||'*';const el=document.getElementById('bookingSlots');if(el)el.innerHTML=slotMarkup()};
async function refreshBlocks(){
 const id=owner();if(!/^[a-zA-Z0-9-]{16,80}$/.test(id))return;
 try{const r=await fetch('/api/booking/blocks?ownerId='+encodeURIComponent(id),{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error('load_failed');const d=await r.json();blocks=Array.isArray(d.blocks)?d.blocks:[];loaded=true;window.redrawBookingSlots()}catch{toast('تعذر تحميل الأوقات المغلقة من السيرفر')}
}
hours=()=>'<h2>أوقات العمل</h2>'+db.hours.map((h,i)=>'<div class="card"><div class="between"><b>'+esc(h.day)+'</b><label class="row" style="margin:0"><input type="checkbox" style="width:18px" id="enabled'+i+'" '+(h.enabled?'checked':'')+'> مفتوح</label></div><details><summary>من '+formatHour12(h.open)+' إلى '+formatHour12(h.close)+'</summary><div class="two"><div><label>من</label><select id="from'+i+'">'+opt(h.open)+'</select></div><div><label>إلى</label><select id="to'+i+'">'+opt(h.close)+'</select></div></div></details></div>').join('')+'<div id="bookingSlots">'+slotMarkup()+'</div>'+button('حفظ أوقات العمل','saveHours()','full');
saveHours=async()=>{
 const day=document.getElementById('bookingSlotDate')?.value||selectionDate,serviceId=document.getElementById('bookingServiceScope')?.value||'*';
 const arr=db.hours.map((h,i)=>({...h,enabled:document.getElementById('enabled'+i).checked,open:val('from'+i),close:val('to'+i)}));
 if(arr.some(h=>h.enabled&&h.open>=h.close)){toast('وقت الإغلاق يجب أن يكون بعد الافتتاح');return}
 const times=[...document.querySelectorAll('[data-booking-slot]')].filter(e=>!e.checked).map(e=>e.dataset.bookingSlot);
 try{
  const r=await fetch('/api/booking/blocks',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:day,serviceId,times})});
  if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||'save_failed');
  blocks=blocks.filter(b=>!(b.date===day&&b.serviceId===serviceId)).concat(times.map(time=>({date:day,time,serviceId})));
  db.hours=arr;save();toast('تم حفظ الأوقات المغلقة لدى السيرفر والزبونة');
 }catch(e){toast('لم تُحفظ الإغلاقات: '+e.message)}
};
const oldGo=go;
go=function(page){const result=oldGo.apply(this,arguments);if(page==='hours')void refreshBlocks();return result};
setTimeout(()=>{if(document.getElementById('bookingSlots'))void refreshBlocks()},1000);
})();

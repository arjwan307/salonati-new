const KEY = 'salonati-owner-v2';

const initial = {
  salon: {
    name: 'صالون لؤلؤة بغداد',
    area: 'الكرادة',
    address: 'بغداد، الكرادة',
    phone: '07700000000',
    about: 'جمالُك يبدأ من هنا',
    lat: '33.302',
    lng: '44.432',
    open: true
  },
  services: [
    { id: 1, name: 'قص وتصفيف الشعر', price: 25000, minutes: 60, active: true },
    { id: 2, name: 'صبغ الشعر', price: 60000, minutes: 90, active: true },
    { id: 3, name: 'مناكير جل', price: 15000, minutes: 45, active: true },
    { id: 4, name: 'عناية بالوجه', price: 50000, minutes: 60, active: true }
  ],
  bookings: [
    {
      id: 1001,
      name: 'سارة أحمد',
      phone: '07712345678',
      services: [1, 3],
      date: '2026-10-23',
      time: '11:30',
      status: 'pending',
      notes: 'أرغب بموعد صباحي'
    },
    {
      id: 1002,
      name: 'نور علي',
      phone: '07812345678',
      services: [2],
      date: '2026-10-24',
      time: '14:00',
      status: 'accepted',
      notes: ''
    }
  ],
  products: [
    { id: 1, name: 'زيت ترطيب الشعر', price: 18000, stock: 8, description: 'منتج للعناية بالشعر' }
  ],
  staff: [
    { id: 1, name: 'زينب', role: 'تصفيف الشعر' },
    { id: 2, name: 'رنا', role: 'العناية بالبشرة' }
  ],
  hours: [
    { day: 'السبت', open: '10:00', close: '20:00', enabled: true },
    { day: 'الأحد', open: '10:00', close: '20:00', enabled: true },
    { day: 'الاثنين', open: '10:00', close: '20:00', enabled: true },
    { day: 'الثلاثاء', open: '10:00', close: '20:00', enabled: true },
    { day: 'الأربعاء', open: '10:00', close: '20:00', enabled: true },
    { day: 'الخميس', open: '10:00', close: '21:00', enabled: true },
    { day: 'الجمعة', open: '12:00', close: '19:00', enabled: false }
  ],
  photos: [],
  blocked: []
};

let db;
try {
  db = JSON.parse(localStorage.getItem(KEY)) || structuredClone(initial);
} catch (e) {
  db = JSON.parse(JSON.stringify(initial));
}

const save = () => {
  localStorage.setItem(KEY, JSON.stringify(db));
  render();
};

const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

const fmt = n => Number(n || 0).toLocaleString('en-US') + ' د.ع';
const val = id => document.getElementById(id)?.value?.trim();
const id = () => Date.now();

const status = {
  pending: 'بانتظار الموافقة',
  accepted: 'مقبول',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
  completed: 'مكتمل'
};

const tabs = [
  ['home', 'الرئيسية', '⌂'],
  ['bookings', 'الحجوزات', '▦'],
  ['services', 'الخدمات', '✂'],
  ['products', 'المنتجات', '▣'],
  ['more', 'المزيد', '☰']
];

let page = 'home';
let filter = 'all';
let edit = null;

function toast(s) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = s;
  t.style.display = 'block';
  setTimeout(() => {
    t.style.display = 'none';
  }, 2600);
}

function button(label, fn, cls = 'secondary') {
  return `<button class="${cls}" onclick="${fn}">${label}</button>`;
}

function booking(b) {
  const ss = b.services.map(i => db.services.find(s => s.id == i)?.name || 'خدمة محذوفة').join(' + ');
  const sum = b.services.reduce((n, i) => n + (db.services.find(s => s.id == i)?.price || 0), 0);
  return `<div class="card"><div class="between"><h3>${esc(b.name)}</h3><span class="tag ${b.status === 'accepted' ? 'ok' : b.status === 'rejected' ? 'no' : ''}">${status[b.status]}</span></div><div class="muted">${esc(ss)}</div><p>📅 ${esc(b.date)} &nbsp; 🕒 ${esc(b.time)}</p><div class="between"><b class="money">${fmt(sum)}</b><small>طلب #${b.id}</small></div>${b.notes ? `<p class="muted">ملاحظة: ${esc(b.notes)}</p>` : ''}${b.status === 'pending' ? `<div class="notice">رقم الهاتف مخفي حتى قبول الحجز.</div><div class="actions">${button('قبول', 'changeBooking(' + b.id + ', "accepted")', '')}${button('رفض', 'changeBooking(' + b.id + ', "rejected")', 'danger')}</div>` : `<div class="actions">${b.status === 'accepted' ? `<span>📞 ${esc(b.phone)}</span>${button('مكتمل', 'changeBooking(' + b.id + ', "completed")', '')}` : ''}</div>`}</div>`;
}

function home() {
  const pend = db.bookings.filter(x => x.status === 'pending');
  return `<div class="hero"><div class="between"><div><small>أهلاً بك في إدارة صالونك</small><p><strong>${esc(db.salon.name)}</strong></p><small>📍 ${esc(db.salon.area)}</small></div><span class="tag ${db.salon.open ? 'ok' : 'no'}">${db.salon.open ? 'يستقبل الحجوزات' : 'الحجوزات متوقفة'}</span></div></div><div class="stats"><div class="stat"><small>بانتظار الرد</small><b>${pend.length}</b></div><div class="stat"><small>المقبولة</small><b>${db.bookings.filter(x => x.status === 'accepted').length}</b></div><div class="stat"><small>الخدمات</small><b>${db.services.filter(x => x.active).length}</b></div></div><h2>طلبات الحجز الجديدة</h2>${pend.length ? pend.map(booking).join('') : '<div class="empty">لا توجد طلبات جديدة</div>'}<div class="notice">هذه نسخة تجريبية: الحجوزات محفوظة على هذا الجهاز فقط. ربط الزبونة بالصالون والإشعارات يحتاج قاعدة بيانات وخادماً مشتركاً.</div>`;
}

function bookings() {
  const a = filter === 'all' ? db.bookings : db.bookings.filter(x => x.status === filter);
  return `<h2>إدارة الحجوزات</h2><div class="tabs">${[['all', 'الكل'], ['pending', 'الجديدة'], ['accepted', 'المقبولة'], ['completed', 'المكتملة'], ['rejected', 'المرفوضة']].map(([k, v]) => button(v, `setFilter('${k}')`, filter === k ? '' : 'secondary')).join('')}</div>${a.length ? a.slice().reverse().map(booking).join('') : '<div class="empty">لا توجد حجوزات بهذا التصنيف</div>'}<h2>إضافة حجز يدوي</h2><div class="card"><label>اسم الزبونة</label><input id="bname" placeholder="اسم الزبونة"><label>الهاتف</label><input id="bphone" inputmode="tel" placeholder="07..."><label>الخدمات</label><select id="bservice">${db.services.filter(x => x.active).map(x => `<option value="${x.id}">${esc(x.name)} — ${fmt(x.price)}</option>`).join('')}</select><div class="two"><div><label>التاريخ</label><input id="bdate" type="date"></div><div><label>الوقت</label><input id="btime" type="time"></div></div><div class="actions">${button('حفظ الحجز', 'addBooking()', '')}</div></div>`;
}

function services() {
  return `<h2>الخدمات والأسعار</h2>${db.services.map(s => `<div class="card"><div class="between"><div><h3>${esc(s.name)}</h3><small>${s.minutes} دقيقة • <b class="money">${fmt(s.price)}</b></small></div><span class="tag ${s.active ? 'ok' : 'no'}">${s.active ? 'متاحة' : 'مخفية'}</span></div><div class="actions">${button('تعديل', `editService(${s.id})`)}${button(s.active ? 'إخفاء' : 'إظهار', `toggleService(${s.id})`)}${button('حذف', `deleteService(${s.id})`, 'danger')}</div></div>`).join('')}<h2>${edit?.kind === 'service' ? 'تعديل الخدمة' : 'إضافة خدمة'}</h2><div class="card"><label>اسم الخدمة</label><input id="sname" value="${esc(edit?.kind === 'service' ? edit.obj.name : '')}" placeholder="اسم الخدمة"><div class="two"><div><label>السعر بالدينار</label><input id="sprice" type="number" min="0" value="${edit?.kind === 'service' ? edit.obj.price : ''}"></div><div><label>المدة بالدقائق</label><input id="sminutes" type="number" min="1" value="${edit?.kind === 'service' ? edit.obj.minutes : 60}"></div></div><div class="actions">${button('حفظ الخدمة', 'saveService()', '')}${edit ? button('إلغاء', 'clearEdit()') : ''}</div></div>`;
}

function products() {
  return `<h2>منتجات الصالون</h2>${db.products.map(p => `<div class="card"><div class="between"><div><h3>${esc(p.name)}</h3><small>${esc(p.description)}</small><p class="money">${fmt(p.price)} • الكمية ${p.stock}</p></div><div class="actions">${button('تعديل', `editProduct(${p.id})`)}${button('حذف', `deleteProduct(${p.id})`, 'danger')}</div></div></div>`).join('')}<h2>${edit?.kind === 'product' ? 'تعديل منتج' : 'إضافة منتج'}</h2><div class="card"><label>اسم المنتج</label><input id="pname" value="${esc(edit?.kind === 'product' ? edit.obj.name : '')}"><label>الوصف</label><textarea id="pdesc">${esc(edit?.kind === 'product' ? edit.obj.description : '')}</textarea><div class="two"><div><label>السعر</label><input id="pprice" type="number" min="0" value="${edit?.kind === 'product' ? edit.obj.price : ''}"></div><div><label>الكمية</label><input id="pstock" type="number" min="0" value="${edit?.kind === 'product' ? edit.obj.stock : 0}"></div></div>${button('حفظ المنتج', 'saveProduct()', '')}</div>`;
}

function more() {
  return `<h2>بيانات الصالون</h2><div class="card"><label>اسم الصالون</label><input id="name" value="${esc(db.salon.name)}"><label>المنطقة</label><input id="area" value="${esc(db.salon.area)}"><label>العنوان</label><input id="address" value="${esc(db.salon.address)}"><label>هاتف الصالون</label><input id="phone" value="${esc(db.salon.phone)}"><label>نبذة</label><textarea id="about">${esc(db.salon.about)}</textarea><div class="two"><div><label>خط العرض</label><input id="lat" value="${esc(db.salon.lat)}"></div><div><label>خط الطول</label><input id="lng" value="${esc(db.salon.lng)}"></div></div><div class="switch"><span>استقبال حجوزات جديدة</span><input id="open" type="checkbox" ${db.salon.open ? 'checked' : ''}></div>${button('حفظ بيانات الصالون', 'saveSalon()', '')}</div><h2>أوقات الدوام</h2>${db.hours.map((h, i) => `<div class="card"><div class="between"><b>${h.day}</b><label class="row" style="margin:0"><input style="width:18px" type="checkbox" id="enabled${i}" ${h.enabled ? 'checked' : ''}> مفتوح</label></div><div class="two"><div><label>من</label><input type="time" id="from${i}" value="${h.open}"></div><div><label>إلى</label><input type="time" id="to${i}" value="${h.close}"></div></div></div>`).join('')}${button('حفظ أوقات الدوام', 'saveHours()', 'full')}<h2>فريق العمل</h2>${db.staff.map(x => `<div class="card between"><div><b>${esc(x.name)}</b><p class="muted">${esc(x.role)}</p></div>${button('حذف', `deleteStaff(${x.id})`, 'danger')}</div>`).join('')}<div class="card"><label>اسم الموظفة</label><input id="staffName"><label>الاختصاص</label><input id="staffRole">${button('إضافة موظفة', 'addStaff()', '')}</div><h2>معرض صور الصالون</h2><div class="notice">يمكن إضافة صور من الجهاز. تُحفظ محلياً في المتصفح؛ للنشر التجاري تُرفع إلى تخزين سحابي.</div>${db.photos.map((src, i) => `<div class="card"><img class="imagepreview" src="${src}" alt="صورة الصالون">${button('حذف الصورة', `deletePhoto(${i})`, 'danger')}</div>`).join('')}<div class="card"><input type="file" id="photo" accept="image/*"><div class="actions">${button('إضافة الصورة', 'addPhoto()', '')}</div></div><h2>البيانات التجريبية</h2><div class="card">${button('تصدير نسخة احتياطية JSON', 'backup()')}<label>استعادة نسخة احتياطية</label><input type="file" id="restore" accept=".json,application/json"><div class="actions">${button('استعادة', 'restoreData()')}</div></div>`;
}

function render() {
  const titleEl = document.getElementById('salonTitle');
  if (titleEl) titleEl.textContent = db.salon.name;
  const mainEl = document.getElementById('main');
  if (mainEl) mainEl.innerHTML = ({ home, bookings, services, products, more })[page]();
  const navEl = document.getElementById('nav');
  if (navEl) navEl.innerHTML = tabs.map(([k, n, ic]) => `<button class="${page === k ? 'active' : ''}" onclick="go('${k}')"><span>${ic}</span>${n}</button>`).join('');
}

function go(x) {
  page = x;
  edit = null;
  render();
  scrollTo(0, 0);
}

function setFilter(x) {
  filter = x;
  render();
}

function clearEdit() {
  edit = null;
  render();
}

function changeBooking(i, s) {
  const b = db.bookings.find(x => x.id === i);
  if (!b) return;
  b.status = s;
  save();
  toast('تم تحديث حالة الحجز');
}

function addBooking() {
  if (!val('bname') || !val('bdate') || !val('btime')) return toast('أكملي الاسم والتاريخ والوقت');
  db.bookings.push({
    id: id(),
    name: val('bname'),
    phone: val('bphone'),
    services: [Number(val('bservice'))],
    date: val('bdate'),
    time: val('btime'),
    status: 'accepted',
    notes: ''
  });
  save();
  toast('تمت إضافة الحجز');
}

function editService(i) {
  edit = { kind: 'service', obj: db.services.find(x => x.id === i) };
  render();
  document.getElementById('sname')?.scrollIntoView({ behavior: 'smooth' });
}

function saveService() {
  const name = val('sname');
  const price = Number(val('sprice'));
  const minutes = Number(val('sminutes'));
  if (!name || !Number.isFinite(price) || price < 0 || !minutes || minutes < 1) return toast('أدخلي بيانات خدمة صحيحة');
  if (edit?.kind === 'service') Object.assign(edit.obj, { name, price, minutes });
  else db.services.push({ id: id(), name, price, minutes, active: true });
  edit = null;
  save();
  toast('تم حفظ الخدمة');
}

function toggleService(i) {
  const s = db.services.find(x => x.id === i);
  if (!s) return;
  s.active = !s.active;
  save();
}

function deleteService(i) {
  db.services = db.services.filter(x => x.id !== i);
  save();
  toast('تم حذف الخدمة');
}

function editProduct(i) {
  edit = { kind: 'product', obj: db.products.find(x => x.id === i) };
  render();
  document.getElementById('pname')?.scrollIntoView({ behavior: 'smooth' });
}

function saveProduct() {
  const name = val('pname');
  const price = Number(val('pprice'));
  const stock = Number(val('pstock'));
  if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) return toast('تحققي من بيانات المنتج');
  const o = { name, price, stock, description: val('pdesc') };
  if (edit?.kind === 'product') Object.assign(edit.obj, o);
  else db.products.push({ id: id(), ...o });
  edit = null;
  save();
  toast('تم حفظ المنتج');
}

function deleteProduct(i) {
  db.products = db.products.filter(x => x.id !== i);
  save();
  toast('تم حذف المنتج');
}

function saveSalon() {
  for (const k of ['name', 'area', 'address', 'phone', 'about', 'lat', 'lng']) {
    db.salon[k] = val(k);
  }
  db.salon.open = document.getElementById('open').checked;
  save();
  toast('تم حفظ بيانات الصالون');
}

function saveHours() {
  db.hours.forEach((h, i) => {
    h.enabled = document.getElementById('enabled' + i).checked;
    h.open = val('from' + i);
    h.close = val('to' + i);
  });
  save();
  toast('تم حفظ الدوام');
}

function addStaff() {
  if (!val('staffName')) return toast('أدخلي الاسم');
  db.staff.push({ id: id(), name: val('staffName'), role: val('staffRole') });
  save();
  toast('تمت إضافة الموظفة');
}

function deleteStaff(i) {
  db.staff = db.staff.filter(x => x.id !== i);
  save();
}

function deletePhoto(i) {
  db.photos.splice(i, 1);
  save();
}

function addPhoto() {
  const f = document.getElementById('photo')?.files[0];
  if (!f) return toast('اختاري صورة');
  if (f.size > 750000) return toast('اختاري صورة أصغر من 750 كيلوبايت');
  const r = new FileReader();
  r.onload = () => {
    db.photos.push(r.result);
    try {
      save();
    } catch (e) {
      db.photos.pop();
      toast('مساحة التخزين المحلي ممتلئة');
    }
  };
  r.readAsDataURL(f);
}

function backup() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
  a.download = 'salonati-owner-backup.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function restoreData() {
  const f = document.getElementById('restore')?.files[0];
  if (!f) return toast('اختاري ملف JSON');
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d.salon || !Array.isArray(d.services) || !Array.isArray(d.bookings)) throw Error();
      db = d;
      save();
      toast('تمت استعادة البيانات بنجاح');
    } catch (e) {
      toast('ملف النسخة الاحتياطية غير صالح');
    }
  };
  r.readAsText(f);
}

Object.assign(window, {
  go,
  setFilter,
  clearEdit,
  changeBooking,
  addBooking,
  editService,
  saveService,
  toggleService,
  deleteService,
  editProduct,
  saveProduct,
  deleteProduct,
  saveSalon,
  saveHours,
  addStaff,
  deleteStaff,
  deletePhoto,
  addPhoto,
  backup,
  restoreData
});

render();

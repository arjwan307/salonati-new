const KEY = 'salonati-cosmetics-owner-v2';
const catNames = {
  makeup: 'المكياج',
  skincare: 'العناية بالبشرة',
  perfumes: 'العطور',
  hair: 'العناية بالشعر',
  accessories: 'الإكسسوارات'
};

const timeSlots12h = [
  '8:00 ص', '9:00 ص', '10:00 ص', '11:00 ص', '12:00 م',
  '1:00 م', '2:00 م', '3:00 م', '4:00 م', '5:00 م',
  '6:00 م', '7:00 م', '8:00 م', '9:00 م', '10:00 م'
];

const initial = {
  store: {
    name: 'روز كوزمتك',
    area: 'الكرادة',
    address: 'بغداد، الكرادة داخل',
    phone: '07700000000',
    openTime: '8:00 ص',
    closeTime: '10:00 م',
    about: 'أرقى مستحضرات التجميل والعطور العالمية الأصلية',
    lat: '33.3128',
    lng: '44.4322',
    active: true
  },
  products: [
    {
      id: 1,
      name: 'حمره مات ثابتة ممتدة الثبات',
      price: 18000,
      oldPrice: 28000,
      stock: 15,
      category: 'makeup',
      description: 'ألوان جذابة تدوم طوال اليوم دون جفاف الشفاه',
      image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400&q=80'
    },
    {
      id: 2,
      name: 'سيروم فيتامين سي للبشرة النضرة',
      price: 28000,
      oldPrice: 42000,
      stock: 8,
      category: 'skincare',
      description: 'نضارة وإشراقة فورية وتفتيح البقع الداكنة',
      image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80'
    },
    {
      id: 3,
      name: 'عطر شانيل الإصدار الخاص الفاخر',
      price: 145000,
      oldPrice: 180000,
      stock: 5,
      category: 'perfumes',
      description: 'عطر فخم يناسب السهرات والمناسبات الخاصة',
      image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&q=80'
    }
  ],
  offers: [
    {
      id: 1,
      title: 'مهرجان العروض الكبرى',
      discount: 'خصم 35%',
      details: 'على كافة منتجات المكياج والعناية بالبشرة والعطور الأصلية'
    }
  ],
  orders: [
    {
      id: 501,
      name: 'سارة أحمد',
      phone: '07712345678',
      address: 'بغداد · الكرادة داخل',
      items: ['حمره مات ثابتة ممتدة الثبات', 'سيروم فيتامين سي للبشرة النضرة'],
      total: 46000,
      date: '2026-10-29',
      time: '10:00 ص',
      status: 'pending'
    },
    {
      id: 502,
      name: 'نور الهدى',
      phone: '07811223344',
      address: 'بغداد · المنصور شارع الرواد',
      items: ['عطر شانيل الإصدار الخاص الفاخر'],
      total: 145000,
      date: '2026-10-29',
      time: '6:00 م',
      status: 'accepted'
    }
  ]
};

let db;
try {
  db = JSON.parse(localStorage.getItem(KEY)) || structuredClone(initial);
} catch (e) {
  db = JSON.parse(JSON.stringify(initial));
}
if (!db.store.openTime) db.store.openTime = '8:00 ص';
if (!db.store.closeTime) db.store.closeTime = '10:00 م';

const save = () => {
  localStorage.setItem(KEY, JSON.stringify(db));
  render();
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

const fmt = n => Number(n || 0).toLocaleString('en-US') + ' د.ع';
const val = id => document.getElementById(id)?.value?.trim();
const statusMap = {
  pending: 'بانتظار التأكيد',
  accepted: 'قيد التوصيل',
  completed: 'مكتمل',
  rejected: 'مرفوض'
};

let page = 'home';
let orderFilter = 'all';
let editingProductId = null;
let uploadedImageTemp = '';

function toast(s) {
  let t = document.getElementById('toast');
  if (!t) return;
  t.textContent = s;
  t.style.display = 'block';
  setTimeout(() => (t.style.display = 'none'), 2600);
}

function orderCard(o) {
  return `<div class="card">
    <div class="between">
      <h3>${esc(o.name)}</h3>
      <span class="tag ${o.status === 'accepted' || o.status === 'completed' ? 'ok' : o.status === 'rejected' ? 'no' : ''}">${statusMap[o.status] || o.status}</span>
    </div>
    <p class="muted" style="margin:6px 0">${o.items.map(esc).join(' + ')}</p>
    <p style="margin:4px 0;font-size:12px;color:var(--pink2)">📍 ${esc(o.address || 'بغداد')} · 📅 ${esc(o.date)} ${o.time ? '· 🕒 ' + esc(o.time) : ''}</p>
    <div class="between" style="margin-top:8px">
      <span class="money">${fmt(o.total)}</span>
      <small>📞 ${esc(o.phone)} · طلب #${o.id}</small>
    </div>
    <div class="actions">
      ${o.status === 'pending' ? `
        <button onclick="updateOrder(${o.id},'accepted')">قبول وتجهيز التوصيل 🚚</button>
        <button class="danger" onclick="updateOrder(${o.id},'rejected')">رفض</button>
      ` : o.status === 'accepted' ? `
        <button onclick="updateOrder(${o.id},'completed')">تم التسليم (مكتمل ✓)</button>
      ` : ''}
    </div>
  </div>`;
}

function renderHome() {
  let pend = db.orders.filter(x => x.status === 'pending');
  return `<div class="hero">
    <div class="between">
      <div>
        <small>أهلاً بك في لوحة تحكم متجر الكوزمتك</small>
        <p style="margin:4px 0"><strong>${esc(db.store.name)}</strong></p>
        <small>📍 ${esc(db.store.area)} · ${esc(db.store.address)}</small>
        <div style="font-size:12px;color:var(--pink2);margin-top:4px">🕒 أوقات العمل: ${esc(db.store.openTime || '8:00 ص')} – ${esc(db.store.closeTime || '10:00 م')}</div>
      </div>
      <span class="tag ${db.store.active ? 'ok' : 'no'}">${db.store.active ? 'يستقبل الطلبات' : 'متوقف مؤقتاً'}</span>
    </div>
  </div>
  <div class="stats">
    <div class="stat"><small>طلبات جديدة</small><b>${pend.length}</b></div>
    <div class="stat"><small>المنتجات</small><b>${db.products.length}</b></div>
    <div class="stat"><small>العروض الفعالة</small><b>${db.offers.length}</b></div>
  </div>
  <div class="actions" style="margin-bottom:14px">
    <button style="flex:1" onclick="setPage('products')">➕ إضافة منتج جديد</button>
    <button class="secondary" style="flex:1" onclick="setPage('offers')">✨ إضافة عرض خاص</button>
  </div>
  <h2>طلبات الزبونات الجديدة (${pend.length})</h2>
  ${pend.length ? pend.map(orderCard).join('') : '<div class="empty">لا توجد طلبات جديدة بانتظار التأكيد حالياً</div>'}`;
}

function renderOrders() {
  let list = orderFilter === 'all' ? db.orders : db.orders.filter(x => x.status === orderFilter);
  return `<h2>إدارة طلبات الزبونات</h2>
  <div class="tabs">
    ${[['all', 'الكل'], ['pending', 'الجديدة'], ['accepted', 'قيد التوصيل'], ['completed', 'المكتملة'], ['rejected', 'المرفوضة']].map(([k, label]) => `<button class="${orderFilter === k ? '' : 'secondary'}" onclick="setOrderFilter('${k}')">${label}</button>`).join('')}
  </div>
  ${list.length ? list.map(orderCard).join('') : '<div class="empty">لا توجد طلبات ضمن هذا التصنيف</div>'}`;
}

function renderProducts() {
  let p = editingProductId ? db.products.find(x => x.id === editingProductId) : null;
  return `<h2>${editingProductId ? '✏️ تعديل منتج' : '➕ إضافة منتج كوزمتك جديد'}</h2>
  <div class="card">
    <label>اسم المنتج</label><input id="pname" placeholder="مثال: أحمر شفاه مات ثابت" value="${esc(p?.name || '')}">
    <div class="two">
      <div><label>السعر الحالي (د.ع)</label><input id="pprice" type="number" placeholder="18000" value="${p?.price || ''}"></div>
      <div><label>السعر قبل الخصم (اختياري)</label><input id="poldprice" type="number" placeholder="28000" value="${p?.oldPrice || ''}"></div>
    </div>
    <div class="two">
      <div><label>الكمية المتوفرة</label><input id="pstock" type="number" placeholder="15" value="${p?.stock || ''}"></div>
      <div>
        <label>التصنيف</label>
        <select id="pcat">
          <option value="makeup" ${p?.category === 'makeup' ? 'selected' : ''}>المكياج</option>
          <option value="skincare" ${p?.category === 'skincare' ? 'selected' : ''}>العناية بالبشرة</option>
          <option value="perfumes" ${p?.category === 'perfumes' ? 'selected' : ''}>العطور</option>
          <option value="hair" ${p?.category === 'hair' ? 'selected' : ''}>العناية بالشعر</option>
          <option value="accessories" ${p?.category === 'accessories' ? 'selected' : ''}>الإكسسوارات</option>
        </select>
      </div>
    </div>
    <label>وصف المنتج ومميزاته</label><textarea id="pdesc" placeholder="اكتب تفاصيل المنتج وماركته ومميزاته...">${esc(p?.description || '')}</textarea>
    <label>رفع صورة المنتج (من الجهاز)</label>
    <input type="file" id="pImageFile" accept="image/*" onchange="handleImageUpload(event)">
    ${(uploadedImageTemp || p?.image) ? `<img src="${uploadedImageTemp || p.image}" class="preview-img" alt="معاينة الصورة">` : ''}
    <div class="actions" style="margin-top:15px">
      <button onclick="saveProductData()">${editingProductId ? 'حفظ التعديلات 💾' : 'إضافة ونشر المنتج 💄'}</button>
      ${editingProductId ? `<button class="secondary" onclick="cancelEdit()">إلغاء</button>` : ''}
    </div>
  </div>

  <h2>منتجات المتجر الحالية (${db.products.length})</h2>
  ${db.products.map(item => `
    <div class="card">
      <div class="between" style="align-items:flex-start">
        <div style="display:flex;gap:11px;align-items:center">
          <img src="${esc(item.image)}" class="prod-thumb" alt="${esc(item.name)}">
          <div>
            <h3>${esc(item.name)}</h3>
            <small>${catNames[item.category] || 'تجميل'} • الكمية: ${item.stock}</small>
            <p style="margin:4px 0 0"><b class="money">${fmt(item.price)}</b> ${item.oldPrice ? `<del class="muted" style="font-size:11px;margin-right:5px">${fmt(item.oldPrice)}</del>` : ''}</p>
          </div>
        </div>
        <span class="tag ok">متوفر</span>
      </div>
      <div class="actions">
        <button class="secondary" onclick="startEdit(${item.id})">تعديل</button>
        <button class="danger" onclick="deleteProduct(${item.id})">حذف</button>
      </div>
    </div>
  `).join('')}`;
}

function renderOffers() {
  return `<h2>✨ إنشاء عرض أو تخفيض خاص</h2>
  <div class="card">
    <label>عنوان العرض</label><input id="otitle" placeholder="مثال: عروض نهاية الأسبوع على العطور">
    <label>نسبة أو قيمة الخصم</label><input id="odiscount" placeholder="مثال: خصم 30%">
    <label>تفاصيل العرض والمنتجات المشمولة</label><textarea id="odesc" placeholder="تفاصيل العرض الترويجي للزبونات..."></textarea>
    <div class="actions"><button onclick="saveOffer()">نشر العرض الخاص 🌟</button></div>
  </div>
  <h2>العروض الفعالة (${db.offers.length})</h2>
  ${db.offers.length ? db.offers.map(off => `
    <div class="card">
      <div class="between"><h3>${esc(off.title)}</h3><span class="tag ok">${esc(off.discount)}</span></div>
      <p class="muted" style="margin:8px 0">${esc(off.details)}</p>
      <div class="actions"><button class="danger" onclick="deleteOffer(${off.id})">حذف العرض</button></div>
    </div>
  `).join('') : '<div class="empty">لا توجد عروض مضافة حالياً</div>'}`;
}

function renderMore() {
  return `<h2>إعدادات وبيانات المتجر</h2>
  <div class="card">
    <label>اسم متجر الكوزمتك</label><input id="sname" value="${esc(db.store.name)}">
    <label>المنطقة</label><input id="sarea" value="${esc(db.store.area)}">
    <label>العنوان التفصيلي</label><input id="saddress" value="${esc(db.store.address)}">
    <label>رقم هاتف المتجر / واتساب الطلبات</label><input id="sphone" inputmode="tel" value="${esc(db.store.phone)}">
    <label>أوقات الدوام (بصيغة 12 ساعة من 8:00 ص إلى 10:00 م)</label>
    <div class="two">
      <div>
        <label>من الساعة</label>
        <select id="sopen">
          ${timeSlots12h.map(t => `<option value="${t}" ${(db.store.openTime || '8:00 ص') === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div>
        <label>إلى الساعة</label>
        <select id="sclose">
          ${timeSlots12h.map(t => `<option value="${t}" ${(db.store.closeTime || '10:00 م') === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <label>نبذة عن المتجر</label><textarea id="sabout">${esc(db.store.about)}</textarea>
    <div class="two">
      <div><label>خط العرض (Latitude)</label><input id="slat" value="${esc(db.store.lat || '33.3128')}"></div>
      <div><label>خط الطول (Longitude)</label><input id="slng" value="${esc(db.store.lng || '44.4322')}"></div>
    </div>
    <div class="actions" style="margin-top:8px">
      <button class="secondary" onclick="fetchStoreGPS()">📍 جلب موقع المتجر الحالي عبر GPS</button>
    </div>
    <div class="switch">
      <span>استقبال طلبات الكوزمتك والتوصيل</span>
      <input id="sactive" type="checkbox" ${db.store.active ? 'checked' : ''}>
    </div>
    <div class="actions"><button onclick="saveStore()">حفظ بيانات المتجر 💾</button></div>
  </div>`;
}

function setPage(p) {
  page = p;
  render();
}

function setOrderFilter(f) {
  orderFilter = f;
  render();
}

function render() {
  const titleEl = document.getElementById('storeTitle');
  if (titleEl) titleEl.textContent = db.store.name;
  const views = {
    home: renderHome,
    orders: renderOrders,
    products: renderProducts,
    offers: renderOffers,
    more: renderMore
  };
  const mainEl = document.getElementById('main');
  if (mainEl) mainEl.innerHTML = (views[page] || renderHome)();
  const navEl = document.getElementById('nav');
  if (navEl) {
    navEl.innerHTML = `
      <button class="${page === 'home' ? 'active' : ''}" onclick="setPage('home')"><span>⌂</span>الرئيسية</button>
      <button class="${page === 'orders' ? 'active' : ''}" onclick="setPage('orders')"><span>📋</span>الطلبات</button>
      <button class="${page === 'products' ? 'active' : ''}" onclick="setPage('products')"><span>💄</span>المنتجات</button>
      <button class="${page === 'offers' ? 'active' : ''}" onclick="setPage('offers')"><span>✨</span>العروض</button>
      <button class="${page === 'more' ? 'active' : ''}" onclick="setPage('more')"><span>☰</span>المزيد</button>
    `;
  }
}

function handleImageUpload(e) {
  let file = e.target.files[0];
  if (!file) return;
  let reader = new FileReader();
  reader.onload = function (ev) {
    uploadedImageTemp = ev.target.result;
    render();
  };
  reader.readAsDataURL(file);
}

function startEdit(id) {
  editingProductId = id;
  let p = db.products.find(x => x.id === id);
  uploadedImageTemp = p?.image || '';
  page = 'products';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  editingProductId = null;
  uploadedImageTemp = '';
  render();
}

function saveProductData() {
  let name = val('pname'),
    price = Number(val('pprice')),
    oldPrice = Number(val('poldprice')) || 0,
    stock = Number(val('pstock')),
    desc = val('pdesc'),
    cat = document.getElementById('pcat')?.value || 'makeup';
  if (!name || !price) return toast('يرجى إدخال اسم المنتج والسعر');
  if (editingProductId) {
    let p = db.products.find(x => x.id === editingProductId);
    if (p) {
      p.name = name;
      p.price = price;
      p.oldPrice = oldPrice;
      p.stock = stock || 1;
      p.description = desc;
      p.category = cat;
      if (uploadedImageTemp) p.image = uploadedImageTemp;
    }
    editingProductId = null;
    toast('✓ تم تحديث بيانات المنتج بنجاح');
  } else {
    db.products.unshift({
      id: Date.now(),
      name,
      price,
      oldPrice,
      stock: stock || 1,
      category: cat,
      description: desc,
      image: uploadedImageTemp || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80'
    });
    toast('✓ تمت إضافة المنتج ونشره في المتجر بنجاح 💄');
  }
  uploadedImageTemp = '';
  save();
}

function deleteProduct(id) {
  db.products = db.products.filter(x => x.id !== id);
  save();
  toast('تم حذف المنتج');
}

function saveOffer() {
  let title = val('otitle'),
    discount = val('odiscount'),
    details = val('odesc');
  if (!title) return toast('يرجى إدخال عنوان العرض الخاص');
  db.offers.unshift({ id: Date.now(), title, discount: discount || 'خصم خاص', details });
  save();
  toast('✓ تم نشر العرض الخاص بنجاح 🌟');
}

function deleteOffer(id) {
  db.offers = db.offers.filter(x => x.id !== id);
  save();
  toast('تم حذف العرض');
}

function updateOrder(id, status) {
  let o = db.orders.find(x => x.id === id);
  if (o) {
    o.status = status;
    save();
    toast('✓ تم تحديث حالة الطلب بنجاح');
  }
}

function fetchStoreGPS() {
  if (!navigator.geolocation) return toast('خدمة GPS غير مدعومة في المتصفح');
  toast('📍 جاري تحديد موقع المتجر عبر GPS...');
  navigator.geolocation.getCurrentPosition(
    pos => {
      db.store.lat = pos.coords.latitude.toFixed(5);
      db.store.lng = pos.coords.longitude.toFixed(5);
      save();
      toast('✓ تم تحديد موقع المتجر عبر GPS بنجاح');
    },
    () => toast('تعذر جلب الموقع تلقائياً')
  );
}

function saveStore() {
  db.store.name = val('sname') || db.store.name;
  db.store.area = val('sarea');
  db.store.address = val('saddress');
  db.store.phone = val('sphone');
  db.store.openTime = val('sopen') || '8:00 ص';
  db.store.closeTime = val('sclose') || '10:00 م';
  db.store.about = val('sabout');
  db.store.lat = val('slat');
  db.store.lng = val('slng');
  db.store.active = Boolean(document.getElementById('sactive')?.checked);
  save();
  toast('✓ تم حفظ إعدادات وبيانات المتجر');
}

window.setPage = setPage;
window.setOrderFilter = setOrderFilter;
window.handleImageUpload = handleImageUpload;
window.startEdit = startEdit;
window.cancelEdit = cancelEdit;
window.saveProductData = saveProductData;
window.deleteProduct = deleteProduct;
window.saveOffer = saveOffer;
window.deleteOffer = deleteOffer;
window.updateOrder = updateOrder;
window.fetchStoreGPS = fetchStoreGPS;
window.saveStore = saveStore;

render();

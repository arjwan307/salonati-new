import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

function createCatalogState() {
  const state = createInitialCatalogState();
  type State = typeof state;
  type BookingList = State['bookingsBySalon'][keyof State['bookingsBySalon']];
  type Expense = Omit<State['adminExpenses'][number], 'owner_id' | 'salon_name'> & {
    owner_id: string | null; salon_name: string | null;
  };
  return state as Omit<State, 'registrations' | 'bookingsBySalon' | 'adminExpenses'> & {
    registrations: (State['registrations'][number] & { reason?: string })[];
    bookingsBySalon: Record<string, BookingList>;
    adminExpenses: Expense[];
  };
}

function createInitialCatalogState() {
  const now = new Date().toISOString();
  return {
    loggedIn: true,
    adminAccount: {
      id: 'admin-main',
      email: 'admin@salonati.iq',
      role: 'admin',
      staff: false,
      permissions: ['bookings', 'registrations', 'reviews', 'finance_view', 'finance_edit', 'ads'],
    },
    owners: [
      {
        id: 'owner-1',
        salonName: 'صالون لؤلؤة بغداد',
        email: 'maryam@salonati.iq',
        area: 'الكرادة',
        createdAt: now,
      },
      {
        id: 'owner-2',
        salonName: 'صالون لمسة جمال',
        email: 'lamsa@salonati.iq',
        area: 'المنصور',
        createdAt: now,
      },
      {
        id: 'owner-3',
        salonName: 'صالون ماسة زيونة',
        email: 'masa@salonati.iq',
        area: 'زيونة',
        createdAt: now,
      },
    ],
    registrations: [
      {
        ownerId: 'owner-1',
        revision: 'reg-1',
        salonName: 'صالون لؤلؤة بغداد',
        contactName: 'ست مريم',
        phone: '07701234567',
        email: 'maryam@salonati.iq',
        area: 'الكرادة',
        address: 'الكرادة داخل — قرب ساحة كهرمانة',
        latitude: 33.3128,
        longitude: 44.4322,
        facadeUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80',
        status: 'approved',
        submittedAt: now,
      },
      {
        ownerId: 'owner-2',
        revision: 'reg-2',
        salonName: 'صالون لمسة جمال',
        contactName: 'ست نور',
        phone: '07809876543',
        email: 'lamsa@salonati.iq',
        area: 'المنصور',
        address: 'المنصور — شارع 14 رمضان',
        latitude: 33.3185,
        longitude: 44.3421,
        facadeUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80',
        status: 'approved',
        submittedAt: now,
      },
      {
        ownerId: 'owner-3',
        revision: 'reg-3',
        salonName: 'صالون ماسة زيونة',
        contactName: 'ست ريم',
        phone: '07715554433',
        email: 'masa@salonati.iq',
        area: 'زيونة',
        address: 'زيونة — قرب مول زيونة',
        latitude: 33.3264,
        longitude: 44.4551,
        facadeUrl: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&q=80',
        status: 'pending',
        submittedAt: now,
      },
    ],
    serviceReviews: [
      {
        revisionId: 'srv-rev-1',
        salonName: 'صالون لؤلؤة بغداد',
        area: 'الكرادة',
        name: 'تسريحة ومكياج مناسبات ملكي',
        category: 'makeup',
        mediaUrl: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&q=80',
        mediaType: 'image/jpeg',
        price: 65000,
        minutes: 90,
        active: true,
        publishedRevisionId: null,
        discount: {
          price: 50000,
          startsAt: now,
          endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        },
      },
    ],
    productReviews: [
      {
        revisionId: 'prd-rev-1',
        salonName: 'صالون لؤلؤة بغداد',
        area: 'الكرادة',
        name: 'سيروم الأركان المغربي الأصلي',
        description: 'سيروم مغذٍ للشعر يمنح لمعاناً وحماية فائقة من الحرارة',
        mediaUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80',
        previousPrice: null,
        price: 25000,
        stock: 12,
        active: true,
        publishedRevisionId: null,
      },
    ],
    adReviews: [
      {
        revisionId: 'ad-rev-1',
        salonName: 'صالون لمسة جمال',
        title: 'خصم 25% على باقات العرائس لهذا الأسبوع',
        mediaUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80',
        mediaType: 'image/jpeg',
        placement: 'home',
        budget: 50000,
      },
    ],
    notifications: [
      {
        salon_name: 'صالون لؤلؤة بغداد',
        customer_name: 'نور الهدى',
        event: 'confirmed',
        created_at: now,
      },
      {
        salon_name: 'صالون لمسة جمال',
        customer_name: 'سارة أحمد',
        event: 'service_started',
        created_at: now,
      },
    ],
    bookingsBySalon: {
      'owner-1': [
        {
          id: 'bk-101',
          salonId: 'owner-1',
          salonName: 'صالون لؤلؤة بغداد',
          customerName: 'نور الهدى',
          phone: '07701112233',
          startsAt: now,
          endsAt: new Date(Date.now() + 3600000).toISOString(),
          status: 'confirmed',
          totalMinor: 5500000,
          paymentMethod: 'cash',
          paymentStatus: 'paid',
          startedAt: now,
          notes: 'قص أطراف مع سشوار ومكياج ناعم',
          rating: 5,
          loyalty: {stamps: 2, eligible: false, serviceName: 'سشوار وتصفيف'},
          services: [
            {name: 'قص أطراف وسشوار', minutes: 45, priceMinor: 2500000},
            {name: 'مكياج ناعم', minutes: 45, priceMinor: 3000000},
          ],
        },
        {
          id: 'bk-102',
          salonId: 'owner-1',
          salonName: 'صالون لؤلؤة بغداد',
          customerName: 'فاطمة علي',
          phone: '07802223344',
          startsAt: new Date(Date.now() + 7200000).toISOString(),
          endsAt: new Date(Date.now() + 10800000).toISOString(),
          status: 'pending',
          totalMinor: 3500000,
          paymentMethod: 'cash',
          paymentStatus: 'unpaid',
          startedAt: null,
          notes: 'جلسة تنظيف بشرة عميق',
          rating: null,
          loyalty: {stamps: 1, eligible: false, serviceName: 'سشوار وتصفيف'},
          services: [{name: 'تنظيف بشرة ملكي', minutes: 60, priceMinor: 3500000}],
        },
      ],
      'owner-2': [
        {
          id: 'bk-201',
          salonId: 'owner-2',
          salonName: 'صالون لمسة جمال',
          customerName: 'سارة أحمد',
          phone: '07713334455',
          startsAt: now,
          endsAt: new Date(Date.now() + 5400000).toISOString(),
          status: 'completed',
          totalMinor: 4000000,
          paymentMethod: 'cash',
          paymentStatus: 'paid',
          startedAt: now,
          notes: '',
          rating: 5,
          loyalty: {stamps: 3, eligible: true, serviceName: 'مناكير جل'},
          services: [{name: 'مكياج مناسبات', minutes: 75, priceMinor: 4000000}],
        },
      ],
    },
    campaigns: [
      {
        id: 'cmp-1',
        title: 'عروض الصالونات المعتمدة في بغداد',
        copy: 'احجزي موعدكِ الآن واستفيدي من خدمة الزيارة الرابعة المجانية',
        mediaId: 'med-1',
        mediaUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80',
        mediaType: 'image/jpeg',
        placements: ['management', 'home'],
        active: true,
      },
    ],
    staff: [
      {
        id: 'stf-1',
        name: 'زهراء المشرفة',
        email: 'zahraa@salonati.iq',
        active: true,
        permissions: ['bookings', 'registrations', 'reviews'],
      },
    ],
    loyaltyServices: [
      {id: 'ls-1', owner_id: 'owner-1', name: 'سشوار وتصفيف'},
      {id: 'ls-2', owner_id: 'owner-1', name: 'تنظيف بشرة'},
      {id: 'ls-3', owner_id: 'owner-2', name: 'مناكير جل'},
      {id: 'ls-4', owner_id: 'owner-2', name: 'قص أطراف'},
    ],
    loyaltySettings: [
      {owner_id: 'owner-1', service_id: 'ls-1'},
      {owner_id: 'owner-2', service_id: 'ls-3'},
    ],
    adminExpenses: [
      {
        id: 'exp-1',
        description: 'ترويج وإعلانات ممولة للمنصة',
        amount: 50000,
        expense_date: new Date().toISOString().slice(0, 10),
        owner_id: null,
        salon_name: null,
        reference: 'وصل رقم 101',
      },
    ],
    statements: {
      'owner-1': {
        events: [
          {
            id: 'ev-1',
            kind: 'service',
            source_id: 'حجز #bk-101 — نور الهدى',
            base_amount: 55000,
            admin_due: 5500,
            occurred_at: now,
          },
          {
            id: 'ev-2',
            kind: 'product',
            source_id: 'طلب منتج #pr-12 — سيروم الأركان',
            base_amount: 25000,
            admin_due: 2500,
            occurred_at: now,
          },
        ],
        adminPayments: [
          {
            id: 'pay-1',
            amount: 3000,
            reference: 'وصل قبض رقم 10',
            recorded_at: now,
          },
        ],
        receipts: [
          {
            id: 'rcp-1',
            channel: 'customer',
            amount: 55000,
            reference: 'قبض مباشر من الزبونة',
            recorded_at: now,
          },
        ],
        agreements: [
          {
            id: 'agr-1',
            status: 'accepted',
            created_at: now,
          },
        ],
      },
      'owner-2': {
        events: [
          {
            id: 'ev-3',
            kind: 'service',
            source_id: 'حجز #bk-201 — سارة أحمد',
            base_amount: 40000,
            admin_due: 4000,
            occurred_at: now,
          },
        ],
        adminPayments: [],
        receipts: [],
        agreements: [],
      },
    } as Record<string, any>,
  };
}

export default defineConfig(() => {
  const catalogState = createCatalogState();

  function readBody(req: any): Promise<any> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return resolve({});
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({});
        }
      });
    });
  }

  function sendJson(res: any, data: any, status = 200) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'serve-salonati-routes',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url) return next();
            const urlObj = new URL(req.url, 'http://localhost:3000');
            const cleanUrl = urlObj.pathname;

            if (cleanUrl.startsWith('/api/catalog/')) {
              const sub = cleanUrl.slice('/api/catalog/'.length);

              if (sub === 'me' && req.method === 'GET') {
                if (!catalogState.loggedIn) {
                  return sendJson(res, {error: 'login_required'}, 401);
                }
                return sendJson(res, {account: catalogState.adminAccount});
              }

              if ((sub === 'login' || sub === 'setup') && req.method === 'POST') {
                const body = await readBody(req);
                catalogState.loggedIn = true;
                if (body?.email) {
                  catalogState.adminAccount.email = String(body.email).trim();
                }
                return sendJson(res, {account: catalogState.adminAccount});
              }

              if (sub === 'logout' && req.method === 'POST') {
                catalogState.loggedIn = false;
                return sendJson(res, {ok: true});
              }

              if (sub === 'reviews' && req.method === 'GET') {
                return sendJson(res, {reviews: catalogState.serviceReviews});
              }

              if (sub.startsWith('reviews/') && req.method === 'POST') {
                const revId = sub.slice('reviews/'.length);
                catalogState.serviceReviews = catalogState.serviceReviews.filter(
                  (r) => r.revisionId !== revId,
                );
                return sendJson(res, {ok: true});
              }

              if (sub === 'product-reviews' && req.method === 'GET') {
                return sendJson(res, {reviews: catalogState.productReviews});
              }

              if (sub.startsWith('product-reviews/') && req.method === 'POST') {
                const revId = sub.slice('product-reviews/'.length);
                catalogState.productReviews = catalogState.productReviews.filter(
                  (r) => r.revisionId !== revId,
                );
                return sendJson(res, {ok: true});
              }

              if (sub === 'ad-reviews' && req.method === 'GET') {
                return sendJson(res, {reviews: catalogState.adReviews});
              }

              if (sub.startsWith('ad-reviews/') && req.method === 'POST') {
                const revId = sub.slice('ad-reviews/'.length);
                catalogState.adReviews = catalogState.adReviews.filter(
                  (r) => r.revisionId !== revId,
                );
                return sendJson(res, {ok: true});
              }

              if (sub === 'workflow/notifications' && req.method === 'GET') {
                return sendJson(res, {notifications: catalogState.notifications});
              }

              if (sub === 'admin/registrations' && req.method === 'GET') {
                return sendJson(res, {registrations: catalogState.registrations});
              }

              if (sub === 'admin/registrations/review' && req.method === 'POST') {
                const body = await readBody(req);
                const reg = catalogState.registrations.find((r) => r.ownerId === body.ownerId);
                if (reg) {
                  reg.status = body.action === 'approve' ? 'approved' : 'rejected';
                  reg.reason = body.reason || '';
                }
                return sendJson(res, {ok: true});
              }

              if (sub === 'admin/bookings' && req.method === 'GET') {
                const salons = catalogState.owners.map((o) => {
                  const list = catalogState.bookingsBySalon[o.id] || [];
                  return {
                    id: o.id,
                    name: o.salonName,
                    bookingCount: list.length,
                    activeCount: list.filter((b) =>
                      ['pending', 'confirmed'].includes(b.status),
                    ).length,
                  };
                });
                return sendJson(res, {salons});
              }

              if (sub === 'admin/bookings/salon' && req.method === 'GET') {
                const salonId = urlObj.searchParams.get('salonId') || '';
                const list = catalogState.bookingsBySalon[salonId] || [];
                return sendJson(res, {bookings: list, hasMore: false, nextOffset: list.length});
              }

              if (sub === 'admin/bookings/detail' && req.method === 'GET') {
                const id = urlObj.searchParams.get('id') || '';
                const all = Object.values(catalogState.bookingsBySalon).flat();
                const found = all.find((b) => b.id === id) || all[0];
                if (!found) return sendJson(res, {error: 'not_found'}, 404);
                return sendJson(res, {booking: found, services: found.services || []});
              }

              if (sub === 'admin/campaigns' && req.method === 'GET') {
                return sendJson(res, {campaigns: catalogState.campaigns});
              }

              if (sub === 'admin/campaigns' && req.method === 'POST') {
                const body = await readBody(req);
                const id = body.id || 'cmp-' + Date.now();
                const existing = catalogState.campaigns.find((c) => c.id === id);
                const item = {
                  id,
                  title: body.title || 'إعلان جديد',
                  copy: body.copy || '',
                  mediaId: body.mediaId || existing?.mediaId || 'med-1',
                  mediaUrl:
                    existing?.mediaUrl ||
                    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80',
                  mediaType: existing?.mediaType || 'image/jpeg',
                  placements: ['management', ...(body.placements || [])],
                  active: body.active !== false,
                };
                if (existing) {
                  Object.assign(existing, item);
                } else {
                  catalogState.campaigns.unshift(item);
                }
                return sendJson(res, {id}, 201);
              }

              if (sub === 'admin/campaigns/delete' && req.method === 'POST') {
                const body = await readBody(req);
                catalogState.campaigns = catalogState.campaigns.filter((c) => c.id !== body.id);
                return sendJson(res, {ok: true});
              }

              if (sub === 'media' && req.method === 'POST') {
                return sendJson(res, {id: 'media-' + Date.now()}, 201);
              }

              if (sub === 'admin/staff' && req.method === 'GET') {
                return sendJson(res, {staff: catalogState.staff});
              }

              if (sub === 'admin/staff' && req.method === 'POST') {
                const body = await readBody(req);
                const id = 'stf-' + Date.now();
                catalogState.staff.push({
                  id,
                  name: body.name || 'موظف جديد',
                  email: body.email || 'staff@salonati.iq',
                  active: true,
                  permissions: body.permissions || ['bookings'],
                });
                return sendJson(res, {id}, 201);
              }

              if (sub === 'admin/staff/update' && req.method === 'POST') {
                const body = await readBody(req);
                const st = catalogState.staff.find((s) => s.id === body.id);
                if (st) {
                  st.name = body.name || st.name;
                  st.active = Boolean(body.active);
                  st.permissions = body.permissions || st.permissions;
                }
                return sendJson(res, {ok: true});
              }

              if (sub === 'admin/loyalty' && req.method === 'GET') {
                return sendJson(res, {
                  services: catalogState.loyaltyServices,
                  settings: catalogState.loyaltySettings,
                });
              }

              if (sub === 'admin/loyalty' && req.method === 'POST') {
                const body = await readBody(req);
                const existing = catalogState.loyaltySettings.find(
                  (s) => s.owner_id === body.ownerId,
                );
                if (existing) {
                  existing.service_id = body.serviceId;
                } else {
                  catalogState.loyaltySettings.push({
                    owner_id: body.ownerId,
                    service_id: body.serviceId,
                  });
                }
                return sendJson(res, {ok: true});
              }

              if (sub === 'admin/sample-data' && req.method === 'POST') {
                catalogState.serviceReviews = [];
                catalogState.productReviews = [];
                catalogState.adReviews = [];
                catalogState.notifications = [];
                return sendJson(res, {ok: true});
              }

              if (sub === 'finance/options' && req.method === 'GET') {
                return sendJson(res, {
                  owners: catalogState.owners,
                  salons: catalogState.owners.map((o) => ({id: o.id, name: o.salonName})),
                  stores: [],
                  couriers: [{id: 'courier-1', name: 'مندوب توصيل بغداد'}],
                });
              }

              if (sub === 'finance/admin-expenses' && req.method === 'GET') {
                const allPaid = Object.values(catalogState.statements).reduce(
                  (sum: number, st: any) =>
                    sum +
                    (st.adminPayments || []).reduce((a: number, p: any) => a + p.amount, 0),
                  0,
                );
                const totalExp = catalogState.adminExpenses.reduce((a, e) => a + e.amount, 0);
                return sendJson(res, {
                  totals: {
                    received: allPaid,
                    expenses: totalExp,
                    netCash: allPaid - totalExp,
                  },
                  expenses: catalogState.adminExpenses,
                });
              }

              if (sub === 'finance/admin-expenses' && req.method === 'POST') {
                const body = await readBody(req);
                const owner = catalogState.owners.find((o) => o.id === body.ownerId);
                const exp = {
                  id: 'exp-' + Date.now(),
                  description: body.description || '',
                  amount: Number(body.amount) || 0,
                  expense_date: body.expenseDate || new Date().toISOString().slice(0, 10),
                  owner_id: body.ownerId || null,
                  salon_name: owner?.salonName || null,
                  reference: body.reference || '',
                };
                catalogState.adminExpenses.unshift(exp);
                return sendJson(res, {id: exp.id}, 201);
              }

              if (sub === 'finance/statement' && req.method === 'GET') {
                const ownerId = urlObj.searchParams.get('ownerId') || 'owner-1';
                const st = catalogState.statements[ownerId] || {
                  events: [],
                  adminPayments: [],
                  receipts: [],
                  agreements: [],
                };
                const adminDue = (st.events || []).reduce(
                  (a: number, e: any) => a + e.admin_due,
                  0,
                );
                const adminPaid = (st.adminPayments || []).reduce(
                  (a: number, p: any) => a + p.amount,
                  0,
                );
                const customer = (st.receipts || [])
                  .filter((r: any) => r.channel === 'customer')
                  .reduce((a: number, r: any) => a + r.amount, 0);
                const courier = (st.receipts || [])
                  .filter((r: any) => r.channel === 'courier')
                  .reduce((a: number, r: any) => a + r.amount, 0);
                const adminExpenses = catalogState.adminExpenses.filter(
                  (e) => e.owner_id === ownerId,
                );
                return sendJson(res, {
                  totals: {
                    adminDue,
                    adminPaid,
                    adminBalance: Math.max(0, adminDue - adminPaid),
                    customer,
                    courier,
                  },
                  events: st.events || [],
                  adminPayments: st.adminPayments || [],
                  receipts: st.receipts || [],
                  adminExpenses,
                  agreements: st.agreements || [],
                });
              }

              if (sub === 'finance/admin-payments' && req.method === 'POST') {
                const body = await readBody(req);
                const ownerId = body.ownerId || 'owner-1';
                if (!catalogState.statements[ownerId]) {
                  catalogState.statements[ownerId] = {
                    events: [],
                    adminPayments: [],
                    receipts: [],
                    agreements: [],
                  };
                }
                const payment = {
                  id: 'pay-' + Date.now(),
                  amount: Number(body.amount) || 0,
                  reference: body.reference || '',
                  recorded_at: new Date().toISOString(),
                };
                catalogState.statements[ownerId].adminPayments.unshift(payment);
                return sendJson(res, {id: payment.id}, 201);
              }

              if (sub === 'finance/agreements' && req.method === 'POST') {
                const body = await readBody(req);
                const ownerId = body.ownerId || 'owner-1';
                if (!catalogState.statements[ownerId]) {
                  catalogState.statements[ownerId] = {
                    events: [],
                    adminPayments: [],
                    receipts: [],
                    agreements: [],
                  };
                }
                const agr = {
                  id: 'agr-' + Date.now(),
                  status: 'proposed',
                  created_at: new Date().toISOString(),
                };
                catalogState.statements[ownerId].agreements.unshift(agr);
                return sendJson(res, {id: agr.id, status: 'proposed'}, 201);
              }

              if (sub === 'finance/delivery-grant' && req.method === 'POST') {
                return sendJson(res, {ok: true});
              }

              if (sub === 'public' && req.method === 'GET') {
                return sendJson(res, {campaigns: catalogState.campaigns});
              }

              return sendJson(res, {ok: true});
            }

            if (cleanUrl === '/__salonati_ads.js') {
              const filePath = path.resolve(__dirname, 'public/__salonati_ads.js');
              if (fs.existsSync(filePath)) {
                res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                res.end(fs.readFileSync(filePath));
                return;
              }
            }

            if (
              cleanUrl === '/admin' ||
              cleanUrl === '/admin/' ||
              cleanUrl === '/apps/admin' ||
              cleanUrl === '/apps/admin/' ||
              cleanUrl === '/admin/moderation' ||
              cleanUrl === '/admin/moderation/'
            ) {
              const adminPath = path.resolve(__dirname, 'apps/admin/index.html');
              if (fs.existsSync(adminPath)) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(fs.readFileSync(adminPath));
                return;
              }
            }

            if (
              cleanUrl === '/cosmetics/owner' ||
              cleanUrl === '/cosmetics/owner/' ||
              cleanUrl === '/cosmetics' ||
              cleanUrl === '/cosmetics/' ||
              cleanUrl === '/apps/cosmetics/owner' ||
              cleanUrl === '/apps/cosmetics/owner/'
            ) {
              const htmlPath = path.resolve(__dirname, 'cosmetics/owner/index.html');
              if (fs.existsSync(htmlPath)) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(fs.readFileSync(htmlPath));
                return;
              }
            }

            if (
              cleanUrl === '/owner' ||
              cleanUrl === '/owner/' ||
              cleanUrl === '/apps/owner' ||
              cleanUrl === '/apps/owner/'
            ) {
              const ownerPath = path.resolve(__dirname, 'owner/index.html');
              if (fs.existsSync(ownerPath)) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(fs.readFileSync(ownerPath));
                return;
              }
            }

            if (
              cleanUrl === '/customer' ||
              cleanUrl === '/customer/' ||
              cleanUrl === '/apps/customer' ||
              cleanUrl === '/apps/customer/'
            ) {
              const customerPath = path.resolve(__dirname, 'apps/customer/index.html');
              if (fs.existsSync(customerPath)) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(fs.readFileSync(customerPath));
                return;
              }
            }

            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          'owner-standalone': path.resolve(__dirname, 'owner/index.html'),
          'cosmetics-owner-standalone': path.resolve(__dirname, 'cosmetics/owner/index.html'),
          'apps-customer': path.resolve(__dirname, 'apps/customer/index.html'),
          'apps-owner': path.resolve(__dirname, 'apps/owner/index.html'),
          'apps-admin': path.resolve(__dirname, 'apps/admin/index.html'),
          'cosmetics-customer': path.resolve(__dirname, 'apps/cosmetics/customer/index.html'),
          'cosmetics-owner': path.resolve(__dirname, 'apps/cosmetics/owner/index.html'),
          'cosmetics-admin': path.resolve(__dirname, 'apps/cosmetics/admin/index.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

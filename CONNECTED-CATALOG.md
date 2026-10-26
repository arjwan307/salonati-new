# النشر الحقيقي للخدمات بعد موافقة الإدارة

## الروابط

- الكابتن: https://salonati-captain-new.mohmmed1628.workers.dev/
- مراجعة الإدارة: https://salonati-captain-new.mohmmed1628.workers.dev/admin/moderation
- الزبونة المرتبطة: https://salonati-captain-new.mohmmed1628.workers.dev/customer/

هذه نسخة الفرع new. رابط Google AI Studio القديم لا يتحدث بمجرد تعديل GitHub؛ يجب إعادة نشره من الفرع الجديد ليقرأ public/customer-catalog.js. لا تغيّر main تلقائيًا.

## الدورة

1. صاحبة الصالون تنشئ حسابها من المزيد، وتدخل اسم الصالون والمنطقة الفعليين.
2. تختار القسم (hair/makeup/skin/nails) والاسم والسعر والمدة والوسائط والخصم وتضغط إرسال إلى الإدارة.
3. الملفات تحفظ في R2 بشكل خاص. الإصدارات الجديدة pending في D1، ولا تدخل القائمة العامة.
4. الإدارة تسجل الدخول وتراجع الوسائط والسعرين والقسم وبداية الخصم ونهايته، ثم توافق أو ترفض مع سبب.
5. المؤشر published_revision يتغير عند اعتماد أحدث إصدار فقط. التعديل المعلق أو المرفوض لا يغيّر النسخة السابقة المعتمدة.
6. public/customer-catalog.js يعرض النسخ المعتمدة فقط في القسم الصحيح، وفي الخصومات أثناء الفترة فقط، ويعيد القراءة كل 30 ثانية وعند العودة للتطبيق.
7. سعر الخدمة الأصلي يبقى محفوظًا، ويعود للظهور بعد انتهاء الخصم.

## التخزين والصلاحيات

- D1 الجديدة: salonati-approved-catalog-20261026 / 9b67f616-4054-45d2-8c25-ecf304e98155، binding MODERATION_DB.
- R2: salonati-media-2026، binding MEDIA؛ الملفات الجديدة تحت moderated/<owner-id>/<media-id>.
- BOOKING_API binding القديم باقٍ لخدمة الحجوزات السابقة، دون تغيير سر QR أو قواعدها.
- حسابات الكتالوج وجلساتها منفصلة عن مصادقة الحجوزات السابقة. هذا التحديث لا يدّعي اكتمال ربط حساب الكتالوج بماسح الاستقبال أو الدفع.
- كلمة المرور PBKDF2-SHA256، 100000 دورة وsalt مستقل. الجلسة random 256-bit، محفوظة في الخادم كـ SHA256، وCookie HttpOnly/Secure/SameSite=Strict.
- كل تعديل يتطلب Origin مطابقًا، وهوية صاحب الصالون، وملكية الخدمة والوسائط. الإدارة وحدها تراجع، مع سجل audit.
- MIME مسموح وتوقيع الملف وحجم أقصى 20MiB تُفحص على الخادم. لا SVG/HTML. الوسائط المعلقة لا تُخدم للعامة حتى لو عُرف رابطها.
- إنشاء الإدارة عبر رابط تهيئة عشوائي لمرة واحدة، hash فقط في إعداد الخادم، بمدة صلاحية محددة؛ كلمة المرور يكتبها المستخدم داخل النموذج، وليست في المستودع. حساب admin واحد؛ لا يوجد استرجاع كلمة مرور بالبريد بعد.
- إنشاء حساب صاحبة الصالون لا يثبت ملكية الاسم التجاري أو صحة البريد؛ على الإدارة التحقق من الهوية قبل اعتماد المحتوى.

## البناء

node server/build-preview.mjs /tmp/salonati-connected-worker.mjs

ينسخ البناء مصادر التطبيقات إلى Worker للمعاينة المرتبطة. لا تشغّل إعدادات نشر المستودع القديم. metadata: compatibility_date=2026-10-26، MODERATION_DB وMEDIA وBOOKING_API، مع إبقاء secret_text عند تحديث النشر. ADMIN_SETUP_HASH سر، وADMIN_SETUP_EXPIRES وقت انتهاء التهيئة بالميلي ثانية.

## التحقق

test/moderation-browser.js محروس باسم نطاق salonati-moderation-test- ولا يعمل على الإنتاج. اختُبرت دورة التسجيل ورفع PNG والإرسال والخصوصية والفصل بين صالونين ورفض اعتماد صاحبة الصالون وموافقة الإدارة والرفض والتعديل وإعادة الاعتماد ومنع تكرار الموافقة. اختُبرت الزبونة في makeup والخصومات مع الصورة والسعر القديم ووقت الانتهاء، وعدم ظهور الطلب المعلق أو الخدمة في hair. لم تُنشأ بيانات اختبار داخل قاعدة النشر الفعلية.

نسخة الواجهة تستخدم بوابة نشر حقيقية الآن؛ لا تستخدم وظائف الحفظ المحلي القديمة لنشر الخدمات. SERVICES.md وRECEPTION.md الأقدم يوثّقان المراحل السابقة؛ هذا الملف هو المرجع الحالي لكتالوج الخدمات.

## تحديث المنتجات والمعرض والحسابات والموقع

- المنتجات لها إصدارات منفصلة في catalog_products/catalog_product_revisions. الإضافة وتغيير السعر والصورة والكمية يرسلون للإدارة؛ النسخة السابقة تبقى حتى الموافقة. JPG/PNG/GIF/WebP فقط للمنتجات، والصورة مطلوبة. لا يعلن هذا التحديث وجود checkout جديد؛ الكتالوج وعرض المنتجات مربوطان، ومصادر الطلبات والتوصيل الفعلية هي النظام السابق المعتمد.
- «المعرض» مستقل في الشريط السفلي. الرفع والإضافة والتعديل داخل المزيد، مع أيقونات تفتح الوسائط وأزرار تعديل/حذف للمحتوى الخاص بالصالون. إعلانات إدارة التطبيق للعرض فقط.
- الصور/الإعلانات المستقلة لها قائمة مكان ظهور: صفحة الصالون، الرئيسية، الشعر، المكياج، البشرة، الأظافر، المنتجات، الخصومات. أحدث صورة/إعلان يظهر في صفحة الصالون مباشرة بطلب المستخدم حتى لو كان اعتماد الظهور العام معلقًا أو مرفوضًا. الظهور في الأقسام العامة يتطلب موافقة الإدارة. هذا الاستثناء لا ينشر أسعار الخدمات أو المنتجات المعلقة في أقسامها العامة.
- سعر/ميزانية الإعلان يكتبه الصالون بوصفه قيمة متفقًا عليها. لا ينشر إعلان في قسم عام دون اتفاق مستحقات مقبول من الصالون. تستحق رسوم الإعلان مرة واحدة عند أول نشر عام، ولا تكرر عند تعديل الإعلان نفسه.
- الاتفاقات تدعم مبلغًا ثابتًا أو نسبة أو الاثنين لكل من الخدمات والمنتجات والإعلانات. جميع المبالغ IQD صحيحة والنسب basis points. النسبة تقرّب لأقرب دينار ثم يضاف الثابت. لا قيم مالية افتراضية. الإدارة تقترح والصالون يقبل؛ لا احتساب رجعي قبل القبول ولا إعادة كتابة للمستحقات السابقة.
- لوحة الإدارة تربط حساب الصالون بمصدر الصالون في نظام الحجوزات وبالمتجر في نظام التوصيل؛ لا تطابق تلقائيًا بالاسم. LEGACY_DB هو efbccf0d-b92b-4a86-a0eb-1e33a569131e. خدمات منفذة موثقة عبر booking_execution.started_at، ومنتجات مسلمة موثقة عبر product_delivery_qr.consumed_at/status delivered تُرحَّل بمفاتيح فريدة لمنع التكرار. أجور التوصيل مستبعدة من أساس عمولة المنتج.
- حسابات الصالون تفصل قبض الزبائن وتسويات الوسيط ومستحقات الإدارة والمسدّد لها. تأكيد التنفيذ/التسليم لا يخلق قبضًا. سند القبض الفعلي له مرجع ومفتاح idempotency ولا يمكن أن يتجاوز المتبقي، حتى مع التزامن. الإعلانات ليست إيراد بيع للصالون ولا يُقبل سند قبض زبونة مقابل حدث إعلان.
- طباعة كشف الحساب متاحة من حسابات الصالون. لا تعديل أو حذف للقيود عبر الواجهة.
- ماسح التسليم موجود ضمن الحسابات. التفويض يمنح من الإدارة لحساب مرتبط بمشغل توصيل موجود فعليًا في النظام السابق. لا يكفي حساب الصالون وحده. تحقق SLP1/hash وشركة الوسيط وحالة الطلب وانتهاء الرمز قبل UPDATE ذري؛ محفزات قاعدة الطلبات السابقة تؤكد التسليم وتسجل إشعار الإدارة. لا تحصيل نقدي تلقائي. الاتفاق والربط مطلوبان قبل التسليم من هذا المسار. إن تأخرت المزامنة المالية يبقى التسليم مؤكدًا وتستكمل الحسابات عند التحديث.
- جلب الموقع بإذن المتصفح من التسجيل أو بيانات الصالون. latitude/longitude محفوظان بالحساب، ويتاحان للزبونة على الخريطة مع صورة مصغرة من محتوى الصالون أو رمز صالوناتي عند عدم وجود صورة. الموقع يضاف لطلب التسجيل ولا يتتبع في الخلفية.
- خريطة الاستكشاف تطلب موقع الزبونة عند فتحها، تتمركز عليه، وتحسب المسافة التقريبية وترتب الصالونات المسجلة الأقرب. إحداثيات الزبونة في ذاكرة الصفحة ولا ترسل للخادم. عند رفض الإذن يبقى البحث متاحًا. يستخدم Google Maps المضاف أصلًا؛ نجاح تحميله يعتمد على مفتاح الخرائط وإعدادات نطاقه. فحص منطق الموقع استعمل GPS وخرائط محاكيين في جلسة اختبار مستقلة، وليس كاميرا أو GPS هاتف فعلي.

### ملفات الترحيل

شغّل products-schema.sql ثم accounting-schema.sql ثم advertisements-schema.sql. على قاعدة موجودة دون عمودي latitude/longitude تُطبق location-migration.sql مرة واحدة فقط؛ schema.sql للقواعد الجديدة يحتويهما بالفعل. لا تمسح أو تعيد إنشاء بيانات الإنتاج.

### التحقق المعزول

نجحت دورات الخدمات والمنتجات، وخصوصية الوسائط قبل الموافقة، ورفض الوصول بين الصالونات، وتحديث الأسعار بعد الاعتماد فقط، وإعلانات صفحة الصالون التلقائية مقابل اعتماد الأقسام العامة، والاتفاق الثابت مع النسبة، وعدم إنشاء وارد قبل حدث فعلي، ومنع تكرار العمولة أو القبض أو تجاوز الرصيد عند التزامن، ومسح تسليم صحيح مرة واحدة وإشعار الإدارة. نجحت اختبارات المعرض وفتح الصورة والتعديل في المزيد وحفظ GPS على الخادم وخريطة الزبونة بالصورة المصغرة والترتيب حسب الموقع. جميع Fixtures في قاعدة وحاوية اختبار مستقلتين؛ لا Fixtures مالية في الإنتاج.


## Registration approval and management campaigns (2026-10-26)
Salon signup now collects the responsible person's name, phone, detailed address, GPS and facade image. After account creation the image is uploaded and an explicit registration request is submitted; a failed upload leaves the account able to complete/resubmit its request from More. Public catalog, salon gallery media and map include only approved registrations. Admin reviews use the submitted revision to reject stale decisions; pending name/location edits go through resubmission. Approved facade becomes the public map thumbnail. Customer catalog checks for changes every five seconds without re-rendering unchanged datasets.

Admin sections: home (salons grouped by booking, one icon per booking), new registrations, approved salons, notifications (service/product/salon-ad moderation), finance, management advertisements, settings. Management campaigns are separate from salon advertisements; every campaign appears in the existing management-ad slots in both apps, with an optional additional customer placement. Only admin may upload, create, update, stop or delete management campaigns.

The user explicitly authorized database-backed removable display data because there were no actual salon accounts/bookings. Four customer sample salons were migrated into database records; the customer inline salons list is empty so deleted display salons are not recreated on reload. Display records use reserved `display.invalid` emails, disabled password digests, and all-zero phone placeholders. Four approved salons, two pending registrations, 19 bookings (10/4/3/2), pending products and salon advertisements, three management campaigns and sample financial statements were inserted. No fixture records are embedded into application JS. `catalog_sample_owners`, `catalog_sample_campaigns` and legacy `salonati_sample_entities` track the inserted records. Settings can delete only these tracked records; the real administrator and any subsequent normal salon remain. Sample image URLs reuse the customer's existing Unsplash references and are proxied only for tracked sample owners.

Migrations: run `registrations-schema.sql` and `campaigns-schema.sql` additively. All earlier schemas remain required.
Validation: `node server/build-preview.mjs`, `node test/registrations-campaigns.mjs` (30 API assertions using in-memory SQLite + R2), `node test/admin-bookings-auth.mjs`. Optional fixture/deletion validation: pass isolated catalog seed SQL, legacy seed SQL and legacy schema as three arguments (43 total checks). Mobile browser validation covered request modal, approval transition, facade, ten booking icons, campaign editing payload, deletion control and no overflow. No production samples were deleted during validation.

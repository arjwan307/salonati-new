# اختبارات الربط

الاختبارات browser scripts وليست اختبارات إنتاج. ترفض العمل إلا على اسم Worker يبدأ salonati-moderation-test-. أنشئ D1 وR2 مستقلين، وطبّق schema.sql وproducts-schema.sql وaccounting-schema.sql وadvertisements-schema.sql، ثم انشر build-preview.mjs على Worker الاختبار، مع ADMIN_SETUP_HASH لكلمة تهيئة الاختبار الموجودة في moderation-browser.js. لا تستخدم مفتاح تهيئة الإنتاج أو قواعده.

الترتيب الأساسي: moderation-browser.js ثم products-browser.js. يجهّزان حسابَي owner منفصلين وحساب admin وصورًا مستقلة. ads-finance-browser.js وreceipts-browser.js وdelivery-ledger-browser.js يحتاجون Fixtures لنظام الطلبات السابق في LEGACY_DB المعزولة، وروابط المتجر والصالون الوهمية المذكورة في هذه الاختبارات. يجب أن تحاكي محفزات product_delivery_validate/product_delivery_apply الأصلية، وإلا لا يعتبر فحص التسليم مطابقًا للنظام الفعلي.

gallery-map-browser.js يحتوي testOwnerGallery وtestCustomerMap. فحص الخريطة يحاكي Google Maps وGPS فقط للتحقق من ترتيب الصالونات وتمركز الخريطة والصورة المصغرة؛ لا يدّعي فحص هاتف أو صلاحيات مفتاح Google.

بعد الفحص احذف فقط Worker وقاعدة وحاوية الاختبار التي أنشأتها، وملفاتها. لا تنفذ أوامر DELETE/إعادة تهيئة على قواعد الإنتاج. لم تسجل الاختبارات قيودًا مالية أو منتجات في الإنتاج.

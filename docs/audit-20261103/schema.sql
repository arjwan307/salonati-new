CREATE TABLE catalog_accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,role TEXT NOT NULL CHECK(role IN('owner','admin')),salt TEXT NOT NULL,digest TEXT NOT NULL,salon_name TEXT NOT NULL DEFAULT '',area TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, latitude REAL, longitude REAL);
CREATE TABLE catalog_ad_revisions(id TEXT PRIMARY KEY,ad_id TEXT NOT NULL REFERENCES catalog_advertisements(id),owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),title TEXT NOT NULL,placement TEXT NOT NULL CHECK(placement IN('salon','home','hair','makeup','skin','nails','products','discounts')),media_id TEXT NOT NULL REFERENCES catalog_media(id),budget INTEGER NOT NULL DEFAULT 0 CHECK(budget>=0),active INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL CHECK(status IN('pending','approved','rejected')),reason TEXT NOT NULL DEFAULT '',reviewer TEXT REFERENCES catalog_accounts(id),reviewed_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE catalog_admin_expenses(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES catalog_accounts(id),description TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),reference TEXT NOT NULL DEFAULT '',expense_date TEXT NOT NULL,recorded_by TEXT NOT NULL REFERENCES catalog_accounts(id),recorded_at TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE);
CREATE TABLE catalog_admin_payments(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),amount INTEGER NOT NULL CHECK(amount>0),reference TEXT NOT NULL,recorded_by TEXT NOT NULL REFERENCES catalog_accounts(id),recorded_at TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE);
CREATE TABLE catalog_admin_staff(account_id TEXT PRIMARY KEY REFERENCES catalog_accounts(id),name TEXT NOT NULL,permissions TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),created_by TEXT NOT NULL REFERENCES catalog_accounts(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE catalog_admin_staff_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES catalog_accounts(id),staff_id TEXT NOT NULL REFERENCES catalog_accounts(id),action TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE catalog_advertisements(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),latest_revision TEXT,published_revision TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE catalog_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id TEXT NOT NULL,revision_id TEXT NOT NULL,event TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE catalog_booking_blocks (owner_id TEXT NOT NULL, slot_date TEXT NOT NULL, slot_time TEXT NOT NULL, service_id TEXT NOT NULL DEFAULT '*', PRIMARY KEY(owner_id,slot_date,slot_time,service_id));
CREATE TABLE catalog_campaigns(id TEXT PRIMARY KEY,title TEXT NOT NULL,copy TEXT NOT NULL DEFAULT '',media_id TEXT NOT NULL REFERENCES catalog_media(id),placements TEXT NOT NULL DEFAULT '["management"]',active INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL REFERENCES catalog_accounts(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE catalog_cash_receipts(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),event_id TEXT NOT NULL REFERENCES catalog_financial_events(id),amount INTEGER NOT NULL CHECK(amount>0),channel TEXT NOT NULL CHECK(channel IN('customer','courier')),reference TEXT NOT NULL,recorded_at TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE);
CREATE TABLE catalog_customer_accounts(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,name TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',salt TEXT NOT NULL,digest TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE catalog_customer_sessions(token_hash TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES catalog_customer_accounts(id),expires_at TEXT NOT NULL);
CREATE TABLE catalog_delivery_grants(account_id TEXT PRIMARY KEY REFERENCES catalog_accounts(id),legacy_courier_id TEXT NOT NULL,granted_by TEXT NOT NULL REFERENCES catalog_accounts(id),created_at TEXT NOT NULL);
CREATE TABLE catalog_fee_agreements(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),service_fixed INTEGER NOT NULL CHECK(service_fixed>=0),service_bps INTEGER NOT NULL CHECK(service_bps BETWEEN 0 AND 10000),product_fixed INTEGER NOT NULL CHECK(product_fixed>=0),product_bps INTEGER NOT NULL CHECK(product_bps BETWEEN 0 AND 10000),ad_fixed INTEGER NOT NULL CHECK(ad_fixed>=0),ad_bps INTEGER NOT NULL CHECK(ad_bps BETWEEN 0 AND 10000),status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN('proposed','accepted','rejected')),created_by TEXT NOT NULL REFERENCES catalog_accounts(id),created_at TEXT NOT NULL,accepted_at TEXT);
CREATE TABLE catalog_financial_events(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),kind TEXT NOT NULL CHECK(kind IN('service','product','ad')),source_id TEXT NOT NULL,base_amount INTEGER NOT NULL CHECK(base_amount>=0),admin_due INTEGER NOT NULL CHECK(admin_due>=0),agreement_id TEXT NOT NULL REFERENCES catalog_fee_agreements(id),occurred_at TEXT NOT NULL,UNIQUE(kind,source_id));
CREATE TABLE catalog_guest_sessions(token_hash TEXT PRIMARY KEY,customer_id TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL);
CREATE TABLE catalog_live_bookings(
 id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),customer_id TEXT NOT NULL,
 customer_name TEXT NOT NULL,phone TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',services TEXT NOT NULL,
 starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,total INTEGER NOT NULL CHECK(total>=0),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','confirmed','cancelled','completed')),
 request_key TEXT NOT NULL UNIQUE,request_hash TEXT NOT NULL,created_at TEXT NOT NULL,
 nonce TEXT,token_hash TEXT,expires_at TEXT,confirmed_at TEXT,started_at TEXT,
 agreement_id TEXT REFERENCES catalog_fee_agreements(id),admin_due INTEGER CHECK(admin_due>=0)
);
CREATE TABLE catalog_loyalty_rewards(booking_id TEXT PRIMARY KEY REFERENCES catalog_live_bookings(id),owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),customer_id TEXT NOT NULL,service_id TEXT NOT NULL,discount INTEGER NOT NULL CHECK(discount>=0));
CREATE TABLE catalog_loyalty_settings(owner_id TEXT PRIMARY KEY REFERENCES catalog_accounts(id),service_id TEXT NOT NULL REFERENCES catalog_services(id),updated_at TEXT NOT NULL);
CREATE TABLE catalog_media(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),object_key TEXT NOT NULL UNIQUE,mime TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE catalog_payment_notifications(payment_id TEXT PRIMARY KEY REFERENCES catalog_admin_payments(id),owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),read_at TEXT);
CREATE TABLE catalog_product_revisions(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES catalog_products(id),owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',price INTEGER NOT NULL CHECK(price>=0),stock INTEGER NOT NULL CHECK(stock>=0),active INTEGER NOT NULL DEFAULT 1,media_id TEXT NOT NULL REFERENCES catalog_media(id),status TEXT NOT NULL CHECK(status IN('pending','approved','rejected')),reason TEXT NOT NULL DEFAULT '',reviewer TEXT REFERENCES catalog_accounts(id),reviewed_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE catalog_products(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),latest_revision TEXT,published_revision TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE catalog_rate(key TEXT PRIMARY KEY,hits INTEGER NOT NULL DEFAULT 1,expires_at INTEGER NOT NULL);
CREATE TABLE catalog_registrations(
 owner_id TEXT PRIMARY KEY REFERENCES catalog_accounts(id),
 contact_name TEXT NOT NULL,phone TEXT NOT NULL,address TEXT NOT NULL,
 facade_media_id TEXT NOT NULL REFERENCES catalog_media(id),
 status TEXT NOT NULL CHECK(status IN('pending','approved','rejected')),
 reason TEXT NOT NULL DEFAULT '',revision INTEGER NOT NULL DEFAULT 1,
 submitted_at TEXT NOT NULL,reviewed_at TEXT,reviewer TEXT REFERENCES catalog_accounts(id)
);
CREATE TABLE catalog_revisions(id TEXT PRIMARY KEY,service_id TEXT NOT NULL REFERENCES catalog_services(id),owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),name TEXT NOT NULL,category TEXT NOT NULL CHECK(category IN('hair','makeup','skin','nails')),price INTEGER NOT NULL CHECK(price>=0),minutes INTEGER NOT NULL CHECK(minutes>0),active INTEGER NOT NULL DEFAULT 1,media_id TEXT REFERENCES catalog_media(id),discount_price INTEGER,discount_start TEXT,discount_end TEXT,status TEXT NOT NULL CHECK(status IN('pending','approved','rejected')),reason TEXT NOT NULL DEFAULT '',reviewer TEXT REFERENCES catalog_accounts(id),reviewed_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,CHECK((discount_price IS NULL AND discount_start IS NULL AND discount_end IS NULL) OR(discount_price>0 AND discount_price<price AND discount_start IS NOT NULL AND discount_end>discount_start)));
CREATE TABLE catalog_sample_campaigns(campaign_id TEXT PRIMARY KEY);
CREATE TABLE catalog_sample_owners(owner_id TEXT PRIMARY KEY,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE catalog_services(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),latest_revision TEXT,published_revision TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE catalog_sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES catalog_accounts(id),expires_at TEXT NOT NULL);
CREATE TABLE catalog_source_links(kind TEXT NOT NULL CHECK(kind IN('salon','store')),source_id TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),PRIMARY KEY(kind,source_id));
CREATE TABLE catalog_team(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),name TEXT NOT NULL,specialty TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE catalog_visit_ratings(booking_id TEXT PRIMARY KEY REFERENCES catalog_live_bookings(id),owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),customer_id TEXT NOT NULL,stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),created_at TEXT NOT NULL);
CREATE TABLE catalog_visual_salons(ui_id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id TEXT NOT NULL UNIQUE REFERENCES catalog_accounts(id));
CREATE TABLE catalog_visual_services(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),ui_id INTEGER,service_id TEXT NOT NULL UNIQUE REFERENCES catalog_services(id),UNIQUE(owner_id,ui_id));
CREATE TABLE catalog_workflow_notifications(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL REFERENCES catalog_live_bookings(id),owner_id TEXT NOT NULL,event TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(booking_id,event));
CREATE TABLE cosmetics_media (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),
 object_key TEXT NOT NULL UNIQUE,
 mime TEXT NOT NULL,
 size INTEGER NOT NULL
);
CREATE TABLE cosmetics_orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),
 customer_id TEXT NOT NULL REFERENCES catalog_customer_accounts(id),
 request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 customer_name TEXT NOT NULL,
 phone TEXT NOT NULL,
 address TEXT NOT NULL,
 items_json TEXT NOT NULL,
 total INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','completed')),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 transition_key TEXT NOT NULL DEFAULT '',
 UNIQUE(customer_id, request_key)
);
CREATE TABLE cosmetics_owner_state (
 owner_id TEXT PRIMARY KEY REFERENCES catalog_accounts(id),
 state_json TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
 review_reason TEXT NOT NULL DEFAULT '',
 published_json TEXT,
 updated_at TEXT NOT NULL,
 reviewed_by TEXT REFERENCES catalog_accounts(id)
);
CREATE TABLE salonati_admin_account_controls (app TEXT NOT NULL CHECK(app IN ('salon','cosmetics')),owner_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','suspended','deleted')), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(app,owner_id));
CREATE TABLE salonati_notification_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE salonati_offer_notifications(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,title TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE salonati_phone_identities (app TEXT NOT NULL CHECK(app IN ('admin','salon','cosmetics','customer')),phone TEXT NOT NULL,account_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(app,phone),UNIQUE(app,account_id));
CREATE TABLE salonati_push_subscriptions(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES catalog_customer_accounts(id),token_hash TEXT NOT NULL,endpoint TEXT NOT NULL,last_seq INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE salonati_support_contacts (id INTEGER PRIMARY KEY CHECK(id=1), phone TEXT NOT NULL DEFAULT '', whatsapp TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

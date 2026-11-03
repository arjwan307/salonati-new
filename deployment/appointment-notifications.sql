ALTER TABLE salonati_push_subscriptions ADD COLUMN p256dh TEXT;
ALTER TABLE salonati_push_subscriptions ADD COLUMN auth TEXT;
CREATE TABLE salonati_customer_notifications(
 id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES catalog_customer_accounts(id) ON DELETE CASCADE,
 booking_id TEXT NOT NULL REFERENCES catalog_live_bookings(id) ON DELETE CASCADE,
 starts_at TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN('reminder24','reminder3')),
 title TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,read_at TEXT,
 UNIQUE(booking_id,starts_at,kind)
);
CREATE INDEX salonati_customer_notifications_unread ON salonati_customer_notifications(customer_id,read_at);
CREATE TABLE salonati_notification_reads(customer_id TEXT PRIMARY KEY REFERENCES catalog_customer_accounts(id) ON DELETE CASCADE,offer_seq INTEGER NOT NULL DEFAULT 0);
CREATE TABLE salonati_notification_deliveries(
 subscription_id TEXT NOT NULL REFERENCES salonati_push_subscriptions(id) ON DELETE CASCADE,
 notification_id TEXT NOT NULL REFERENCES salonati_customer_notifications(id) ON DELETE CASCADE,
 delivered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(subscription_id,notification_id)
);

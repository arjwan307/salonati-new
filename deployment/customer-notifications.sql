CREATE TABLE IF NOT EXISTS salonati_notification_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS salonati_offer_notifications(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,title TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS salonati_push_subscriptions(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES catalog_customer_accounts(id),token_hash TEXT NOT NULL,endpoint TEXT NOT NULL,last_seq INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS salonati_push_pending ON salonati_push_subscriptions(last_seq);
INSERT OR IGNORE INTO salonati_notification_settings(key,value) VALUES('started_at',CURRENT_TIMESTAMP);

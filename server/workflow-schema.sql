CREATE TABLE IF NOT EXISTS catalog_live_bookings(
 id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),customer_id TEXT NOT NULL,
 customer_name TEXT NOT NULL,phone TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',services TEXT NOT NULL,
 starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,total INTEGER NOT NULL CHECK(total>=0),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','confirmed','cancelled','completed')),
 request_key TEXT NOT NULL UNIQUE,request_hash TEXT NOT NULL,created_at TEXT NOT NULL,
 nonce TEXT,token_hash TEXT,expires_at TEXT,confirmed_at TEXT,started_at TEXT,
 agreement_id TEXT REFERENCES catalog_fee_agreements(id),admin_due INTEGER CHECK(admin_due>=0)
);
CREATE INDEX IF NOT EXISTS catalog_live_owner_bookings ON catalog_live_bookings(owner_id,starts_at,status);
CREATE INDEX IF NOT EXISTS catalog_live_customer_bookings ON catalog_live_bookings(customer_id,starts_at);
CREATE TRIGGER IF NOT EXISTS catalog_live_no_overlap BEFORE INSERT ON catalog_live_bookings
WHEN NEW.status IN('pending','confirmed') AND EXISTS(SELECT 1 FROM catalog_live_bookings b WHERE b.owner_id=NEW.owner_id AND b.status IN('pending','confirmed') AND b.starts_at<NEW.ends_at AND b.ends_at>NEW.starts_at)
BEGIN SELECT RAISE(ABORT,'slot_unavailable'); END;
CREATE TABLE IF NOT EXISTS catalog_workflow_notifications(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL REFERENCES catalog_live_bookings(id),owner_id TEXT NOT NULL,event TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(booking_id,event));

CREATE TABLE IF NOT EXISTS catalog_loyalty_settings(owner_id TEXT PRIMARY KEY REFERENCES catalog_accounts(id),service_id TEXT NOT NULL REFERENCES catalog_services(id),updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS catalog_loyalty_rewards(booking_id TEXT PRIMARY KEY REFERENCES catalog_live_bookings(id),owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),customer_id TEXT NOT NULL,service_id TEXT NOT NULL,discount INTEGER NOT NULL CHECK(discount>=0));
CREATE INDEX IF NOT EXISTS catalog_loyalty_customer ON catalog_loyalty_rewards(owner_id,customer_id);
CREATE TRIGGER IF NOT EXISTS catalog_loyalty_reserve BEFORE INSERT ON catalog_loyalty_rewards
WHEN (SELECT COUNT(*) FROM catalog_live_bookings b WHERE b.owner_id=NEW.owner_id AND b.customer_id=NEW.customer_id AND b.status='completed' AND NOT EXISTS(SELECT 1 FROM catalog_loyalty_rewards r WHERE r.booking_id=b.id)) < 3*(1+(SELECT COUNT(*) FROM catalog_loyalty_rewards r JOIN catalog_live_bookings b ON b.id=r.booking_id WHERE r.owner_id=NEW.owner_id AND r.customer_id=NEW.customer_id AND b.status IN('pending','confirmed','completed')))
BEGIN SELECT RAISE(ABORT,'reward_unavailable'); END;
CREATE TABLE IF NOT EXISTS catalog_visit_ratings(booking_id TEXT PRIMARY KEY REFERENCES catalog_live_bookings(id),owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),customer_id TEXT NOT NULL,stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),created_at TEXT NOT NULL);

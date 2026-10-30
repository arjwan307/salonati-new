CREATE TABLE IF NOT EXISTS cosmetics_owner_state (
 owner_id TEXT PRIMARY KEY REFERENCES catalog_accounts(id),
 state_json TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
 review_reason TEXT NOT NULL DEFAULT '',
 published_json TEXT,
 updated_at TEXT NOT NULL,
 reviewed_by TEXT REFERENCES catalog_accounts(id)
);
CREATE TABLE IF NOT EXISTS cosmetics_media (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),
 object_key TEXT NOT NULL UNIQUE,
 mime TEXT NOT NULL,
 size INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cosmetics_orders (
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
CREATE INDEX IF NOT EXISTS cosmetics_orders_owner ON cosmetics_orders(owner_id,created_at);
CREATE INDEX IF NOT EXISTS cosmetics_orders_customer ON cosmetics_orders(customer_id,created_at);

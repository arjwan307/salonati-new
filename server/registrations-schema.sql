CREATE TABLE IF NOT EXISTS catalog_registrations(
 owner_id TEXT PRIMARY KEY REFERENCES catalog_accounts(id),
 contact_name TEXT NOT NULL,phone TEXT NOT NULL,address TEXT NOT NULL,
 facade_media_id TEXT NOT NULL REFERENCES catalog_media(id),
 status TEXT NOT NULL CHECK(status IN('pending','approved','rejected')),
 reason TEXT NOT NULL DEFAULT '',revision INTEGER NOT NULL DEFAULT 1,
 submitted_at TEXT NOT NULL,reviewed_at TEXT,reviewer TEXT REFERENCES catalog_accounts(id)
);
CREATE INDEX IF NOT EXISTS catalog_registration_queue ON catalog_registrations(status,submitted_at);

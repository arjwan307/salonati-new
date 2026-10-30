-- Additive login aliases. Existing accounts and password hashes stay intact.
CREATE TABLE IF NOT EXISTS salonati_phone_identities (
  app TEXT NOT NULL CHECK(app IN ('admin','salon','cosmetics','customer')),
  phone TEXT NOT NULL,
  account_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(app, phone),
  UNIQUE(app, account_id)
);

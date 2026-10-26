CREATE TABLE IF NOT EXISTS catalog_visual_salons(ui_id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id TEXT NOT NULL UNIQUE REFERENCES catalog_accounts(id));
CREATE TABLE IF NOT EXISTS catalog_visual_services(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),ui_id INTEGER,service_id TEXT NOT NULL UNIQUE REFERENCES catalog_services(id),UNIQUE(owner_id,ui_id));
CREATE TABLE IF NOT EXISTS catalog_guest_sessions(token_hash TEXT PRIMARY KEY,customer_id TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS catalog_team(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES catalog_accounts(id),name TEXT NOT NULL,specialty TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1);

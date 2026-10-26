CREATE TABLE IF NOT EXISTS catalog_campaigns(id TEXT PRIMARY KEY,title TEXT NOT NULL,copy TEXT NOT NULL DEFAULT '',media_id TEXT NOT NULL REFERENCES catalog_media(id),placements TEXT NOT NULL DEFAULT '["management"]',active INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL REFERENCES catalog_accounts(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS catalog_sample_owners(owner_id TEXT PRIMARY KEY,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS catalog_sample_campaigns(campaign_id TEXT PRIMARY KEY);

CREATE TABLE IF NOT EXISTS salonati_content_checks(
 content_hash TEXT PRIMARY KEY,policy_version TEXT NOT NULL,allowed INTEGER NOT NULL CHECK(allowed IN(0,1)),
 reason TEXT NOT NULL,model TEXT NOT NULL,checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

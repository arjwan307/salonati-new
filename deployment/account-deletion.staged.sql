-- STAGED: apply only to an isolated test database until separately approved.
CREATE TABLE salonati_deletion_jobs(
 id TEXT PRIMARY KEY, subject_hash TEXT NOT NULL UNIQUE, app TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN('files_pending','complete')),
 approval_reference TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at TEXT
);
CREATE TABLE salonati_deletion_objects(
 job_id TEXT NOT NULL REFERENCES salonati_deletion_jobs(id),object_key TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN('pending','deleted','retained_shared')),
 attempts INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(job_id,object_key)
);

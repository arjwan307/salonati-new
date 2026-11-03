-- Apply once after deploying two-hour session issuance and explicit activity renewal.
-- Keep already-expired sessions expired; existing active sessions get at most two hours.
UPDATE catalog_sessions SET expires_at=datetime('now','+2 hours') WHERE julianday(expires_at)>julianday('now','+2 hours');
UPDATE catalog_customer_sessions SET expires_at=datetime('now','+2 hours') WHERE julianday(expires_at)>julianday('now','+2 hours');

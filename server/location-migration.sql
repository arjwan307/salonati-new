-- Apply once to existing catalog_accounts. Fresh schema.sql already includes these columns.
ALTER TABLE catalog_accounts ADD COLUMN latitude REAL;
ALTER TABLE catalog_accounts ADD COLUMN longitude REAL;

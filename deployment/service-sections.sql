-- Additive: existing revisions remain in the ordinary services section.
ALTER TABLE catalog_revisions ADD COLUMN section TEXT NOT NULL DEFAULT 'services' CHECK(section IN('services','hijab','brides'));

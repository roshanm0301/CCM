-- =============================================================================
-- Migration 015: Remove Case Category PostgreSQL tables
--
-- CONTEXT: case_categories and case_subcategories were created in migration 012
-- but the decision was made to store Case Category master data in MongoDB
-- (casecategories + casesubcategories collections) instead.
--
-- This migration drops the PostgreSQL tables. The MongoDB collections are
-- populated by the application on first use and seeded via
-- apps/api/src/scripts/seedReferenceMasters.ts.
--
-- RECOVERY PATH (if you need to roll back to PostgreSQL storage):
--   1. Re-run migration 012 to recreate the tables.
--   2. Update case-category.repository.ts to use getPool() queries instead
--      of Mongoose models.
--   3. Drop the MongoDB collections: db.casecategories.drop()
--      and db.casesubcategories.drop()
--
-- NOTE: Department reference values inserted into reference_values (PG) by
-- migration 012 are intentionally preserved — they serve as a backup and
-- are used by no other module. The authoritative source for Department lookups
-- is now the MongoDB referencemasters collection (masterType: 'department').
-- =============================================================================

DROP TABLE IF EXISTS case_subcategories;
DROP TABLE IF EXISTS case_categories;

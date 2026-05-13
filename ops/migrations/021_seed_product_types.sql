-- =============================================================================
-- Migration 021: Seed product_type reference values
--
-- Moves product type definitions from hardcoded service-layer constants into
-- the shared PostgreSQL reference_values table so that both the Case Category
-- master and the Activity Template master read from the same data source.
-- Source: CCM_Phase5_ActivityFlowConfiguration.md — Fix 12 (DA review)
--
-- Use ON CONFLICT DO UPDATE to make this migration idempotent (safe to re-run).
-- =============================================================================

INSERT INTO reference_values (reference_type, code, label, sort_order, is_active) VALUES
  ('product_type', 'Motorcycle',         'Motorcycle',         1, TRUE),
  ('product_type', 'Commercial Vehicle', 'Commercial Vehicle', 2, TRUE),
  ('product_type', 'Probiking',          'Probiking',          3, TRUE),
  ('product_type', 'Chetak',             'Chetak',             4, TRUE)
ON CONFLICT (reference_type, code)
DO UPDATE SET
  label      = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active,
  updated_at = NOW();

-- =============================================================================
-- Migration 012: Case Category Master
--
-- Creates case_categories and case_subcategories tables.
-- Seeds department reference values.
-- Source: CCM_Phase3_CaseCategory_Master.md
-- =============================================================================

-- 1. Seed department reference values
INSERT INTO reference_values (reference_type, code, label, sort_order, is_active) VALUES
  ('department', 'customer_service',  'Customer Service',    1, true),
  ('department', 'technical_support', 'Technical Support',   2, true),
  ('department', 'warranty_claims',   'Warranty & Claims',   3, true),
  ('department', 'parts_accessories', 'Parts & Accessories', 4, true),
  ('department', 'sales',             'Sales',               5, true)
ON CONFLICT (reference_type, code)
DO UPDATE SET
  label      = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. case_categories table
CREATE TABLE IF NOT EXISTS case_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(30)  NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  definition   VARCHAR(500) NOT NULL,
  departments   TEXT[]       NOT NULL DEFAULT '{}',
  case_natures  TEXT[]       NOT NULL DEFAULT '{}',
  product_types TEXT[]       NOT NULL DEFAULT '{}',
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT case_categories_code_unique UNIQUE (code),
  CONSTRAINT case_categories_name_unique UNIQUE (display_name)
);

CREATE INDEX IF NOT EXISTS idx_case_categories_is_active ON case_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_case_categories_code ON case_categories(code);

-- 3. case_subcategories table
CREATE TABLE IF NOT EXISTS case_subcategories (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id            UUID NOT NULL REFERENCES case_categories(id) ON DELETE CASCADE,
  code                   VARCHAR(30)  NOT NULL,
  display_name           VARCHAR(100) NOT NULL,
  definition             VARCHAR(500) NOT NULL,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  inactivated_by_cascade BOOLEAN NOT NULL DEFAULT false,
  created_by             UUID REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT case_subcategories_code_unique UNIQUE (code),
  CONSTRAINT case_subcategories_name_per_category UNIQUE (category_id, display_name)
);

CREATE INDEX IF NOT EXISTS idx_case_subcategories_category_id ON case_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_case_subcategories_is_active ON case_subcategories(is_active);

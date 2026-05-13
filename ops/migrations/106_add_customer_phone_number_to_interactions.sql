-- =============================================================================
-- Migration 106: Add customer_phone_number to interactions
--
-- Stores the customer phone number at the time the interaction was created or
-- context was confirmed. For CTI (inbound/outbound call) interactions the value
-- is backfilled from cti_from_number. For manually-created interactions the
-- value is populated when the agent confirms customer context.
-- =============================================================================

ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS customer_phone_number VARCHAR(50);

-- Backfill existing CTI interactions from cti_from_number
UPDATE interactions
  SET customer_phone_number = cti_from_number
  WHERE cti_from_number IS NOT NULL
    AND customer_phone_number IS NULL;

COMMENT ON COLUMN interactions.customer_phone_number IS
  'Customer phone number at time of interaction. Populated from CTI caller ID for call interactions; from customer master for manual interactions.';

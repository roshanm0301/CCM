ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_channel_check;
ALTER TABLE interactions ADD CONSTRAINT interactions_channel_check
  CHECK (channel IN ('manual', 'inbound_call'));

ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_mode_check;
ALTER TABLE interactions ADD CONSTRAINT interactions_mode_check
  CHECK (mode IN ('manual', 'inbound_call'));

ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS cti_cmiuuid     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cti_from_number VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_interactions_cti_cmiuuid
  ON interactions (cti_cmiuuid) WHERE cti_cmiuuid IS NOT NULL;

CREATE TABLE IF NOT EXISTS cti_call_logs (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cmiuuid              VARCHAR(100) NOT NULL UNIQUE,
  conversation_uuid    VARCHAR(100),
  direction            VARCHAR(20)  NOT NULL DEFAULT 'inbound',
  status               VARCHAR(20)  NOT NULL
                         CHECK (status IN ('waiting','answered','missed')),
  from_number          VARCHAR(50),
  to_number            VARCHAR(50),
  virtual_number       VARCHAR(50),
  telecmi_agent_id     VARCHAR(100),
  interaction_id       UUID         REFERENCES interactions(id) ON DELETE SET NULL,
  answered_sec         INT,
  duration_sec         INT,
  recording_filename   VARCHAR(300),
  hangup_reason        VARCHAR(100),
  team                 VARCHAR(100),
  ivr_name             VARCHAR(100),
  raw_payload          JSONB        NOT NULL DEFAULT '{}',
  event_at             TIMESTAMPTZ  NOT NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cti_call_logs_from_number
  ON cti_call_logs (from_number);
CREATE INDEX IF NOT EXISTS idx_cti_call_logs_interaction_id
  ON cti_call_logs (interaction_id) WHERE interaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cti_call_logs_status
  ON cti_call_logs (status);

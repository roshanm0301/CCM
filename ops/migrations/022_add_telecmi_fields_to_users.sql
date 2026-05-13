-- TeleCMI agent fields for CCM users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS telecmi_agent_id     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS telecmi_extension    INT,
  ADD COLUMN IF NOT EXISTS telecmi_sip_password VARCHAR(200),
  ADD COLUMN IF NOT EXISTS telecmi_phone_number VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telecmi_agent_id
  ON users (telecmi_agent_id) WHERE telecmi_agent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telecmi_extension
  ON users (telecmi_extension) WHERE telecmi_extension IS NOT NULL;

/**
 * CtiClientInitializer — mounts the TeleCMI SDK hook as a render-null component.
 *
 * Only rendered when sessionMode === 'cti'. This keeps the SDK lifecycle tied
 * to CTI sessions only, preventing TeleCMI from registering for manual-mode agents.
 *
 * Source: CCM Phase 1.5 — Mode Selection spec
 */

import { useCtiClient } from './useCtiClient';

export function CtiClientInitializer() {
  useCtiClient();
  return null;
}

// =============================================================================
// CCM API — CTI Config
//
// Reads TeleCMI-specific config from the central application config.
// =============================================================================

import { getConfig } from '../../config/index';

export function getCtiConfig() {
  const config = getConfig();
  return {
    appId: config.telecmiAppId,
    appSecret: config.telecmiAppSecret,
    sbcUri: config.telecmiSbcUri,
    /** Optional shared secret echoed as `custom` in TeleCMI webhook payloads. */
    webhookCustomValue: config.telecmiWebhookCustomValue,
    baseUrl: config.telecmiBaseUrl,
    /** DID/virtual number used as callerid for outbound click2call (digits only). */
    callerId: config.telecmiCallerId,
  };
}

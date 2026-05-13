// =============================================================================
// CCM API — CTI Types
//
// TypeScript interfaces for TeleCMI webhook payloads, routing, SDK config,
// and outbound click2call.
// =============================================================================

export interface TeleCmiRoutingRequest {
  from: string;
  to: string;
  cmiuuid: string;
  appid: number;
}

export interface TeleCmiRoutingAgent {
  agent_id: string;
  phone: string;
}

export interface TeleCmiRoutingResponse {
  code: number;
  loop: number;
  timeout: number;
  followme: boolean;
  hangup: boolean;
  result: TeleCmiRoutingAgent[];
}

export interface TeleCmiWebhookCdr {
  type: 'cdr';
  direction: 'inbound' | 'outbound';
  cmiuuid: string;
  conversation_uuid?: string;
  status: 'answered' | 'missed';
  from: string | number;
  to?: string | number;
  virtual_number?: string | number;
  user?: string;  // telecmi agent id who answered
  time: number;   // epoch ms
  answeredsec?: number;
  billsec?: number; // call duration
  hangup_reason?: string;
  record?: boolean;
  filename?: string;
  team?: string;
  ivr_name?: string;
  appid?: number;
  custom?: string;
  /** Outbound: click2call request_id used to link to initial cti_call_logs row */
  request_id?: string;
  /** Outbound: CDR leg — 'a' = agent SIP leg, 'b' = destination PSTN leg */
  leg?: 'a' | 'b';
  /** Outbound: caller ID used for the call */
  callerid?: string | number;
}

export interface TeleCmiWebhookLiveEvent {
  type: 'event';
  direction: 'inbound' | 'outbound';
  status: 'waiting' | 'started' | 'hangup';
  cmiuuid?: string;
  conversation_uuid?: string;
  from?: string;
  to?: string;
  app_id?: number;
  time?: number;
  custom?: string;
}

export type TeleCmiWebhookPayload = TeleCmiWebhookCdr | TeleCmiWebhookLiveEvent;

export interface CallerLookupResult {
  found: boolean;
  name?: string;
  customerId?: string;
}

export interface CtiSdkConfig {
  telecmiAgentId: string;
  sbcUri: string;
}

export interface CreateInteractionFromCallInput {
  cmiuuid: string;
  fromNumber: string;
}

// ---------------------------------------------------------------------------
// Outbound click2call
// ---------------------------------------------------------------------------

/** Request body for TeleCMI POST /v2/webrtc/click2call */
export interface TeleCmiClick2CallRequest {
  /** Format: "{extension}_{appId}" e.g. "101_33335989" */
  user_id: string;
  secret: string;
  /** Destination number with country code (no +), e.g. 919876543210 */
  to: number;
  extra_params?: {
    ccm: boolean;
    requestRef?: string;
  };
  webrtc: boolean;
  /** Caller ID (DID number with country code, no +) */
  callerid?: number;
}

/** Response from TeleCMI POST /v2/webrtc/click2call */
export interface TeleCmiClick2CallResponse {
  code: number;
  /** Synchronous request identifier — cmiuuid is populated later via CDR webhook */
  request_id?: string;
  /** Alias for request_id in some API versions */
  call_id?: string;
  msg?: string;
}

/** Input to the outbound call service */
export interface InitiateOutboundCallInput {
  /** Raw destination input from the dialpad (digits, may include +/spaces/dashes) */
  destination: string;
}

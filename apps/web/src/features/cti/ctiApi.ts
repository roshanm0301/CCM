/**
 * CTI API client functions.
 *
 * Four endpoints:
 *   GET  /api/v1/cti/sdk-config          — fetch TeleCMI SIP credentials for the
 *                                          logged-in agent; 404 = agent not provisioned.
 *   GET  /api/v1/cti/caller-lookup       — reverse-lookup a calling number; returns
 *                                          name + customerId only (lightweight).
 *   GET  /api/v1/cti/caller-context      — pre-fetch full customer record(s) by phone
 *                                          number before an interaction is created;
 *                                          returns SearchResultItem[] for search panel
 *                                          auto-population on inbound calls.
 *   POST /api/v1/cti/interactions        — create an inbound_call interaction record
 *                                          from a live call.
 *
 * Source: CCM Wave 2 spec — TeleCMI CTI integration (frontend)
 */

import { apiClient } from '@/shared/api/client';
import type { SearchResultItem } from '@/features/interaction/interactionStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SdkConfig {
  telecmiAgentId: string;
  telecmiSipPassword: string;
  sbcUri: string;
}

export interface CallerLookupResult {
  found: boolean;
  name?: string;
  customerId?: string;
}

export interface CreateInteractionResult {
  interactionId: string;
  startedAt: string;
  status: string;
  channel: string;
  mode: string;
  /** Caller lookup result returned from the backend, or null if no match. */
  customerContext: CallerLookupResult | null;
}

// ---------------------------------------------------------------------------
// fetchSdkConfig
// ---------------------------------------------------------------------------

/**
 * Returns the TeleCMI SIP credentials for the currently authenticated agent,
 * or null if the agent has no TeleCMI account provisioned (404) or any other
 * error occurs.  Callers should silently skip CTI initialisation on null.
 */
export async function fetchSdkConfig(): Promise<SdkConfig | null> {
  try {
    const res = await apiClient.get<{ success: boolean; data: SdkConfig }>(
      '/api/v1/cti/sdk-config',
    );
    return res.data.data;
  } catch {
    // 404 = agent not provisioned in TeleCMI — not an error worth surfacing
    return null;
  }
}

// ---------------------------------------------------------------------------
// fetchCallerLookup
// ---------------------------------------------------------------------------

/**
 * Reverse-lookup a PSTN number against the CCM customer base.
 * Returns found:false on any error so the call bar can still be shown.
 */
export async function fetchCallerLookup(number: string): Promise<CallerLookupResult> {
  try {
    const res = await apiClient.get<{ success: boolean; data: CallerLookupResult }>(
      '/api/v1/cti/caller-lookup',
      { params: { number } },
    );
    return res.data.data;
  } catch {
    return { found: false };
  }
}

// ---------------------------------------------------------------------------
// fetchCallerContext
// ---------------------------------------------------------------------------

/**
 * Pre-fetches the full customer record(s) matching the caller's phone number
 * BEFORE the agent answers the call (no interactionId required).
 *
 * Returns SearchResultItem[] in the same shape as the regular search endpoint
 * so results can be injected directly into interactionStore.searchResults when
 * the agent answers, giving instant search panel population without any typing.
 *
 * Returns an empty array on any error — caller ignores failures gracefully.
 */
export async function fetchCallerContext(number: string): Promise<SearchResultItem[]> {
  try {
    const res = await apiClient.get<{ success: boolean; data: SearchResultItem[] }>(
      '/api/v1/cti/caller-context',
      { params: { number } },
    );
    return res.data.data ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// createInteractionFromCall
// ---------------------------------------------------------------------------

/**
 * Creates an inbound_call interaction record in the backend when the agent
 * answers a call.  Throws on error so the caller can log it.
 */
export async function createInteractionFromCall(
  cmiuuid: string,
  fromNumber: string,
): Promise<CreateInteractionResult> {
  const res = await apiClient.post<{ success: boolean; data: CreateInteractionResult }>(
    '/api/v1/cti/interactions',
    { cmiuuid, fromNumber },
  );
  return res.data.data;
}

// ---------------------------------------------------------------------------
// initiateOutboundCall
// ---------------------------------------------------------------------------

export interface InitiateOutboundCallResult {
  requestId: string;
  destination: string;
}

/**
 * Initiates an outbound click2call to the given destination.
 * Returns the request_id for call tracking.
 * Throws on error so the caller can surface it to the agent.
 */
export async function initiateOutboundCall(
  destination: string,
): Promise<InitiateOutboundCallResult> {
  const res = await apiClient.post<{ success: boolean; data: InitiateOutboundCallResult }>(
    '/api/v1/cti/calls',
    { destination },
  );
  return res.data.data;
}

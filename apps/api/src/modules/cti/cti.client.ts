// =============================================================================
// CCM API — CTI Client
//
// Server-side TeleCMI REST API client for admin operations.
// All functions are fire-and-forget safe or throw on hard errors.
// =============================================================================

import { getCtiConfig } from './cti.config';
import { logger } from '../../shared/logging/logger';
import type { TeleCmiClick2CallRequest, TeleCmiClick2CallResponse } from './cti.types';

// TeleCMI REST API requires appid as a number (integer), not a string.
// config.telecmiAppId is already coerced to number by the Zod schema
// (z.coerce.number().int().positive()) — startup fails fast if it is not a
// valid positive integer, so NaN can never reach here at runtime.
function appIdAsNumber(appId: number): number {
  return appId;
}

// Set agent status in TeleCMI (fire-and-forget, never throws)
export async function setTeleCmiAgentStatus(
  telecmiAgentId: string,
  status: 'online' | 'offline' | 'break',
): Promise<void> {
  const config = getCtiConfig();
  try {
    const res = await fetch(`${config.baseUrl}/v2/user/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appid: appIdAsNumber(config.appId), secret: config.appSecret, id: telecmiAgentId, status }),
    });
    const body = await res.json() as { code: number; msg?: string };
    if (body.code !== 200) {
      logger.warn('TeleCMI setAgentStatus returned non-200', { telecmiAgentId, status, body });
    }
  } catch (err) {
    logger.error('TeleCMI setAgentStatus failed', { err, telecmiAgentId, status });
  }
}

// Add agent in TeleCMI
export async function addTeleCmiAgent(params: {
  extension: number;
  name: string;
  phone_number: string;
  password: string;
}): Promise<{ agent_id: string; extension: number }> {
  const config = getCtiConfig();
  const res = await fetch(`${config.baseUrl}/v2/user/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appid: appIdAsNumber(config.appId), secret: config.appSecret, ...params }),
  });
  const body = await res.json() as { code: number; status?: string; agent?: { agent_id: string; extension: number }; msg?: string };
  if (body.code !== 200 || !body.agent) {
    throw new Error(`TeleCMI addAgent failed: ${JSON.stringify(body)}`);
  }
  return body.agent;
}

// Update agent in TeleCMI
export async function updateTeleCmiAgent(params: {
  id: string;
  name: string;
  phone_number: string;
  password: string;
}): Promise<void> {
  const config = getCtiConfig();
  const res = await fetch(`${config.baseUrl}/v2/user/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appid: appIdAsNumber(config.appId), secret: config.appSecret, ...params }),
  });
  const body = await res.json() as { code: number; msg?: string };
  if (body.code !== 200) {
    logger.warn('TeleCMI updateAgent returned non-200', { params, body });
  }
}

// Initiate outbound WebRTC click2call
// Returns the TeleCMI response including request_id for initial call tracking.
// Throws AppError EXTERNAL_SERVICE_ERROR (502) if TeleCMI returns non-200.
export async function initiateClick2Call(
  params: TeleCmiClick2CallRequest,
): Promise<TeleCmiClick2CallResponse> {
  const config = getCtiConfig();
  // Log request without the secret field
  logger.info('TeleCMI click2call initiating', {
    module: 'cti.client',
    user_id: params.user_id,
    to: params.to,
    callerid: params.callerid,
  });
  const res = await fetch(`${config.baseUrl}/v2/webrtc/click2call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body = await res.json() as TeleCmiClick2CallResponse;
  logger.info('TeleCMI click2call response', {
    module: 'cti.client',
    code: body.code,
    request_id: body.request_id ?? body.call_id,
    msg: body.msg,
  });
  if (body.code !== 200) {
    const message = `TeleCMI click2call failed: code=${body.code} msg=${body.msg ?? 'unknown'}`;
    logger.error(message, { module: 'cti.client', body });
    const error = new Error(message) as Error & { statusCode?: number; code?: string };
    error.statusCode = 502;
    error.code = 'EXTERNAL_SERVICE_ERROR';
    throw error;
  }
  return body;
}

// Remove agent from TeleCMI
export async function removeTeleCmiAgent(telecmiAgentId: string): Promise<void> {
  const config = getCtiConfig();
  try {
    const res = await fetch(`${config.baseUrl}/v2/user/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appid: appIdAsNumber(config.appId), secret: config.appSecret, id: telecmiAgentId }),
    });
    const body = await res.json() as { code: number };
    if (body.code !== 200) {
      logger.warn('TeleCMI removeAgent returned non-200', { telecmiAgentId, body });
    }
  } catch (err) {
    logger.error('TeleCMI removeAgent failed', { err, telecmiAgentId });
  }
}

// Fetch call recording audio from TeleCMI.
// Returns the raw fetch Response so the caller can pipe the body.
// Throws AppError (502) if TeleCMI returns a non-OK HTTP status.
// Note: TeleCMI /v2/recording returns binary audio — not JSON.
export async function fetchRecordingAudio(filename: string): Promise<Response> {
  const config = getCtiConfig();
  logger.info('TeleCMI recording fetch', { module: 'cti.client', filename });
  const res = await fetch(`${config.baseUrl}/v2/recording`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appid: appIdAsNumber(config.appId), secret: config.appSecret, filename }),
  });
  if (!res.ok) {
    const message = `TeleCMI recording fetch failed: HTTP ${res.status}`;
    logger.error(message, { module: 'cti.client', filename, httpStatus: res.status });
    const error = new Error(message) as Error & { statusCode?: number; code?: string };
    error.statusCode = 502;
    error.code = 'EXTERNAL_SERVICE_ERROR';
    throw error;
  }
  return res;
}

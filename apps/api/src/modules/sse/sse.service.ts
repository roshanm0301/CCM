// =============================================================================
// CCM — Server-Sent Events Service
//
// In-memory SSE client registry. Pushes real-time events to connected agents.
// Single-process only — use Redis pub/sub for horizontal scaling.
// =============================================================================

import type { Response } from 'express';
import { logger } from '../../shared/logging/logger';

export type SseEventType =
  | 'PING'
  | 'CONNECTED';

export interface SseEvent {
  type: SseEventType;
  [key: string]: unknown;
}

/** Map of userId → array of connected SSE Response objects */
const clients = new Map<string, Response[]>();

export function registerSseClient(userId: string, res: Response): void {
  const existing = clients.get(userId) ?? [];
  existing.push(res);
  clients.set(userId, existing);
  logger.debug('SSE client registered', { module: 'sse.service', userId, totalClients: existing.length });
}

export function removeSseClient(userId: string, res: Response): void {
  const existing = clients.get(userId) ?? [];
  const updated = existing.filter((r) => r !== res);
  if (updated.length === 0) {
    clients.delete(userId);
  } else {
    clients.set(userId, updated);
  }
  logger.debug('SSE client removed', { module: 'sse.service', userId, remainingClients: updated.length });
}

/**
 * Push an SSE event to all connections for a specific agent.
 * Returns true if at least one client received the event.
 */
export function pushToAgent(userId: string, event: SseEvent): boolean {
  const agentClients = clients.get(userId);
  if (!agentClients || agentClients.length === 0) {
    logger.debug('SSE push: no clients for agent', { module: 'sse.service', userId, eventType: event.type });
    return false;
  }

  const payload = `data: ${JSON.stringify(event)}\n\n`;
  let sent = 0;

  for (const res of agentClients) {
    try {
      res.write(payload);
      sent++;
    } catch (err) {
      logger.warn('SSE write error — removing dead client', {
        module: 'sse.service', userId,
        message: err instanceof Error ? err.message : String(err),
      });
      removeSseClient(userId, res);
    }
  }

  logger.debug('SSE event pushed', { module: 'sse.service', userId, eventType: event.type, clientsReached: sent });
  return sent > 0;
}

/**
 * 30-second heartbeat PING to all connected clients.
 * Prevents proxy/load-balancer idle connection timeouts.
 */
export function startHeartbeat(): void {
  setInterval(() => {
    const pingPayload = `data: ${JSON.stringify({ type: 'PING' })}\n\n`;
    let totalClients = 0;

    for (const [userId, agentClients] of clients.entries()) {
      const alive: Response[] = [];
      for (const res of agentClients) {
        try {
          res.write(pingPayload);
          alive.push(res);
          totalClients++;
        } catch {
          logger.debug('SSE heartbeat: removing dead client', { module: 'sse.service', userId });
        }
      }
      if (alive.length === 0) {
        clients.delete(userId);
      } else {
        clients.set(userId, alive);
      }
    }

    if (totalClients > 0) {
      logger.debug('SSE heartbeat sent', { module: 'sse.service', totalClients });
    }
  }, 30_000);
}

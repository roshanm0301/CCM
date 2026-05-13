// =============================================================================
// CCM API — CTI Recording Controllers
//
// GET /cti/recording/:interactionId/status — lightweight check (no TeleCMI call)
// GET /cti/recording/:interactionId        — proxies audio from TeleCMI
//
// Lookup strategy:
//   1. Primary: cti_call_logs.interaction_id = :interactionId
//   2. Fallback: cti_call_logs.from_number matches interactions.cti_from_number
//      WHERE interactions.id = :interactionId
//      (covers CDRs that arrived before interaction_id was stamped)
//
// Audio is streamed directly from TeleCMI — never stored in CCM.
// Requires: authenticate + authorize('agent') (applied in routes).
// Source: CCM Phase 1.5 — call recording playback
// =============================================================================

import { Readable } from 'stream';
import type { Request, Response, NextFunction } from 'express';
import { getPool } from '../../shared/database/postgres';
import { logger } from '../../shared/logging/logger';
import { fetchRecordingAudio } from './cti.client';

// ---------------------------------------------------------------------------
// UUID format validation helper
// Rejects non-UUID strings before they reach the DB queries.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// ---------------------------------------------------------------------------
// Recording filename lookup
// ---------------------------------------------------------------------------

async function findRecordingFilename(interactionId: string): Promise<string | null> {
  const pool = getPool();

  // Primary: direct FK match — this is the expected path once CDR arrives
  // after the wrapup status fix (WRAPUP no longer excluded from CDR linking).
  const primary = await pool.query<{ recording_filename: string }>(
    `SELECT recording_filename
       FROM cti_call_logs
      WHERE interaction_id = $1
        AND recording_filename IS NOT NULL
      LIMIT 1`,
    [interactionId],
  );
  if (primary.rows.length > 0) {
    return primary.rows[0].recording_filename;
  }

  // Fallback: match via from_number + interaction's cti_from_number.
  // Covers cases where CDR arrived before interaction_id was stamped
  // (e.g. CDR arrived before the wrapup fix was deployed).
  // Known limitation: for a repeat caller this always returns the MOST RECENT
  // recording, not necessarily the one for this specific interaction.
  // The primary path (FK match) is always preferred for correctly-linked CDRs.
  const fallback = await pool.query<{ recording_filename: string }>(
    `SELECT cl.recording_filename
       FROM cti_call_logs cl
       JOIN interactions i ON i.cti_from_number = cl.from_number
      WHERE i.id = $1
        AND cl.recording_filename IS NOT NULL
        AND cl.direction = 'inbound'
      ORDER BY cl.event_at DESC
      LIMIT 1`,
    [interactionId],
  );
  if (fallback.rows.length > 0) {
    return fallback.rows[0].recording_filename;
  }

  return null;
}

// ---------------------------------------------------------------------------
// GET /cti/recording/:interactionId/status
//
// Lightweight availability check — no TeleCMI call, no audio data returned.
// Does NOT return the internal filename to avoid exposing TeleCMI identifiers
// to the browser (data minimization — security-principles.md §4).
// ---------------------------------------------------------------------------

export async function getRecordingStatusController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const interactionId = req.params['interactionId'] as string;

    if (!interactionId || !isValidUuid(interactionId)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'interactionId must be a valid UUID' },
      });
      return;
    }

    const filename = await findRecordingFilename(interactionId);

    // Do NOT return filename — internal TeleCMI identifier stays server-side only.
    res.json({
      success: true,
      data: {
        hasRecording: filename !== null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /cti/recording/:interactionId
//
// Proxies the audio file from TeleCMI to the browser.
// Audio is never stored in CCM — it is fetched on-demand and streamed.
// ---------------------------------------------------------------------------

export async function streamRecordingController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const interactionId = req.params['interactionId'] as string;

    if (!interactionId || !isValidUuid(interactionId)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'interactionId must be a valid UUID' },
      });
      return;
    }

    const filename = await findRecordingFilename(interactionId);
    if (!filename) {
      res.status(404).json({
        success: false,
        error: { code: 'RECORDING_NOT_FOUND', message: 'No recording found for this interaction' },
      });
      return;
    }

    logger.info('Streaming call recording', {
      module: 'cti.recording.controller',
      interactionId,
      agentId: req.user?.userId,
      // filename intentionally omitted from logs to avoid TeleCMI token leakage
    });

    const telecmiRes = await fetchRecordingAudio(filename);

    // Forward content headers from TeleCMI — Content-Type is typically audio/mpeg
    const contentType = telecmiRes.headers.get('content-type') ?? 'audio/mpeg';
    const contentLength = telecmiRes.headers.get('content-length');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5-min browser cache; private prevents proxy caching
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    if (!telecmiRes.body) {
      res.status(502).json({
        success: false,
        error: { code: 'RECORDING_FETCH_FAILED', message: 'TeleCMI returned empty response body' },
      });
      return;
    }

    // Pipe the TeleCMI Web Streams ReadableStream to the Node.js HTTP response.
    // Readable.fromWeb() is available in Node 17+ (confirmed Node 22 in Dockerfile).
    // Uses top-of-file import rather than require() for TypeScript consistency.
    // Client-side abort (browser closes connection mid-stream) is handled implicitly:
    // the pipe emits an ERR_STREAM_DESTROYED error on nodeReadable which is caught
    // by the error handler below and results in res.destroy() — a safe no-op on
    // an already-closed response.
    try {
      const nodeReadable = Readable.fromWeb(
        telecmiRes.body as Parameters<typeof Readable.fromWeb>[0],
      );
      nodeReadable.pipe(res);
      nodeReadable.on('error', (streamErr: Error) => {
        logger.warn('Recording stream error', {
          module: 'cti.recording.controller',
          interactionId,
          err: streamErr.message,
        });
        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            error: { code: 'RECORDING_FETCH_FAILED', message: 'Stream error' },
          });
        } else {
          res.destroy();
        }
      });
    } catch (pipeErr) {
      logger.error('Failed to pipe recording stream', {
        module: 'cti.recording.controller',
        interactionId,
        pipeErr,
      });
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          error: { code: 'RECORDING_FETCH_FAILED', message: 'Failed to pipe audio stream' },
        });
      }
    }

  } catch (err) {
    next(err);
  }
}

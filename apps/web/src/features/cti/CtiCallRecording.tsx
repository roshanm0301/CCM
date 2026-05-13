/**
 * CtiCallRecording — displays a call recording audio player for inbound_call interactions.
 *
 * 1. Checks for a recording via GET /api/v1/cti/recording/:interactionId/status (lightweight)
 * 2. If found: renders a native <audio> element pointing to the proxy endpoint
 * 3. Audio is served by the CCM API which proxies from TeleCMI — never stored locally.
 * 4. Only renders for channel === 'inbound_call'; returns null for manual interactions.
 *
 * Source: CCM Phase 1.5 — call recording playback
 */

import React, { useRef } from 'react';
import { Alert, Box, LinearProgress, Typography } from '@mui/material';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { useQuery } from '@tanstack/react-query';
import { apiClient, type ApiResponse } from '@/shared/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecordingStatusResponse {
  hasRecording: boolean;
  filename?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CtiCallRecordingProps {
  interactionId: string;
  channel: 'inbound_call' | 'manual' | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CtiCallRecording({ interactionId, channel }: CtiCallRecordingProps) {
  // Hooks must be called unconditionally — guard is applied to the returned JSX below.
  // The query is enabled only for inbound_call interactions.
  const mountedAt = useRef(Date.now());
  const { data, isLoading, isError } = useQuery({
    queryKey: ['recording-status', interactionId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<RecordingStatusResponse>>(
        `/api/v1/cti/recording/${interactionId}/status`,
      );
      return res.data.data;
    },
    enabled: channel === 'inbound_call',
    staleTime: 0,
    // Poll every 20 s until CDR arrives from TeleCMI (typically 15 s–2 min after call end).
    // Stop once recording is confirmed or after 3 minutes.
    refetchInterval: (query) => {
      if (query.state.data?.hasRecording) return false;
      if (Date.now() - mountedAt.current > 3 * 60 * 1000) return false;
      return 20_000;
    },
    refetchIntervalInBackground: false,
  });

  // Only inbound calls have recordings — guard applied after all hooks
  if (channel !== 'inbound_call') return null;

  if (isLoading) {
    return (
      <Box sx={{ py: 1 }}>
        <LinearProgress aria-label="Checking for call recording" sx={{ height: 2, borderRadius: 1 }} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Checking for recording…
        </Typography>
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="warning" variant="outlined" sx={{ py: 0.5 }}>
        Recording unavailable
      </Alert>
    );
  }

  if (!data?.hasRecording) {
    return (
      <Typography variant="caption" color="text.secondary">
        No call recording available.
      </Typography>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <GraphicEqIcon fontSize="small" sx={{ color: 'primary.main' }} aria-hidden="true" />
        <Typography variant="body2" fontWeight={500} color="text.primary">
          Call Recording
        </Typography>
      </Box>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        controls
        preload="none"
        style={{ width: '100%' }}
        aria-label="Call recording audio player"
        src={`/api/v1/cti/recording/${interactionId}`}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        Played via CCM — audio is not stored locally.
      </Typography>
    </Box>
  );
}

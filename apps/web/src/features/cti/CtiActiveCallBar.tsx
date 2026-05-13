/**
 * CtiActiveCallBar — compact bar shown inside InteractionPanel while an
 * inbound_call is active (callStatus === 'active').
 *
 * Features:
 * - Live elapsed call timer (updates every second from callStartedAt)
 * - Mute / unmute toggle
 * - Hold / unhold toggle
 * - Hang Up button
 *
 * Controls are read from ctiStore.callControls — no prop drilling needed.
 *
 * Source: CCM Wave 2 spec — TeleCMI CTI integration (frontend)
 */

import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, Tooltip, Typography } from '@mui/material';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CallEndIcon from '@mui/icons-material/CallEnd';
import { useCtiStore } from './ctiStore';

// ---------------------------------------------------------------------------
// Elapsed timer helper
// ---------------------------------------------------------------------------

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CtiActiveCallBar() {
  const { callStatus, callDirection, fromNumber, callerName, callerFound, isMuted, isOnHold, callStartedAt, callControls } =
    useCtiStore();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Tick every second while the call is active
  useEffect(() => {
    if (callStatus !== 'active' || !callStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    function tick() {
      if (!callStartedAt) return;
      const diff = Math.floor((Date.now() - callStartedAt.getTime()) / 1000);
      setElapsedSeconds(diff);
    }

    tick(); // set immediately before first interval fires
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [callStatus, callStartedAt]);

  // CtiActiveCallBar handles inbound active calls only (shown inside InteractionPanel).
  // Outbound active calls are shown in the CtiCallBar floating overlay.
  // When callDirection is 'outbound' or null, this component renders nothing.
  if (callStatus !== 'active' || callDirection !== 'inbound') return null;

  // callDirection is 'inbound' here — no outbound branch needed
  const callerLabel = callerFound && callerName ? callerName : (fromNumber ?? '');

  return (
    <Box
      role="region"
      aria-label="Active call controls"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, md: 2 },
        px: { xs: 2, md: 3 },
        py: 1,
        bgcolor: 'success.50',
        borderBottom: '1px solid',
        borderColor: 'success.200',
        flexWrap: 'wrap',
        minHeight: 48,
        flexShrink: 0,
      }}
    >
      {/* Phone icon + label */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <PhoneInTalkIcon fontSize="small" sx={{ color: 'success.main' }} aria-hidden="true" />
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.dark', whiteSpace: 'nowrap' }}>
          Inbound Call
        </Typography>
      </Box>

      {/* Caller info */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {callerLabel}
        </Typography>
        {callerFound && callerName && fromNumber && callerName !== fromNumber && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            ({fromNumber})
          </Typography>
        )}
      </Box>

      {/* Elapsed timer */}
      <Chip
        label={formatElapsed(elapsedSeconds)}
        size="small"
        variant="outlined"
        aria-label={`Call duration ${formatElapsed(elapsedSeconds)}`}
        sx={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', borderColor: 'success.300' }}
      />

      <Box sx={{ flexGrow: 1 }} />

      {/* Mute toggle */}
      <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
        <span>
          <Button
            variant={isMuted ? 'contained' : 'outlined'}
            size="small"
            onClick={() => callControls?.mute()}
            disabled={!callControls}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            aria-pressed={isMuted}
            startIcon={isMuted ? <MicOffIcon fontSize="inherit" /> : <MicIcon fontSize="inherit" />}
            sx={{
              minWidth: 0,
              px: 1.5,
              color: isMuted ? '#fff' : 'text.secondary',
              borderColor: 'divider',
              bgcolor: isMuted ? 'warning.main' : 'transparent',
              '&:hover': { bgcolor: isMuted ? 'warning.dark' : 'action.hover' },
            }}
          >
            {isMuted ? 'Muted' : 'Mute'}
          </Button>
        </span>
      </Tooltip>

      {/* Hold toggle */}
      <Tooltip title={isOnHold ? 'Resume' : 'Hold'}>
        <span>
          <Button
            variant={isOnHold ? 'contained' : 'outlined'}
            size="small"
            onClick={() => callControls?.hold()}
            disabled={!callControls}
            aria-label={isOnHold ? 'Resume call from hold' : 'Put call on hold'}
            aria-pressed={isOnHold}
            startIcon={isOnHold ? <PlayArrowIcon fontSize="inherit" /> : <PauseIcon fontSize="inherit" />}
            sx={{
              minWidth: 0,
              px: 1.5,
              color: isOnHold ? '#fff' : 'text.secondary',
              borderColor: 'divider',
              bgcolor: isOnHold ? 'info.main' : 'transparent',
              '&:hover': { bgcolor: isOnHold ? 'info.dark' : 'action.hover' },
            }}
          >
            {isOnHold ? 'Resume' : 'Hold'}
          </Button>
        </span>
      </Tooltip>

      {/* Hang Up */}
      <Button
        variant="contained"
        size="small"
        color="error"
        onClick={() => callControls?.hangUp()}
        disabled={!callControls}
        aria-label="Hang up call"
        startIcon={<CallEndIcon fontSize="inherit" />}
        sx={{ fontWeight: 600 }}
      >
        Hang Up
      </Button>
    </Box>
  );
}

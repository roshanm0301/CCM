/**
 * CtiCallBar — floating call notification overlay.
 *
 * Renders as a fixed overlay (z-index 1400, above MUI modals at 1300) for
 * three call states:
 *
 *   1. 'ringing' (inbound)  — shows incoming call banner with Answer/Decline
 *   2. 'dialing' (outbound) — shows outbound dialling banner with Cancel
 *   3. 'active' + outbound  — shows active outbound call controls (mute/hold/hangup)
 *                             displayed here because there is no InteractionPanel
 *                             in the Idle Workspace
 *
 * Inbound active calls show controls in CtiActiveCallBar (inside InteractionPanel).
 *
 * Source: CCM Wave 2 spec — TeleCMI CTI integration (frontend)
 *         CCM Phase 6 — outbound calling extension
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import PhoneForwardedIcon from '@mui/icons-material/PhoneForwarded';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useCtiStore } from './ctiStore';

// ---------------------------------------------------------------------------
// Elapsed timer helper (duplicated from CtiActiveCallBar to avoid coupling)
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

export function CtiCallBar() {
  const {
    callStatus,
    callDirection,
    fromNumber,
    callerName,
    callerFound,
    callControls,
    outboundDestination,
    isMuted,
    isOnHold,
    callStartedAt,
  } = useCtiStore();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Tick every second while an outbound call is active
  useEffect(() => {
    if (callStatus !== 'active' || callDirection !== 'outbound' || !callStartedAt) {
      setElapsedSeconds(0);
      return;
    }
    function tick() {
      if (!callStartedAt) return;
      setElapsedSeconds(Math.floor((Date.now() - callStartedAt.getTime()) / 1000));
    }
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [callStatus, callDirection, callStartedAt]);

  // ── Nothing to show ───────────────────────────────────────────────────────
  const showRinging = callStatus === 'ringing';
  const showDialing = callStatus === 'dialing';
  const showOutboundActive = callStatus === 'active' && callDirection === 'outbound';

  if (!showRinging && !showDialing && !showOutboundActive) return null;

  // ── Shared overlay wrapper ────────────────────────────────────────────────
  const overlayAccent = showRinging ? 'success.main' : 'info.main';

  return (
    <Box
      role="dialog"
      aria-label={showRinging ? 'Incoming call' : showDialing ? 'Outbound call dialling' : 'Active outbound call'}
      aria-live="assertive"
      sx={{
        position: 'fixed',
        top: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1400,
        minWidth: 320,
        maxWidth: 480,
        width: { xs: 'calc(100% - 32px)', sm: 'auto' },
      }}
    >
      <Paper
        elevation={8}
        sx={{
          px: 3,
          pt: 2.5,
          pb: 2,
          borderRadius: 2,
          bgcolor: 'background.paper',
          borderTop: '4px solid',
          borderColor: overlayAccent,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >

        {/* ── Branch 1: Incoming call (ringing) ─────────────────────────── */}
        {showRinging && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PhoneIcon fontSize="small" sx={{ color: 'success.main', flexShrink: 0 }} aria-hidden="true" />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Incoming Call
              </Typography>
            </Box>

            <Typography
              variant="h6"
              sx={{ fontWeight: 700, letterSpacing: 1, color: 'text.primary', lineHeight: 1.2 }}
              aria-label={`Calling number ${fromNumber ?? ''}`}
            >
              {fromNumber ?? '—'}
            </Typography>

            <Box sx={{ minHeight: 20, display: 'flex', alignItems: 'center' }}>
              {callerFound === null ? (
                <CircularProgress size={14} sx={{ color: 'text.secondary' }} aria-label="Looking up caller" />
              ) : callerFound && callerName ? (
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {callerName}
                </Typography>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  Details not available
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
              <Button
                variant="contained"
                startIcon={<PhoneIcon />}
                onClick={() => callControls?.answer()}
                disabled={!callControls}
                aria-label="Answer call"
                sx={{
                  flex: 1,
                  bgcolor: 'success.main',
                  color: '#fff',
                  fontWeight: 600,
                  '&:hover': { bgcolor: 'success.dark' },
                  '&.Mui-disabled': { bgcolor: 'success.main', opacity: 0.5 },
                }}
              >
                Answer
              </Button>
              <Button
                variant="outlined"
                startIcon={<CallEndIcon />}
                onClick={() => callControls?.decline()}
                disabled={!callControls}
                aria-label="Decline call"
                sx={{
                  flex: 1,
                  borderColor: 'error.main',
                  color: 'error.main',
                  fontWeight: 600,
                  '&:hover': { bgcolor: 'error.50', borderColor: 'error.dark' },
                }}
              >
                Decline
              </Button>
            </Box>
          </>
        )}

        {/* ── Branch 2: Outbound dialling ───────────────────────────────── */}
        {showDialing && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PhoneForwardedIcon fontSize="small" sx={{ color: 'info.main', flexShrink: 0, animation: 'pulse 1.5s infinite' }} aria-hidden="true" />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Outbound Call
              </Typography>
            </Box>

            <Typography
              variant="h6"
              sx={{ fontWeight: 700, letterSpacing: 1, color: 'text.primary', lineHeight: 1.2 }}
              aria-label={`Dialling ${outboundDestination ?? ''}`}
            >
              {outboundDestination ?? '—'}
            </Typography>

            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
              Dialling…
            </Typography>

            <Box sx={{ mt: 0.5 }}>
              <Button
                variant="outlined"
                startIcon={<CallEndIcon />}
                onClick={() => callControls?.hangUp()}
                disabled={!callControls}
                aria-label="Cancel outbound call"
                sx={{
                  width: '100%',
                  borderColor: 'error.main',
                  color: 'error.main',
                  fontWeight: 600,
                  '&:hover': { bgcolor: 'error.50', borderColor: 'error.dark' },
                }}
              >
                Cancel
              </Button>
            </Box>
          </>
        )}

        {/* ── Branch 3: Active outbound call ────────────────────────────── */}
        {showOutboundActive && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PhoneForwardedIcon fontSize="small" sx={{ color: 'info.main', flexShrink: 0 }} aria-hidden="true" />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Outbound Call — Active
              </Typography>
              <Chip
                label={formatElapsed(elapsedSeconds)}
                size="small"
                variant="outlined"
                aria-label={`Call duration ${formatElapsed(elapsedSeconds)}`}
                sx={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', ml: 'auto', borderColor: 'info.300' }}
              />
            </Box>

            <Typography
              variant="h6"
              sx={{ fontWeight: 700, letterSpacing: 1, color: 'text.primary', lineHeight: 1.2 }}
            >
              {outboundDestination ?? '—'}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              {/* Mute */}
              <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => callControls?.mute()}
                    disabled={!callControls}
                    aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    aria-pressed={isMuted}
                    sx={{
                      bgcolor: isMuted ? 'warning.main' : 'action.selected',
                      color: isMuted ? '#fff' : 'text.secondary',
                      '&:hover': { bgcolor: isMuted ? 'warning.dark' : 'action.hover' },
                    }}
                  >
                    {isMuted ? <MicOffIcon fontSize="small" /> : <MicIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>

              {/* Hold */}
              <Tooltip title={isOnHold ? 'Resume' : 'Hold'}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => callControls?.hold()}
                    disabled={!callControls}
                    aria-label={isOnHold ? 'Resume call from hold' : 'Put call on hold'}
                    aria-pressed={isOnHold}
                    sx={{
                      bgcolor: isOnHold ? 'info.main' : 'action.selected',
                      color: isOnHold ? '#fff' : 'text.secondary',
                      '&:hover': { bgcolor: isOnHold ? 'info.dark' : 'action.hover' },
                    }}
                  >
                    {isOnHold ? <PlayArrowIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>

              <Box sx={{ flexGrow: 1 }} />

              {/* Hang Up */}
              <Button
                variant="contained"
                size="small"
                color="error"
                startIcon={<CallEndIcon fontSize="small" />}
                onClick={() => callControls?.hangUp()}
                disabled={!callControls}
                aria-label="Hang up outbound call"
                sx={{ fontWeight: 600 }}
              >
                Hang Up
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}

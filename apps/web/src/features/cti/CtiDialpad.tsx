/**
 * CtiDialpad — phone number input + Dial button for outbound calling.
 *
 * Embedded in IdleWorkspace via a "Make a Call" toggle.
 *
 * Dial is disabled when:
 *   - A call is already in progress (callStatus !== 'idle')
 *   - Agent is not in Ready for Calls status
 *   - Input has fewer than 10 digit characters
 *   - An API call is in flight (calling === true)
 *
 * On keyboard Enter in the input: triggers dial.
 *
 * Error display: shows the error returned from the outbound call API.
 *
 * Source: CCM Phase 6 — outbound calling (standalone resolution activity)
 */

import React, { useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import PhoneForwardedIcon from '@mui/icons-material/PhoneForwarded';
import { AgentStatus } from '@ccm/types';
import { useCtiStore } from './ctiStore';
import { useAgentStatusStore } from '@/features/agent-status/agentStatusStore';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CtiDialpad() {
  const { callStatus, callControls } = useCtiStore();
  const { currentStatus } = useAgentStatusStore();

  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [calling, setCalling] = useState(false);

  // Count numeric characters (ignore formatting characters)
  const numericCount = digits.replace(/\D/g, '').length;

  const canDial =
    !calling &&
    callStatus === 'idle' &&
    currentStatus === AgentStatus.READY_FOR_CALLS &&
    numericCount >= 10;

  const handleDial = useCallback(async () => {
    if (!canDial || !callControls) return;
    setError('');
    setCalling(true);
    try {
      await callControls.outboundCall(digits.trim());
      // On success, ctiStore transitions to 'dialing' — the dialpad
      // will become disabled automatically as callStatus !== 'idle'.
      // Clear input so next dial starts fresh when call ends.
      setDigits('');
    } catch (err: unknown) {
      const appErr = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const message =
        appErr.response?.data?.error?.message ??
        appErr.message ??
        'Failed to initiate call. Please try again.';
      setError(message);
    } finally {
      setCalling(false);
    }
  }, [canDial, callControls, digits]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        void handleDial();
      }
    },
    [handleDial],
  );

  const dialButtonTooltip =
    callStatus !== 'idle'
      ? 'A call is already in progress'
      : currentStatus !== AgentStatus.READY_FOR_CALLS
        ? 'Set your status to Ready for Calls to make a call'
        : numericCount < 10
          ? 'Enter at least 10 digits'
          : '';

  return (
    <Box sx={{ mt: 2 }}>
      <Typography
        sx={{
          fontSize: 'sm',
          fontWeight: 'medium',
          color: 'text.secondary',
          mb: 1,
        }}
      >
        Enter destination number
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <TextField
          value={digits}
          onChange={(e) => {
            // Allow digits, spaces, dashes, parens, + sign
            const val = e.target.value.replace(/[^\d\s\-().+]/g, '');
            setDigits(val);
            if (error) setError('');
          }}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 9876543210"
          size="small"
          inputProps={{
            'aria-label': 'Destination phone number',
            maxLength: 20,
            inputMode: 'tel',
            type: 'tel',
          }}
          disabled={calling || callStatus !== 'idle'}
          sx={{ flex: 1 }}
          error={!!error}
        />

        <Button
          variant="contained"
          size="small"
          startIcon={
            calling ? (
              <CircularProgress size={14} sx={{ color: '#fff' }} />
            ) : (
              <PhoneForwardedIcon fontSize="small" />
            )
          }
          onClick={() => void handleDial()}
          disabled={!canDial}
          title={dialButtonTooltip}
          aria-label="Dial outbound call"
          aria-busy={calling}
          sx={{
            bgcolor: '#1565C0',   // info.dark — distinct from brand orange (inbound)
            color: '#fff',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            '&:hover': { bgcolor: '#0D47A1' },
            '&.Mui-disabled': {
              bgcolor: '#1565C0',
              opacity: 0.45,
              color: '#fff',
            },
          }}
        >
          {calling ? 'Dialling…' : 'Dial'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" role="alert" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}

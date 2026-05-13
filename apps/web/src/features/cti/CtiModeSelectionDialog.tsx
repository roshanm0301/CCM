/**
 * CtiModeSelectionDialog — forces agents to choose a session work mode.
 *
 * Shown when sessionMode === null (i.e. the agent has not yet selected a mode).
 * No dismiss or close — the agent MUST make a selection.
 *
 * Modes:
 *   manual — agent starts interactions manually; no inbound CTI calls routed.
 *   cti    — telephony connected; inbound calls route to this workstation.
 *
 * On confirm: PATCH /api/v1/auth/session-mode then writes mode to authStore.
 *
 * Source: CCM Phase 1.5 — Mode Selection spec
 */

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  LinearProgress,
  RadioGroup,
  Typography,
} from '@mui/material';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import PhoneDisabledOutlinedIcon from '@mui/icons-material/PhoneDisabledOutlined';
import PhoneInTalkOutlinedIcon from '@mui/icons-material/PhoneInTalkOutlined';
import { apiClient } from '@/shared/api/client';
import { useAuthStore, type SessionMode } from '@/features/auth/authStore';

// ---------------------------------------------------------------------------
// API response shape
// ---------------------------------------------------------------------------

interface SessionModeResponse {
  success: true;
  data: { sessionMode: SessionMode };
}

// ---------------------------------------------------------------------------
// Option card sub-component
// ---------------------------------------------------------------------------

interface ModeCardProps {
  value: SessionMode;
  selected: SessionMode | null;
  loading: boolean;
  icon: React.ReactNode;
  label: string;
  description: string;
  ariaLabel: string;
  onChange: (mode: SessionMode) => void;
}

function ModeCard({ value, selected, loading, icon, label, description, ariaLabel, onChange }: ModeCardProps) {
  const isSelected = selected === value;

  return (
    <Box
      component="label"
      sx={{
        display: 'block',
        cursor: loading ? 'not-allowed' : 'pointer',
        border: '2px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        borderRadius: 2,
        p: 2.5,
        bgcolor: isSelected ? 'rgba(235,106,44,0.06)' : 'background.paper',
        boxShadow: isSelected ? '0 0 0 3px rgba(235,106,44,0.15)' : 'none',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        position: 'relative',
        pointerEvents: loading ? 'none' : undefined,
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <input
        type="radio"
        name="session-mode"
        value={value}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        onChange={() => onChange(value)}
        aria-label={ariaLabel}
        checked={isSelected}
        readOnly={loading}
      />
      {isSelected && (
        <CheckCircleOutlinedIcon
          sx={{ position: 'absolute', top: 8, right: 8, fontSize: 16, color: 'primary.main' }}
          aria-hidden="true"
        />
      )}
      <Box
        aria-hidden="true"
        sx={{
          fontSize: 32,
          color: isSelected ? 'primary.main' : 'text.secondary',
          mb: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {icon}
      </Box>
      <Typography variant="h3" sx={{ fontWeight: 500, mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

export function CtiModeSelectionDialog() {
  const [selected, setSelected] = useState<SessionMode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);
    setError(null);

    try {
      await apiClient.patch<SessionModeResponse>('/api/v1/auth/session-mode', {
        sessionMode: selected,
      });
      // Write the mode into the auth store — dialog unmounts because sessionMode !== null
      useAuthStore.getState().setSessionMode(selected);
    } catch {
      setError('Unable to save your work mode. Please try again.');
      setLoading(false);
    }
    // Note: setLoading(false) is intentionally NOT called on success because
    // the store update causes this component to unmount immediately.
    // Calling setLoading on an unmounted component is harmless in React 18
    // (no-op), but omitting it makes the intent clearer.
  }

  return (
    <Dialog
      open
      disableEscapeKeyDown
      maxWidth="sm"
      fullWidth
      aria-labelledby="mode-dialog-title"
      aria-describedby="mode-dialog-desc"
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          position: 'relative',
        },
      }}
      slotProps={{
        backdrop: { sx: { cursor: 'not-allowed' } },
      }}
    >
      {/* Loading progress bar at the top of the paper */}
      {loading && (
        <LinearProgress
          sx={{ height: 3, position: 'absolute', top: 0, left: 0, right: 0 }}
          aria-label="Saving work mode"
        />
      )}

      <Box sx={{ p: 3, pt: loading ? 4 : 3 }}>
        {/* Title */}
        <Typography variant="h2" id="mode-dialog-title" sx={{ mb: 0.75 }}>
          Choose Your Work Mode
        </Typography>

        {/* Subtitle */}
        <Typography variant="body1" color="text.secondary" id="mode-dialog-desc" sx={{ mb: 0.5 }}>
          Select how you will receive and handle calls for this session.
        </Typography>

        {/* Option cards */}
        <RadioGroup aria-label="Session mode selection">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
              mt: 2.5,
            }}
          >
            <ModeCard
              value="manual"
              selected={selected}
              loading={loading}
              icon={<PhoneDisabledOutlinedIcon sx={{ fontSize: 32 }} />}
              label="Manual"
              description="You will start interactions manually. No inbound calls are routed to you."
              ariaLabel="Manual mode"
              onChange={setSelected}
            />
            <ModeCard
              value="cti"
              selected={selected}
              loading={loading}
              icon={<PhoneInTalkOutlinedIcon sx={{ fontSize: 32 }} />}
              label="CTI — Telephony Connected"
              description="Inbound calls are routed to your workstation. Your status controls call availability."
              ariaLabel="CTI telephony connected mode"
              onChange={setSelected}
            />
          </Box>
        </RadioGroup>

        {/* Error alert */}
        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 0 }} role="alert">
            {error}
          </Alert>
        )}

        {/* Continue button */}
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={selected === null || loading}
          onClick={handleContinue}
          sx={{ mt: 3 }}
          aria-label="Confirm selected work mode and continue"
        >
          {loading ? (
            <CircularProgress size={20} sx={{ color: 'inherit' }} aria-label="Saving" />
          ) : (
            'Continue'
          )}
        </Button>
      </Box>
    </Dialog>
  );
}

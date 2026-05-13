/**
 * AgentStatusWidget — persistent status chip in the global header.
 *
 * Shows current agent status with a colored dot indicator.
 * Click opens a MUI Menu with 4 status options.
 * No optimistic update — UI updates only after API confirmation.
 * On error: toast notification (uses MUI Snackbar as ToasterComponent stand-in).
 *
 * Source: ux-specification.md Screen 2 §2.5
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Chip,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  Typography,
  CircularProgress,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { AgentStatus } from '@ccm/types';
import { apiClient } from '@/shared/api/client';
import { useAgentStatusStore } from './agentStatusStore';

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------

interface StatusConfig {
  label: string;
  abbr: string;
  dotColor: string;
  chipBgColor: string;
  chipBorderColor: string;
}

const STATUS_CONFIG: Record<AgentStatus, StatusConfig> = {
  [AgentStatus.READY_FOR_CALLS]: {
    label: 'Ready for Calls',
    abbr: 'RDY',
    dotColor: '#4caf50',
    chipBgColor: '#f1f8e9',
    chipBorderColor: '#c5e1a5',
  },
  [AgentStatus.BREAK]: {
    label: 'Break',
    abbr: 'BRK',
    dotColor: '#ff9800',
    chipBgColor: '#fff8e1',
    chipBorderColor: '#ffe082',
  },
  [AgentStatus.OFFLINE]: {
    label: 'Offline',
    abbr: 'OFF',
    dotColor: '#9e9e9e',
    chipBgColor: '#f5f5f5',
    chipBorderColor: '#e0e0e0',
  },
  [AgentStatus.TRAINING]: {
    label: 'Training',
    abbr: 'TRN',
    dotColor: '#2196f3',
    chipBgColor: '#e3f2fd',
    chipBorderColor: '#90caf9',
  },
  // Phase 1.5 — system-managed CTI statuses (not agent-selectable via the dropdown)
  [AgentStatus.ON_CALL]: {
    label: 'On Call',
    abbr: 'ONC',
    dotColor: '#2e7d32',
    chipBgColor: '#f1f8e9',
    chipBorderColor: '#c5e1a5',
  },
  [AgentStatus.WRAP_UP]: {
    label: 'Wrap Up',
    abbr: 'WRP',
    dotColor: '#e65100',
    chipBgColor: '#fff8e1',
    chipBorderColor: '#ffe082',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AgentStatusWidgetProps {
  /** Optional override for the chip border color — e.g. 'primary[200]' (#F4B07D) in Call Status Bar */
  chipBorderColor?: string;
}

export function AgentStatusWidget({ chipBorderColor }: AgentStatusWidgetProps) {
  // Use shared store so all widget instances (header + idle workspace) stay in sync
  // and so IdleWorkspace can gate the "Start New Interaction" button on status.
  const { currentStatus, updating, setCurrentStatus, setUpdating } = useAgentStatusStore();

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const chipRef = useRef<HTMLDivElement>(null);

  // Ref-based in-flight guard — prevents a second PATCH from firing before the
  // first one completes, independent of React's render timing. This is safer
  // than relying solely on the `updating` store state which propagates
  // asynchronously through React's reconciler.
  const inFlightRef = useRef(false);

  const menuOpen = Boolean(menuAnchor);

  // Fetch current status on mount (only the first mounted instance runs this;
  // subsequent instances share the store value immediately).
  useEffect(() => {
    apiClient
      .get<{ success: true; data: { currentStatus: AgentStatus } }>('/api/v1/agent/status')
      .then((res) => {
        if (res.data.data.currentStatus) {
          setCurrentStatus(res.data.data.currentStatus);
        }
      })
      .catch(() => {
        // Non-blocking; store retains its current value as fallback
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChipClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (updating || inFlightRef.current) return;
      setMenuAnchor(event.currentTarget);
    },
    [updating],
  );

  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  const handleStatusSelect = useCallback(
    async (newStatus: AgentStatus) => {
      setMenuAnchor(null);
      if (newStatus === currentStatus) return;

      // Ref-based guard is set synchronously, before the first await, to prevent
      // any re-entrant call from the second widget instance racing in.
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const previousStatus = currentStatus;
      setUpdating(true);

      try {
        const res = await apiClient.patch<{
          success: true;
          data: { currentStatus: AgentStatus };
        }>('/api/v1/agent/status', { status: newStatus });

        setCurrentStatus(res.data.data.currentStatus);
      } catch {
        // Revert to the captured previous status and notify
        setCurrentStatus(previousStatus);
        setToastMessage('Unable to update status. Please try again.');
        setToastOpen(true);
      } finally {
        inFlightRef.current = false;
        setUpdating(false);
        // Return focus to chip after menu closes
        chipRef.current?.focus();
      }
    },
    // setCurrentStatus and setUpdating are Zustand stable setters (same reference
    // across renders) but are listed explicitly so exhaustive-deps is satisfied.
    [currentStatus, setCurrentStatus, setUpdating],
  );

  const cfg = STATUS_CONFIG[currentStatus];

  return (
    <>
      {/* Status Chip */}
      <Chip
        ref={chipRef}
        role="button"
        tabIndex={0}
        size="medium"
        variant="outlined"
        disabled={updating}
        aria-label={`Current agent status: ${cfg.label}. Click to change.`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={handleChipClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleChipClick(e as unknown as React.MouseEvent<HTMLDivElement>);
          }
        }}
        icon={
          updating ? (
            <CircularProgress size={10} sx={{ color: cfg.dotColor, ml: 0.5 }} />
          ) : (
            <Box
              aria-hidden="true"
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: cfg.dotColor,
                flexShrink: 0,
                ml: 0.5,
              }}
            />
          )
        }
        label={
          <>
            {/* xs only: 3-letter abbreviation supplements the color dot (WCAG 1.4.1) */}
            <Typography
              variant="caption"
              aria-hidden="true"
              sx={{
                fontWeight: 500,
                display: { xs: 'block', sm: 'none' },
                color: 'text.primary',
              }}
            >
              {cfg.abbr}
            </Typography>
            {/* sm+: full label */}
            <Typography
              variant="caption"
              sx={{
                fontWeight: 500,
                display: { xs: 'none', sm: 'block' },
                color: 'text.primary',
              }}
            >
              {cfg.label}
            </Typography>
          </>
        }
        sx={{
          bgcolor: cfg.chipBgColor,
          borderColor: chipBorderColor ?? cfg.chipBorderColor,
          cursor: updating ? 'not-allowed' : 'pointer',
          // Use brightness filter instead of opacity so the chip background stays
          // opaque against the dark AppBar. opacity: 0.85 would reveal the dark
          // background through the chip, making it look black.
          '&:hover': { bgcolor: cfg.chipBgColor, filter: updating ? 'none' : 'brightness(0.92)' },
          '.MuiChip-icon': { marginLeft: 0 },
        }}
      />

      {/* Status selection menu */}
      <Menu
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={handleMenuClose}
        aria-label="Select agent status"
        MenuListProps={{ 'aria-label': 'Agent status options' }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {(Object.values(AgentStatus) as AgentStatus[])
          // ON_CALL and WRAP_UP are system-managed CTI statuses — not agent-selectable
          .filter((s) => s !== AgentStatus.ON_CALL && s !== AgentStatus.WRAP_UP)
          .map((status) => {
          const sCfg = STATUS_CONFIG[status];
          const isSelected = status === currentStatus;
          return (
            <MenuItem
              key={status}
              onClick={() => handleStatusSelect(status)}
              selected={isSelected}
              role="menuitem"
              aria-label={`Set status to ${sCfg.label}${isSelected ? ' (current)' : ''}`}
            >
              <Box
                aria-hidden="true"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: sCfg.dotColor,
                  mr: 1.5,
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="body2"
                color={isSelected ? 'primary' : 'text.primary'}
                sx={{ flexGrow: 1 }}
              >
                {sCfg.label}
              </Typography>
              {isSelected && (
                <CheckIcon
                  fontSize="small"
                  color="primary"
                  sx={{ ml: 1 }}
                  aria-hidden="true"
                />
              )}
            </MenuItem>
          );
        })}
      </Menu>

      {/* Error toast */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={10_000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setToastOpen(false)}
          role="alert"
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

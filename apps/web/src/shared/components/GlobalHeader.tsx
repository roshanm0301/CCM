/**
 * GlobalHeader — persistent dark header on all authenticated screens.
 *
 * Phase 1 scope only. No announcements, no CTI controls.
 *
 * Layout (left to right):
 * - 9-dot grid icon (GridViewOutlined) — module switcher placeholder
 * - "Call Centre Management" app title (white, hidden on xs)
 * - Flexible spacer
 * - Agent display name (hidden on xs/sm)
 * - AgentStatusWidget — status chip + dropdown
 * - Notification bell icon
 * - Agent avatar with logout dropdown
 *
 * Background: secondary[900] = #1B1D21
 * Height: 64px
 *
 * Source: CCM_Phase1_Agent_Interaction_Documentation.md §Screen 2
 */

import React, { useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Popover,
  Snackbar,
  Alert,
  Toolbar,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import PhoneForwardedIcon from '@mui/icons-material/PhoneForwarded';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { AgentStatus, InteractionStatus } from '@ccm/types';
import { useAuthStore, type SessionMode } from '@/features/auth/authStore';
import { useAgentStatusStore } from '@/features/agent-status/agentStatusStore';
import { useInteractionStore } from '@/features/interaction/interactionStore';
import { useCtiStore } from '@/features/cti/ctiStore';
import { CtiDialpad } from '@/features/cti/CtiDialpad';
import { apiClient } from '@/shared/api/client';
import { AgentStatusWidget } from '@/features/agent-status/AgentStatusWidget';

// ---------------------------------------------------------------------------
// API response type for starting an interaction (mirrors IdleWorkspace)
// ---------------------------------------------------------------------------

interface StartInteractionResponse {
  success: true;
  data: {
    interactionId: string;
    status: InteractionStatus;
    startedAt: string;
  };
}

interface GetInteractionResponse {
  success: true;
  data: {
    id: string;
    status: InteractionStatus;
    startedAt: string;
    channel: string;
    ctiFromNumber: string | null;
  };
}

// Helper: extract initials from a display name
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const ICON_BUTTON_SX = {
  color: '#FFFFFF',
  '&:hover': {
    bgcolor: 'rgba(255,255,255,0.1)',
  },
  borderRadius: 1,
};

export function GlobalHeader() {
  const navigate = useNavigate();
  const { user, clearAuth, sessionMode, setSessionMode, isDealer } = useAuthStore();
  const { currentStatus } = useAgentStatusStore();
  const { interactionId, setInteraction, resumeInteraction } = useInteractionStore();
  const { callStatus } = useCtiStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarAnchor, setAvatarAnchor] = useState<null | HTMLElement>(null);
  const [dialpadAnchor, setDialpadAnchor] = useState<null | HTMLElement>(null);
  const [startingInteraction, setStartingInteraction] = useState(false);
  const [newInteractionError, setNewInteractionError] = useState('');
  const [errorToastOpen, setErrorToastOpen] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);

  const avatarMenuOpen = Boolean(avatarAnchor);

  // True when an interaction is already active in the store
  const hasActiveInteraction = Boolean(interactionId);

  // The "New Interaction" button is enabled when:
  //   - Manual mode: no active interaction (agent status is irrelevant — the
  //     AgentStatusWidget is not rendered in manual mode, so the agent has no
  //     mechanism to change their status, and manual interactions do not
  //     depend on call-routing readiness).
  //   - CTI mode: agent must be READY_FOR_CALLS AND have no active interaction.
  const canStartInteraction =
    sessionMode === 'manual'
      ? !hasActiveInteraction
      : currentStatus === AgentStatus.READY_FOR_CALLS && !hasActiveInteraction;

  // Make a Call: enabled when no call is in progress
  const canMakeCall = callStatus === 'idle' && !hasActiveInteraction;
  const dialpadOpen = Boolean(dialpadAnchor);

  // Determine which read-only chip to show for CTI system-managed statuses
  const isCtiOnCall = currentStatus === AgentStatus.ON_CALL;
  const isCtiWrapUp = currentStatus === AgentStatus.WRAP_UP;
  const showCtiReadOnlyChip =
    sessionMode === 'cti' && (isCtiOnCall || isCtiWrapUp);

  async function handleNewInteraction() {
    if (!canStartInteraction) return;
    setStartingInteraction(true);
    setNewInteractionError('');

    try {
      const res = await apiClient.post<StartInteractionResponse>('/api/v1/interactions');
      const { interactionId: newId, status, startedAt } = res.data.data;
      setInteraction(newId, status, startedAt);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: {
            error?: {
              code?: string;
              details?: { existingInteractionId?: string };
            };
          };
        };
      };
      const httpStatus = axiosErr.response?.status;

      if (httpStatus === 409) {
        const existingId = axiosErr.response?.data?.error?.details?.existingInteractionId;
        if (existingId) {
          try {
            const res = await apiClient.get<GetInteractionResponse>(
              `/api/v1/interactions/${existingId}`,
            );
            const { id, status, startedAt, channel, ctiFromNumber } = res.data.data;
            const TERMINAL_STATUSES: InteractionStatus[] = [
              InteractionStatus.CLOSED,
              InteractionStatus.INCOMPLETE,
            ];
            const resumeStatus: InteractionStatus = TERMINAL_STATUSES.includes(
              status as InteractionStatus,
            )
              ? (status as InteractionStatus)
              : InteractionStatus.IDENTIFYING;
            resumeInteraction({
              id,
              status: resumeStatus,
              startedAt,
              channel: channel === 'inbound_call' ? 'inbound_call' : 'manual',
              ctiFromNumber: ctiFromNumber ?? null,
            });
            return;
          } catch {
            setNewInteractionError('Unable to resume your open interaction. Please try again.');
            setErrorToastOpen(true);
          }
        } else {
          setNewInteractionError(
            'You already have an active interaction. Please close it first.',
          );
          setErrorToastOpen(true);
        }
      } else {
        setNewInteractionError('Unable to start interaction. Please try again.');
        setErrorToastOpen(true);
      }
    } finally {
      setStartingInteraction(false);
    }
  }

  async function handleModeSwitch(newMode: SessionMode) {
    if (newMode === sessionMode || switchingMode) return;

    // Block mode switch while a CTI call is in progress
    if (callStatus !== 'idle') {
      setNewInteractionError('Cannot switch mode while a call is in progress.');
      setErrorToastOpen(true);
      return;
    }

    // Block mode switch while an interaction is open (unsaved work)
    if (hasActiveInteraction) {
      setNewInteractionError('Please close the current interaction before switching mode.');
      setErrorToastOpen(true);
      return;
    }

    setSwitchingMode(true);
    try {
      await apiClient.patch('/api/v1/auth/session-mode', { sessionMode: newMode });
      setSessionMode(newMode);
    } catch {
      setNewInteractionError('Unable to switch mode. Please try again.');
      setErrorToastOpen(true);
    } finally {
      setSwitchingMode(false);
    }
  }

  async function handleLogout() {
    setAvatarAnchor(null);
    setLoggingOut(true);
    try {
      await apiClient.post('/api/v1/auth/logout');
    } catch {
      // Logout is best-effort — even if API fails, clear local state
    } finally {
      clearAuth();
      navigate('/login', { replace: true });
    }
  }

  const displayName = user?.displayName ?? '';
  const initials = displayName ? getInitials(displayName) : '?';

  return (
    <AppBar
      component="header"
      position="fixed"
      elevation={0}
      sx={{
        bgcolor: '#1B1D21',
        height: 64,
        zIndex: (theme) => theme.zIndex.appBar,
        borderBottom: 'none',
      }}
    >
      <Toolbar
        sx={{
          height: 64,
          minHeight: '64px !important',
          gap: 1,
          px: { xs: 1.5, md: 2 },
        }}
      >
        {/* 9-dot grid icon — module switcher placeholder */}
        <Tooltip title="App menu">
          <IconButton
            size="small"
            aria-label="App menu"
            sx={ICON_BUTTON_SX}
          >
            <GridViewOutlinedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        {/* App title */}
        <Typography
          component="span"
          sx={{
            color: '#FFFFFF',
            fontSize: '1rem',        // lg: 16px
            fontWeight: 600,
            whiteSpace: 'nowrap',
            display: { xs: 'none', sm: 'block' },
            ml: 0.5,
          }}
        >
          Call Centre Management
        </Typography>

        {/* Flexible spacer */}
        <Box sx={{ flex: 1 }} aria-hidden="true" />

        {/* Agent identity block — hidden on xs/sm */}
        {displayName && (
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              alignItems: 'flex-end',
              mr: 0.5,
            }}
          >
            <Typography
              sx={{
                color: '#FFFFFF',
                fontSize: '0.75rem',    // sm: 12px
                fontWeight: 500,
                lineHeight: '18px',
              }}
              aria-label={`Signed in as ${displayName}`}
            >
              {displayName}
            </Typography>
          </Box>
        )}

        {/*
          Mode toggle — Manual / CTI.
          Only shown for agents who have already selected a mode.
          Hidden for dealers, hidden when sessionMode is still null (dialog handles that).
        */}
        {!isDealer && sessionMode !== null && (
          <Tooltip
            title={
              switchingMode
                ? 'Switching mode…'
                : callStatus !== 'idle'
                  ? 'Cannot switch mode while a call is in progress'
                  : hasActiveInteraction
                    ? 'Close the current interaction before switching mode'
                    : 'Switch work mode'
            }
          >
            {/* Wrapper keeps Tooltip working while ToggleButtonGroup is disabled */}
            <Box component="span">
              <ToggleButtonGroup
                value={sessionMode}
                exclusive
                size="small"
                onChange={(_e, val) => {
                  if (val) handleModeSwitch(val as SessionMode);
                }}
                disabled={switchingMode || callStatus !== 'idle' || hasActiveInteraction}
                aria-label="Work mode"
                sx={{
                  height: 28,
                  bgcolor: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 1,
                  '& .MuiToggleButtonGroup-grouped': {
                    border: 0,
                    borderRadius: '4px !important',
                    mx: 0.25,
                  },
                  '& .MuiToggleButton-root': {
                    color: 'rgba(255,255,255,0.55)',
                    px: 1.25,
                    py: 0,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    letterSpacing: 0.2,
                    transition: 'background-color 150ms ease, color 150ms ease',
                    '&.Mui-selected': {
                      color: '#FFFFFF',
                      bgcolor: '#EB6A2C',
                      '&:hover': { bgcolor: '#C45A24' },
                    },
                    '&:hover:not(.Mui-selected)': {
                      bgcolor: 'rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.85)',
                    },
                    '&.Mui-disabled': {
                      color: 'rgba(255,255,255,0.25)',
                    },
                    '&.Mui-selected.Mui-disabled': {
                      color: 'rgba(255,255,255,0.55)',
                      bgcolor: 'rgba(235,106,44,0.45)',
                    },
                  },
                }}
              >
                <ToggleButton value="manual" aria-label="Manual mode">
                  Manual
                </ToggleButton>
                <ToggleButton value="cti" aria-label="CTI mode">
                  {switchingMode && sessionMode !== 'cti' ? (
                    <CircularProgress size={10} sx={{ color: 'inherit', mr: 0.5 }} />
                  ) : null}
                  CTI
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Tooltip>
        )}

        {/*
          Agent status / interaction control — hidden entirely for dealer users.
          Three render paths based on sessionMode (agents only):
          1. manual mode  → "New Interaction" button + "Make a Call" button
          2. cti + on_call/wrap_up → read-only system-managed status chip
          3. everything else (cti idle, no mode yet) → full AgentStatusWidget
        */}
        {!isDealer && (
          sessionMode === 'manual' ? (
            <>
            <Tooltip
              title={
                hasActiveInteraction
                  ? 'An interaction is already in progress'
                  : ''
              }
              disableHoverListener={canStartInteraction}
              disableFocusListener={canStartInteraction}
              disableTouchListener={canStartInteraction}
            >
              {/* Span wrapper keeps Tooltip working when Button is disabled */}
              <Box component="span">
                <Button
                  variant="contained"
                  size="small"
                  startIcon={
                    startingInteraction ? (
                      <CircularProgress size={14} sx={{ color: '#FFFFFF' }} />
                    ) : (
                      <AddIcon fontSize="small" />
                    )
                  }
                  onClick={handleNewInteraction}
                  disabled={!canStartInteraction || startingInteraction}
                  aria-label="Start a new interaction"
                  aria-busy={startingInteraction}
                  sx={{
                    bgcolor: '#EB6A2C',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: '#C45A24' },
                    '&.Mui-disabled': {
                      bgcolor: '#EB6A2C',
                      opacity: 0.5,
                      color: '#FFFFFF',
                      cursor: 'not-allowed',
                      pointerEvents: 'auto',
                    },
                  }}
                >
                  {startingInteraction ? 'Starting…' : 'New Interaction'}
                </Button>
              </Box>
            </Tooltip>

            {/* Make a Call button - opens CtiDialpad in a Popover */}
            <Tooltip
              title={
                hasActiveInteraction
                  ? 'Cannot make a call while an interaction is active'
                  : callStatus !== 'idle'
                    ? 'A call is already in progress'
                    : ''
              }
              disableHoverListener={canMakeCall}
              disableFocusListener={canMakeCall}
              disableTouchListener={canMakeCall}
            >
              <Box component="span">
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PhoneForwardedIcon fontSize="small" />}
                  onClick={(e) => setDialpadAnchor(dialpadOpen ? null : e.currentTarget)}
                  disabled={!canMakeCall}
                  aria-label="Make an outbound call"
                  aria-expanded={dialpadOpen}
                  aria-haspopup="true"
                  sx={{
                    bgcolor: '#1565C0',
                    color: '#FFFFFF',
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.18)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    minWidth: 114,
                    '&:hover': {
                      bgcolor: '#0D47A1',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.28)',
                    },
                    '&:focus-visible': {
                      outline: '2px solid #FFFFFF',
                      outlineOffset: 2,
                    },
                    '&.Mui-disabled': {
                      bgcolor: '#1565C0',
                      color: '#FFFFFF',
                      opacity: 0.45,
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.12)',
                      cursor: 'not-allowed',
                      pointerEvents: 'auto',
                    },
                  }}
                >
                  Make a Call
                </Button>
              </Box>
            </Tooltip>

            {/* CtiDialpad popover */}
            <Popover
              open={dialpadOpen}
              anchorEl={dialpadAnchor}
              onClose={() => setDialpadAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={{
                sx: { mt: 1, p: 2, minWidth: 280 },
              }}
            >
              <CtiDialpad />
            </Popover>
            </>
          ) : showCtiReadOnlyChip ? (
            /* CTI system-managed status — read-only; agent cannot change while on call / in wrap-up */
            <Chip
              size="medium"
              variant="outlined"
              aria-label={
                isCtiOnCall
                  ? 'System status: On Call — call in progress'
                  : 'System status: Wrap Up — completing call wrap-up'
              }
              label={
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 500, color: isCtiOnCall ? '#2e7d32' : '#e65100' }}
                >
                  {isCtiOnCall ? 'On Call' : 'Wrap Up'}
                </Typography>
              }
              sx={{
                bgcolor: isCtiOnCall ? '#f1f8e9' : '#fff8e1',
                borderColor: isCtiOnCall ? '#c5e1a5' : '#ffe082',
                cursor: 'default',
              }}
            />
          ) : (
            /* Default: full interactive status widget */
            <AgentStatusWidget />
          )
        )}

        {/* Seeded data reference — opens standalone HTML doc in a new tab (dev only) */}
        <Tooltip title="Seeded &amp; Mock Data Reference">
          <IconButton
            size="small"
            aria-label="Seeded and mock data reference"
            component="a"
            href="/seeded-data-reference.html"
            target="_blank"
            rel="noopener noreferrer"
            sx={ICON_BUTTON_SX}
          >
            <MenuBookOutlinedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        {/* Notification bell */}
        <Tooltip title="Notifications">
          <IconButton
            size="small"
            aria-label="Notifications"
            sx={ICON_BUTTON_SX}
          >
            <NotificationsOutlinedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        {/* Agent avatar with dropdown */}
        {loggingOut ? (
          <CircularProgress size={24} sx={{ color: '#FFFFFF', mx: 0.5 }} aria-label="Signing out" />
        ) : (
          <>
            <Tooltip title="Agent profile">
              <IconButton
                size="small"
                onClick={(e) => setAvatarAnchor(e.currentTarget)}
                aria-label="Agent profile"
                aria-haspopup="menu"
                aria-expanded={avatarMenuOpen}
                sx={{ p: 0.25 }}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontSize: '0.75rem',  // sm: 12px
                    bgcolor: '#EB6A2C',   // brand orange
                    color: '#FFFFFF',
                    fontWeight: 600,
                  }}
                  aria-hidden="true"
                >
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={avatarAnchor}
              open={avatarMenuOpen}
              onClose={() => setAvatarAnchor(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              MenuListProps={{ 'aria-label': 'Agent account menu' }}
            >
              {displayName && (
                <MenuItem disabled sx={{ opacity: 1 }}>
                  <Box>
                    <Typography variant="body1" fontWeight={600} color="text.primary">
                      {displayName}
                    </Typography>
                    {user?.username && (
                      <Typography variant="caption" color="text.secondary">
                        {user.username}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              )}
              <Divider />
              <MenuItem
                onClick={handleLogout}
                aria-label="Sign out"
              >
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Sign out
              </MenuItem>
            </Menu>
          </>
        )}
      </Toolbar>

      {/* Error toast for header "New Interaction" failures */}
      <Snackbar
        open={errorToastOpen}
        autoHideDuration={8_000}
        onClose={() => setErrorToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setErrorToastOpen(false)}
          role="alert"
        >
          {newInteractionError}
        </Alert>
      </Snackbar>
    </AppBar>
  );
}

/**
 * CtiIdleWorkspace — shown when sessionMode is 'cti' and no interaction is active.
 *
 * Layout (column):
 *   Top:   CtiActiveCallBar — self-guarded; only visible when callStatus === 'active'
 *          && callDirection === 'inbound'.  Ensures the agent always has mute/hold/
 *          hang-up controls during the window when createInteractionFromCall is in-flight
 *          (interactionId === null) or if it fails.  Disappears once InteractionPanel
 *          takes over (interactionId becomes non-null).
 *   Below: Two-column body
 *     Left (300px): SearchPanel — disabled (pointer-events: none) when idle/ringing.
 *     Right (flex 1): Status-aware placeholder when idle/ringing.
 *                     - READY_FOR_CALLS → "Ready for Calls" (active state)
 *                     - OFFLINE/BREAK/TRAINING → status-specific message + CTA
 *                     Pre-fetched SearchResults when active + results found.
 *                     Warning + empty state when active + withheld/no results.
 *
 * Source: CCM Phase 1.5 — Wave 3 spec
 */

import React from 'react';
import { Alert, Box, Chip, Typography } from '@mui/material';
import HeadsetMicOutlinedIcon from '@mui/icons-material/HeadsetMicOutlined';
import HeadsetOffOutlinedIcon from '@mui/icons-material/HeadsetOffOutlined';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import { useCtiStore } from './ctiStore';
import { CtiActiveCallBar } from './CtiActiveCallBar';
import { useAgentStatusStore } from '@/features/agent-status/agentStatusStore';
import { AgentStatus } from '@ccm/types';
import { SearchPanel } from '@/features/search/SearchPanel';
import { SearchResults } from '@/features/search/SearchResults';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Status-aware idle content config
// ---------------------------------------------------------------------------

interface IdleContentConfig {
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  heading: string;
  subtext: string;
  chipLabel?: string;
  chipColor?: 'default' | 'warning' | 'error' | 'info';
}

function getIdleContent(status: AgentStatus): IdleContentConfig {
  switch (status) {
    case AgentStatus.READY_FOR_CALLS:
      return {
        icon: <HeadsetMicOutlinedIcon sx={{ fontSize: 56, color: 'primary.main' }} />,
        iconBgColor: 'rgba(235,106,44,0.08)',
        iconColor: 'primary.main',
        heading: 'Ready for Calls',
        subtext: 'Your workstation is connected. Customer details will appear here when a call connects.',
      };
    case AgentStatus.OFFLINE:
      return {
        icon: <HeadsetOffOutlinedIcon sx={{ fontSize: 56, color: 'text.disabled' }} />,
        iconBgColor: 'action.hover',
        iconColor: 'text.disabled',
        heading: 'You are Offline',
        subtext: 'Inbound calls will not be routed to you while you are offline. Change your status to Ready for Calls to start receiving calls.',
        chipLabel: 'Offline',
        chipColor: 'default',
      };
    case AgentStatus.BREAK:
      return {
        icon: <HeadsetOffOutlinedIcon sx={{ fontSize: 56, color: 'warning.main' }} />,
        iconBgColor: 'rgba(237,108,2,0.08)',
        iconColor: 'warning.main',
        heading: 'You are on Break',
        subtext: 'Inbound calls are paused while you are on break. Change your status to Ready for Calls when you return.',
        chipLabel: 'Break',
        chipColor: 'warning',
      };
    case AgentStatus.TRAINING:
      return {
        icon: <HeadsetOffOutlinedIcon sx={{ fontSize: 56, color: 'info.main' }} />,
        iconBgColor: 'rgba(2,136,209,0.08)',
        iconColor: 'info.main',
        heading: 'You are in Training',
        subtext: 'Inbound calls will not be routed to you during training. Change your status to Ready for Calls when you are done.',
        chipLabel: 'Training',
        chipColor: 'info',
      };
    default:
      return {
        icon: <HeadsetMicOutlinedIcon sx={{ fontSize: 56, color: 'primary.main' }} />,
        iconBgColor: 'rgba(235,106,44,0.08)',
        iconColor: 'primary.main',
        heading: 'Ready for Calls',
        subtext: 'Your workstation is connected. Customer details will appear here when a call connects.',
      };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CtiIdleWorkspace() {
  const callStatus = useCtiStore((s) => s.callStatus);
  const preFetchedResults = useCtiStore((s) => s.preFetchedResults);
  const isWithheld = useCtiStore((s) => s.isWithheld);
  const currentStatus = useAgentStatusStore((s) => s.currentStatus);

  const isActive = callStatus === 'active';
  const searchDisabled = callStatus === 'idle' || callStatus === 'ringing';

  // Derive idle content from actual agent status — never hardcode "Ready for Calls"
  const idleContent = getIdleContent(currentStatus);

  // Shared left-column styles — mirrors InteractionPanel leftColumnSx
  const leftColumnSx = {
    width: { xs: '100%', lg: 300 },
    flexShrink: 0,
    bgcolor: '#FFFFFF',
    borderRight: { lg: '1px solid #DEE4EB' },
    overflowY: 'auto' as const,
    // minHeight removed — height is now governed by the flex:1 two-column wrapper
    p: 2,
  };

  const hasResults =
    isActive && !isWithheld && preFetchedResults !== null && preFetchedResults.length > 0;

  const showWarning = isActive && (isWithheld || (preFetchedResults !== null && preFetchedResults.length === 0));

  return (
    <Box
      component="main"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
      }}
    >
      {/*
       * Active inbound call controls — rendered here so the agent always has
       * mute / hold / hang-up even while createInteractionFromCall is still
       * in-flight (interactionId === null) or if it fails.
       * CtiActiveCallBar is self-guarded: returns null unless
       * callStatus === 'active' && callDirection === 'inbound'.
       * Once the interaction is created WorkspacePage switches to
       * InteractionPanel which contains its own CtiActiveCallBar.
       */}
      <CtiActiveCallBar />

      {/* ── Two-column body ── */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          flex: 1,
          overflow: 'hidden',
        }}
      >
      {/* ── Left column: SearchPanel (disabled until active) ── */}
      <Box sx={leftColumnSx}>
        {searchDisabled ? (
          <Box sx={{ pointerEvents: 'none', opacity: 0.5 }}>
            <SearchPanel />
          </Box>
        ) : (
          <SearchPanel />
        )}
      </Box>

      {/* ── Right column ── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          bgcolor: 'background.default',
        }}
      >
        {/* Idle / Ringing: status-aware centred placeholder */}
        {!isActive && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 2,
              p: 4,
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                bgcolor: idleContent.iconBgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {idleContent.icon}
            </Box>

            {/* Status chip — only shown for non-ready statuses */}
            {idleContent.chipLabel && (
              <Chip
                label={idleContent.chipLabel}
                color={idleContent.chipColor}
                size="small"
                variant="outlined"
                aria-label={`Current status: ${idleContent.chipLabel}`}
              />
            )}

            <Typography variant="h2" fontWeight={500}>
              {idleContent.heading}
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              textAlign="center"
              maxWidth={400}
            >
              {idleContent.subtext}
            </Typography>

            {/* CTA hint for non-ready statuses */}
            {currentStatus !== AgentStatus.READY_FOR_CALLS && (
              <Typography
                variant="caption"
                color="text.disabled"
                textAlign="center"
                sx={{ mt: 1 }}
              >
                Use the status selector in the top bar to change your availability.
              </Typography>
            )}
          </Box>
        )}

        {/* Active + results found: show pre-populated SearchResults */}
        {hasResults && preFetchedResults && (
          <Box sx={{ p: 2 }}>
            <SearchResults results={preFetchedResults} />
          </Box>
        )}

        {/* Active + withheld or no results: warning + empty state */}
        {showWarning && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 2,
              p: 4,
            }}
          >
            <Alert severity="warning" sx={{ mb: 2, width: '100%', maxWidth: 480 }}>
              No caller details found. The number may be withheld or unrecognised. Search
              manually.
            </Alert>
            <Box
              aria-hidden="true"
              sx={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                bgcolor: 'action.hover',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PersonSearchOutlinedIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
            </Box>
            <Typography variant="h2" fontWeight={500}>
              No Caller Details
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              textAlign="center"
              maxWidth={360}
            >
              Use the search panel on the left to find the customer manually.
            </Typography>
          </Box>
        )}
      </Box>
      </Box>
    </Box>
  );
}

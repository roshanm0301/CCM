/**
 * WorkspacePage — the main authenticated page (all interaction screens).
 *
 * Phase 1 layout:
 * - GlobalHeader (fixed, 64px, full width)
 * - NavRail (fixed left, 56px on md+, hidden on xs/sm)
 * - Main content (ml: '56px' on md+, mt: '64px'):
 *   - IdleWorkspace  — when no active interaction
 *   - InteractionPanel — when interaction is in progress
 *
 * Source: CCM_Phase1_Agent_Interaction_Documentation.md
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { GlobalHeader } from '@/shared/components/GlobalHeader';
import { NavRail } from '@/shared/components/NavRail';
import { IdleWorkspace } from '@/features/workspace/IdleWorkspace';
import { InteractionPanel } from '@/features/interaction/InteractionPanel';
import { useInteractionStore } from '@/features/interaction/interactionStore';
import { CtiClientInitializer } from '@/features/cti/CtiClientInitializer';
import { CtiCallBar } from '@/features/cti/CtiCallBar';
import { CtiModeSelectionDialog } from '@/features/cti/CtiModeSelectionDialog';
import { CtiIdleWorkspace } from '@/features/cti/CtiIdleWorkspace';
import { useAuthStore } from '@/features/auth/authStore';

export function WorkspacePage() {
  const interactionId = useInteractionStore((s) => s.interactionId);
  const status = useInteractionStore((s) => s.status);
  const resetInteraction = useInteractionStore((s) => s.resetInteraction);
  const isWrapupPending = useInteractionStore((s) => s.isWrapupPending);

  const { isAuthenticated, sessionMode } = useAuthStore();

  // An interaction panel is shown for any state that is not null.
  // Screen 7 (CLOSED/INCOMPLETE) is rendered inside InteractionPanel itself.
  const hasActiveInteraction = Boolean(interactionId) && status !== null;

  // After Screen 7 "Start New Interaction" click, the panel calls this
  function handleInteractionComplete() {
    resetInteraction();
  }

  // Callback from IdleWorkspace when interaction is started manually.
  // The interaction store is already updated by IdleWorkspace; the store
  // subscription above re-renders this component automatically.
  function handleInteractionStarted() {
    // intentional no-op — store update triggers re-render
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Fixed 64px dark header */}
      <GlobalHeader />

      {/* CTI SDK — only initialised when agent chose CTI mode */}
      {sessionMode === 'cti' && <CtiClientInitializer />}

      {/* Session mode gate — blocks workspace until agent selects a mode */}
      {isAuthenticated && sessionMode === null && <CtiModeSelectionDialog />}

      {/* CTI incoming-call banner — fixed overlay, z-index 1400 */}
      <CtiCallBar />

      {/* Permanent left nav rail — 56px on md+, hidden on xs/sm */}
      <NavRail activeItem="home" />

      {/* Main content — offset for fixed header (64px) + left nav rail (56px on md+) */}
      <Box
        sx={{
          mt: '64px',                // below fixed header
          ml: { xs: 0, md: '56px' }, // beside nav rail on md+
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!hasActiveInteraction && sessionMode === 'cti' && (
          <CtiIdleWorkspace />
        )}

        {!hasActiveInteraction && sessionMode !== 'cti' && (
          <IdleWorkspace onInteractionStarted={handleInteractionStarted} />
        )}

        {hasActiveInteraction && (
          <>
            {isWrapupPending && (
              <Box
                role="status"
                aria-live="polite"
                sx={{
                  bgcolor: 'warning.50',
                  borderBottom: '1px solid',
                  borderColor: 'warning.200',
                  px: 3,
                  py: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <LockOutlinedIcon sx={{ fontSize: 16, color: 'warning.700' }} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'warning.700' }}>
                  Wrap-up required before continuing
                </Typography>
              </Box>
            )}
            <InteractionPanel onInteractionComplete={handleInteractionComplete} />
          </>
        )}
      </Box>
    </Box>
  );
}

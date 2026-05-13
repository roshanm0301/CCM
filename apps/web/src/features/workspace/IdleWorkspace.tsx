/**
 * IdleWorkspace — Landing screen shown when no interaction is active (manual mode).
 *
 * All CTAs have moved to GlobalHeader:
 * - "+ New Interaction" button starts a manual interaction.
 * - "Make a Call" button opens the outbound dialpad.
 */

import React from 'react';
import { Box } from '@mui/material';

// Props kept for API compatibility with WorkspacePage
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface IdleWorkspaceProps {
  onInteractionStarted: () => void;
}

export function IdleWorkspace(_props: IdleWorkspaceProps) {
  return (
    <Box
      component="main"
      sx={{
        display: 'flex',
        flexGrow: 1,
        minHeight: 'calc(100vh - 64px)',
        bgcolor: 'background.default',
      }}
    />
  );
}

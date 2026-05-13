/**
 * InteractionActions — Screen 7 post-closure confirmation card.
 *
 * Shows confirmation after Close or Mark Incomplete.
 * Inline confirmation — not a modal.
 * "Start New Interaction" resets workspace.
 * autoFocus on the action button per accessibility spec.
 *
 * Source: ux-specification.md Screen 7
 */

import React, { useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
} from '@mui/material';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';

interface InteractionActionsProps {
  outcome: 'CLOSED' | 'INCOMPLETE';
  interactionId: string;
  onStartNew: () => void;
}

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}\u2026` : id;
}

export function InteractionActions({
  outcome,
  interactionId,
  onStartNew,
}: InteractionActionsProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus "Start New Interaction" on render per spec §7.10
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  const isClosed = outcome === 'CLOSED';
  const truncatedId = truncateId(interactionId);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        bgcolor: 'background.default',
        px: { xs: 2, md: 0 },
      }}
    >
      <Card
        elevation={0}
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: { xs: '100%', md: 480 },
          borderRadius: 2,
        }}
      >
        <CardContent
          sx={{
            p: { xs: 3, md: 4 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            textAlign: 'center',
          }}
        >
          {/* Status icon */}
          {isClosed ? (
            <CheckCircleOutlinedIcon
              color="success"
              fontSize="large"
              sx={{ fontSize: 48 }}
              aria-hidden="true"
            />
          ) : (
            <WarningAmberOutlinedIcon
              color="warning"
              fontSize="large"
              sx={{ fontSize: 48 }}
              aria-hidden="true"
            />
          )}

          {/* Heading — role="alert" so screen readers announce immediately */}
          <Typography
            variant="h2"
            component="h2"
            color="text.primary"
            role="alert"
          >
            {isClosed ? 'Interaction Closed' : 'Interaction Marked Incomplete'}
          </Typography>

          {/* Body */}
          <Typography variant="body1" color="text.secondary">
            {isClosed
              ? `Interaction ${truncatedId} has been closed successfully. You may start a new interaction.`
              : `Interaction ${truncatedId} has been marked as incomplete. You may start a new interaction.`}
          </Typography>

          {/* CTA button */}
          <Button
            id="start-next-interaction-btn"
            ref={buttonRef}
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            onClick={onStartNew}
            aria-label="Start a new interaction"
            sx={{ mt: 1 }}
          >
            Start New Interaction
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

/**
 * InteractionMetaBar — sticky bar below the global header during Screens 3–6.
 *
 * Visual redesign per ux-specification-v2.md Screen 6 — Interaction Meta Bar.
 *
 * Shows: Interaction ID, start time, elapsed timer, status chip.
 * Background: background.paper
 * Bottom border: theme.palette.divider (secondary[200])
 * Height: 48px, position: sticky, top: 64px (below GlobalHeader)
 *
 * Status chip color rules per ux-specification-v2.md §B cross-screen spec.
 *
 * Source: ux-specification-v2.md Screen 6 §Interaction Meta Bar
 */

import React from 'react';
import type { Theme } from '@mui/material/styles';
import { Box, Chip, Typography } from '@mui/material';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import { ElapsedTimer } from './ElapsedTimer';
import { InteractionStatus } from '@ccm/types';

interface InteractionMetaBarProps {
  interactionId: string;
  startedAt: string;
  status: InteractionStatus;
  stopped?: boolean;
  channel?: 'manual' | 'inbound_call' | null;
  ctiFromNumber?: string | null;
}

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const STATUS_CHIP_COLOR: Record<InteractionStatus, ChipColor> = {
  [InteractionStatus.NEW]: 'warning',
  [InteractionStatus.IDENTIFYING]: 'warning',
  [InteractionStatus.CONTEXT_CONFIRMED]: 'info',
  [InteractionStatus.WRAPUP]: 'primary',
  [InteractionStatus.CLOSED]: 'success',
  [InteractionStatus.INCOMPLETE]: 'warning',
};

const STATUS_LABEL: Record<InteractionStatus, string> = {
  [InteractionStatus.NEW]: 'New',
  [InteractionStatus.IDENTIFYING]: 'Identifying',
  [InteractionStatus.CONTEXT_CONFIRMED]: 'Context Confirmed',
  [InteractionStatus.WRAPUP]: 'Wrap-up',
  [InteractionStatus.CLOSED]: 'Closed',
  [InteractionStatus.INCOMPLETE]: 'Incomplete',
};

function formatStartTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}\u2026` : id;
}

export function InteractionMetaBar({
  interactionId,
  startedAt,
  status,
  stopped = false,
  channel,
  ctiFromNumber,
}: InteractionMetaBarProps) {
  const chipColor = STATUS_CHIP_COLOR[status] ?? 'default';
  const chipLabel = STATUS_LABEL[status] ?? status;

  return (
    <Box
      component="div"
      aria-label="Interaction status"
      sx={{
        position: 'sticky',
        top: 64,              // below the 64px global header
        zIndex: (theme) => theme.zIndex.appBar - 1,
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, md: 2 },
        px: { xs: 2, md: 3 },
        bgcolor: 'background.paper',
        borderBottom: (theme: Theme) => `1px solid ${theme.palette.divider}`,
        flexShrink: 0,
      }}
    >
      {/* Interaction ID — hidden on xs */}
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          display: { xs: 'none', md: 'block' },
          whiteSpace: 'nowrap',
        }}
        aria-label={`Interaction ID ${interactionId}`}
      >
        #{truncateId(interactionId)}
      </Typography>

      {/* Start time — hidden on xs */}
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          display: { xs: 'none', md: 'block' },
          whiteSpace: 'nowrap',
        }}
        aria-label={`Started at ${formatStartTime(startedAt)}`}
      >
        {formatStartTime(startedAt)}
      </Typography>

      {/* Elapsed timer — always visible */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary' }}
          component="span"
        >
          Elapsed:
        </Typography>
        <ElapsedTimer startTimestamp={startedAt} stopped={stopped} />
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      {/* Status chip */}
      <Chip
        label={chipLabel}
        color={chipColor}
        size="small"
        variant="outlined"
        aria-label={`Interaction status: ${chipLabel}`}
      />

      {/* Inbound call badge — shown only for CTI-originated interactions */}
      {channel === 'inbound_call' && (
        <Chip
          icon={<PhoneInTalkIcon fontSize="small" />}
          label={ctiFromNumber ? `Inbound ${ctiFromNumber}` : 'Inbound Call'}
          size="small"
          color="success"
          variant="outlined"
          aria-label={`Inbound call from ${ctiFromNumber ?? 'unknown number'}`}
          sx={{ display: { xs: 'none', sm: 'flex' } }}
        />
      )}
    </Box>
  );
}

/**
 * DealerCard — Left Panel context card for Dealer Details.
 *
 * Layout (per Agent.docx / Left Search Panel spec):
 * - Section label "Dealer Details" (caption)
 * - Header row: Dealer name (bold 14px) + Active/Inactive chip (right-aligned)
 * - Fields (label/value 2-col): Code, Type, Branch, ASC, Contact, Address
 *
 * Business logic: missing dealer does not block the interaction.
 *
 * Source: Agent.docx §Left Search Panel — Dealer Details
 */

import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Skeleton,
  Typography,
} from '@mui/material';
import type { DealerContext } from '@/features/interaction/interactionStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FieldRowProps {
  label: string;
  value: string | boolean | null | undefined;
}

function FieldRow({ label, value }: FieldRowProps) {
  const displayValue = typeof value === 'boolean' ? (value ? 'Active' : 'Inactive') : value;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '40% 60%',
        mb: 0.5,
        alignItems: 'flex-start',
      }}
    >
      <Typography
        component="dt"
        sx={{
          fontSize: 'sm',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{
          fontSize: 'sm',
          color: displayValue ? 'text.primary' : 'text.disabled',
          margin: 0,
          wordBreak: 'break-word',
        }}
      >
        {displayValue || 'Not available'}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DealerCardProps {
  data: DealerContext | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DealerCard({ data, loading, error, onRetry }: DealerCardProps) {
  return (
    <Box
      component="section"
      aria-label="Dealer details"
      aria-busy={loading}
      sx={{
        bgcolor: '#FFFFFF',
        borderRadius: 1.5,
        border: '1px solid #DEE4EB',
        p: 1.5,
      }}
    >
      {/* Section label */}
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          display: 'block',
          mb: 0.75,
          fontSize: 'sm',
          fontWeight: 'medium',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Dealer Details
      </Typography>

      {/* Header: Dealer name + Active/Inactive chip */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1,
          gap: 1,
        }}
      >
        <Typography
          component="h3"
          sx={{
            fontSize: 'base',
            fontWeight: 'strong',
            color: 'text.primary',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? <Skeleton width={140} /> : (data?.dealerName ?? '—')}
        </Typography>

        {data && !loading && !error && (
          <Chip
            label={data.isActive ? 'Active' : 'Inactive'}
            size="small"
            aria-label={`Dealer status: ${data.isActive ? 'Active' : 'Inactive'}`}
            sx={{
              flexShrink: 0,
              bgcolor: data.isActive ? '#ECFDF3' : '#F4F7FA',
              border: `1px solid ${data.isActive ? '#ABEFC6' : '#DEE4EB'}`,
              color: data.isActive ? '#067647' : '#6A7682',
              borderRadius: 99,
              height: 18,
              fontSize: 'xs',
              fontWeight: 'strong',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
      </Box>

      {/* Loading state */}
      {loading && (
        <Box>
          <LinearProgress sx={{ mb: 1 }} aria-label="Loading dealer details" />
          {[1, 2, 3, 4].map((i) => (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '40% 60%', mb: 0.5 }}>
              <Skeleton variant="text" width="80%" height={14} />
              <Skeleton variant="text" width="90%" height={14} />
            </Box>
          ))}
        </Box>
      )}

      {/* Error state */}
      {error && !loading && (
        <Alert
          severity="warning"
          sx={{ py: 0.5, fontSize: 'sm' }}
          action={
            onRetry && (
              <Button
                size="small"
                variant="text"
                onClick={onRetry}
                aria-label="Retry loading dealer details"
              >
                Retry
              </Button>
            )
          }
        >
          Dealer details unavailable.
        </Alert>
      )}

      {/* Data state */}
      {data && !loading && !error && (
        <Box component="dl" sx={{ m: 0 }}>
          <FieldRow label="Code" value={data.dealerCode} />
          <FieldRow label="Type" value={data.dealerType} />
          <FieldRow label="Branch" value={data.branchName} />
          <FieldRow label="City" value={data.city} />
          <FieldRow label="Address" value={data.address} />
        </Box>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <Alert severity="warning" sx={{ py: 0.5, fontSize: 'sm' }}>
          Dealer details are unavailable.
        </Alert>
      )}
    </Box>
  );
}

/**
 * VehicleCard — Left Panel context card for Vehicle Details.
 *
 * Layout (per Agent.docx / Left Search Panel spec + redesign tests):
 * - Section label "Vehicle Details" (caption)
 * - Header row: Registration number (bold 14px) + "Vehicle history" link (right, disabled Phase 1)
 * - Fields (label/value 2-col):
 *     Model/Variant  (combined)
 *     Chassis Number (masked)
 *     Sold On
 *     Last Service
 *     Dealer
 *
 * Security: chassis number ALWAYS rendered from chassisNumberMasked field.
 * NEVER renders raw chassis number — source: security-principles.md
 *
 * Source: Agent.docx §Left Search Panel — Vehicle Details
 */

import React from 'react';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Skeleton,
  Typography,
} from '@mui/material';
import type { VehicleContext } from '@/features/interaction/interactionStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface FieldRowProps {
  label: string;
  value: string | null | undefined;
  ariaLabel?: string;
}

function FieldRow({ label, value, ariaLabel }: FieldRowProps) {
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
          color: value ? 'text.primary' : 'text.disabled',
          margin: 0,
          wordBreak: 'break-word',
        }}
        aria-label={ariaLabel}
      >
        {value || 'Not available'}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VehicleCardProps {
  data: VehicleContext | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  dealerName?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VehicleCard({ data, loading, error, onRetry, dealerName }: VehicleCardProps) {
  return (
    <Box
      component="section"
      aria-label="Vehicle details"
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
        Vehicle Details
      </Typography>

      {/* Header: Registration number + Vehicle history link */}
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
          {loading ? <Skeleton width={120} /> : (data?.registrationNumber ?? '—')}
        </Typography>

        {/* Vehicle history — Phase 2+ placeholder; only rendered when data is present */}
        {data && !loading && !error && (
          <Button
            variant="text"
            size="small"
            disabled
            aria-label="Vehicle History — available in a future phase"
            sx={{
              fontSize: 'sm',
              fontWeight: 'medium',
              color: '#EB6A2C',
              p: 0,
              minWidth: 0,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              '&.Mui-disabled': { color: 'text.disabled' },
              flexShrink: 0,
            }}
          >
            Vehicle history
          </Button>
        )}
      </Box>

      {/* Loading state */}
      {loading && (
        <Box>
          <LinearProgress sx={{ mb: 1 }} aria-label="Loading vehicle details" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
                aria-label="Retry loading vehicle details"
              >
                Retry
              </Button>
            )
          }
        >
          Vehicle details unavailable.
        </Alert>
      )}

      {/* Data state */}
      {data && !loading && !error && (
        <Box component="dl" sx={{ m: 0 }}>
          {/* Product Type */}
          <FieldRow label="Product Type" value={data.productType} />
          {/* Model/Variant — combined into a single row */}
          <FieldRow
            label="Model/Variant"
            value={[data.modelName, data.variant].filter(Boolean).join(' ') || null}
          />
          {/* Chassis number — ALWAYS from chassisNumberMasked, never raw */}
          <FieldRow
            label="Chassis Number"
            value={data.chassisNumberMasked}
            ariaLabel="Chassis number partially masked"
          />
          <FieldRow label="Sold On" value={formatDate(data.soldOnDate)} />
          <FieldRow label="Last Service" value={formatDate(data.lastServiceDate)} />
          <FieldRow label="Dealer" value={dealerName ?? null} />
        </Box>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <Alert severity="warning" sx={{ py: 0.5, fontSize: 'sm' }}>
          Vehicle details unavailable.
        </Alert>
      )}
    </Box>
  );
}

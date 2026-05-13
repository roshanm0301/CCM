/**
 * CustomerCard — Left Panel context card for Customer Details.
 *
 * Layout (per Agent.docx / Left Search Panel spec):
 * - Section label "Customer Details" (caption)
 * - Header row: Contact name (bold 14px) + "360 View" link (right-aligned, disabled Phase 1)
 * - Fields (label/value 2-col): Contact, Mobile (masked), Alt Mobile (masked), Email, Address
 *
 * Security: mobile numbers always masked — last 4 digits visible only.
 *
 * Source: Agent.docx §Left Search Panel — Customer Details
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
import type { CustomerContext } from '@/features/interaction/interactionStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskMobile(mobile: string): string {
  if (!mobile) return '';
  if (mobile.length <= 4) return mobile;
  return 'x'.repeat(mobile.length - 4) + mobile.slice(-4);
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
          fontSize: 'sm',          // 11px → sm token (12px)
          color: 'text.secondary', // secondary[600]
        }}
      >
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{
          fontSize: 'sm',          // 11px → sm token (12px)
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

interface CustomerCardProps {
  data: CustomerContext | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onChangeSelection?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CustomerCard({ data, loading, error, onRetry, onChangeSelection }: CustomerCardProps) {
  return (
    <Box
      component="section"
      aria-label="Customer details"
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
        Customer Details
      </Typography>

      {/* Header: Name + 360 View link */}
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
          {loading ? <Skeleton width={120} /> : (data?.contactName ?? '—')}
        </Typography>

        {/* 360 View — Phase 2+ placeholder; only rendered when data is present */}
        {data && !loading && !error && (
          <Button
            variant="text"
            size="small"
            disabled
            aria-label="360 View — available in a future phase"
            sx={{
              fontSize: 'sm',
              fontWeight: 'medium',
              color: '#EB6A2C',
              p: 0,
              minWidth: 0,
              textTransform: 'none',
              '&.Mui-disabled': { color: 'text.disabled' },
              flexShrink: 0,
            }}
          >
            360 View
          </Button>
        )}
      </Box>

      {/* Loading state */}
      {loading && (
        <Box>
          <LinearProgress sx={{ mb: 1 }} aria-label="Loading customer details" />
          {[1, 2, 3].map((i) => (
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
                aria-label="Retry loading customer details"
              >
                Retry
              </Button>
            )
          }
        >
          Customer details unavailable.
        </Alert>
      )}

      {/* Data state */}
      {data && !loading && !error && (
        <Box component="dl" sx={{ m: 0 }}>
          <FieldRow label="Contact Name" value={data.contactName} />
          <FieldRow
            label="Primary Mobile"
            value={data.primaryMobile ? maskMobile(data.primaryMobile) : null}
            ariaLabel="Primary mobile, partially masked"
          />
          {data.secondaryMobile && (
            <FieldRow
              label="Secondary Mobile"
              value={maskMobile(data.secondaryMobile)}
              ariaLabel="Secondary mobile, partially masked"
            />
          )}
          <FieldRow label="Email" value={data.emailId} />
          <FieldRow label="Address" value={data.address} />
        </Box>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <Alert severity="warning" sx={{ py: 0.5, fontSize: 'sm' }}>
          Customer details unavailable.
        </Alert>
      )}

      {/* Change selection */}
      {onChangeSelection && data && !loading && (
        <Box sx={{ mt: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={onChangeSelection}
            aria-label="Change selected customer — returns to search results"
            sx={{
              fontSize: 'sm',
              borderColor: '#DEE4EB',
              color: 'text.secondary',
              textTransform: 'none',
              py: 0.25,
            }}
          >
            Change
          </Button>
        </Box>
      )}
    </Box>
  );
}

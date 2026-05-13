/**
 * ResolutionTab — full Resolution tab for the post-case-registration screen.
 * Loads the resolution activity state (current activity + history) via TanStack
 * Query and renders ResolutionActivityForm + a history table.
 *
 * Source: CCM Phase 6 Resolution Activities spec.
 */

import React from 'react';
import {
  Alert,
  Box,
  Chip,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadResolutionTab } from './resolutionApi';
import type { ResolutionTabDto, ResolutionActivityDto, SaveActivityResult } from './resolutionApi';
import { ResolutionActivityForm } from './ResolutionActivityForm';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { formatDateTime } from '@/shared/utils/dateFormatter';
import { QUERY_DEFAULTS } from '@/shared/api/queryConfig';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ResolutionTabProps {
  caseId: string;
  caseNature: string;
  department: string;
  productType: string;
  userRoles: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function outcomeTypeChipColor(
  type: string,
): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (type) {
    case 'Close':
      return 'success';
    case 'MoveForward':
      return 'info';
    case 'Loop':
      return 'warning';
    default:
      return 'default';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResolutionTab({
  caseId,
  caseNature,
  department,
  productType,
  userRoles,
}: ResolutionTabProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, isError } = useQuery<ResolutionTabDto, { response?: { status?: number } }>({
    ...QUERY_DEFAULTS,
    queryKey: ['resolution', caseId],
    queryFn: () => loadResolutionTab(caseId, caseNature, department, productType),
    // Custom retry: never retry on 404/409 (not-found / conflict); max 2 retries otherwise
    retry: (failureCount, err) => {
      const status = err?.response?.status;
      if (status === 404 || status === 409) return false;
      return failureCount < 2;
    },
  });

  function handleSaved(_result: SaveActivityResult) {
    void queryClient.invalidateQueries({ queryKey: ['resolution', caseId] });
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={40} sx={{ mb: 1.5, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={40} sx={{ mb: 1.5, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (isError) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    let message = 'Failed to load resolution data. Please try again.';
    if (status === 404) message = 'No activity template found.';
    else if (status === 409) message = 'Multiple templates configured.';

    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{message}</Alert>
      </Box>
    );
  }

  if (!data) return null;

  const isClosed = data.caseStatus.includes('Closed');

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Case closed banner */}
      {isClosed && (
        <Alert severity="success" icon={false}>
          This case is closed.
        </Alert>
      )}

      {/* Current activity form — wrapped in ErrorBoundary to isolate form crashes */}
      <ErrorBoundary>
        <ResolutionActivityForm
          caseId={data.caseId}
          templateId={data.templateId}
          currentActivity={data.currentActivity}
          version={data.version}
          caseStatus={data.caseStatus}
          userRoles={userRoles}
          onSaved={handleSaved}
        />
      </ErrorBoundary>

      {/* History */}
      <Paper variant="outlined">
        <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Resolution History
          </Typography>
        </Box>

        {data.history.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No activities recorded yet.
            </Typography>
          </Box>
        ) : (
          <Table size="small" aria-label="Resolution history table">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600 }}>Step</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Outcome</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Outcome Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Remarks</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Performed By</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date / Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.history.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.stepNo}</TableCell>
                  <TableCell>{row.outcomeName}</TableCell>
                  <TableCell>
                    <Chip
                      label={row.outcomeType}
                      size="small"
                      color={outcomeTypeChipColor(row.outcomeType)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 240, wordBreak: 'break-word' }}>
                    {row.remarks}
                  </TableCell>
                  <TableCell>{row.performedRole}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}

/**
 * CaseHistoryTable — displays the list of cases for a customer.
 * Source: CCM Phase 4 Case Creation Workspace spec.
 */

import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { CaseHistoryItem } from './casesApi';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CaseHistoryTableProps {
  cases: CaseHistoryItem[];
  loading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getCaseStatusColor(
  status: string,
): 'success' | 'warning' | 'default' | 'error' | 'info' | 'primary' | 'secondary' {
  switch (status) {
    case 'Open':
      return 'success';
    case 'Pending Verification':
      return 'warning';
    case 'Closed – Verified':
    case 'Closed - Verified':
      return 'default';
    case 'Closed – Not Verified':
    case 'Closed - Not Verified':
      return 'default';
    default:
      return 'default';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CaseHistoryTable({ cases, loading, error }: CaseHistoryTableProps) {
  const navigate = useNavigate();
  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
        Case History
      </Typography>

      {/* Error state */}
      {error && !loading && (
        <Alert severity="error" sx={{ mb: 1 }}>
          Unable to load case history. Please try again.
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 600 }}>Document Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Date &amp; Time</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Case Nature</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Case Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Activity Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">
                Action
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Loading state — 3 skeleton rows */}
            {loading && (
              <>
                {[1, 2, 3].map((n) => (
                  <TableRow key={n}>
                    {[1, 2, 3, 4, 5, 6].map((c) => (
                      <TableCell key={c}>
                        <Skeleton variant="text" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            )}

            {/* Empty state */}
            {!loading && !error && cases.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No case history available.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {/* Error empty */}
            {!loading && error && cases.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {/* Data rows */}
            {!loading &&
              cases.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {row.caseId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatDateTime(row.registeredAt)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.caseNature}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.caseStatus}
                      size="small"
                      color={getCaseStatusColor(row.caseStatus)}
                      variant={row.caseStatus === 'Open' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.activityStatus}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="text"
                      aria-label={`View case ${row.caseId}`}
                      onClick={() => navigate(`/cases/${row.caseId}`)}
                      sx={{ textTransform: 'none', color: 'primary.main' }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

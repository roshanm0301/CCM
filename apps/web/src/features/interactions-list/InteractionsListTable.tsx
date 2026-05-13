/**
 * InteractionsListTable — filterable, searchable, paginated interactions list.
 *
 * Columns: Interaction ID | Customer Name | Channel | Agent | Started At | Status
 * Row click → Detail Drawer (480px, right anchor).
 *
 * Source: CCM Wave 3 spec — Complete InteractionsPage
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  IconButton,
  LinearProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import SearchOutlinedIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { apiClient, type ApiResponse } from '@/shared/api/client';
import { formatDateTime } from '@/shared/utils/dateFormatter';
import { QUERY_DEFAULTS } from '@/shared/api/queryConfig';
import { CtiCallRecording } from '@/features/cti/CtiCallRecording';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InteractionListItem {
  interactionId: string;
  customerName: string | null;
  customerRef: string | null;
  customerPhoneNumber: string | null;
  channel: 'inbound_call' | 'manual';
  agentName: string | null;
  startedAt: string;
  endedAt: string | null;
  status: 'COMPLETE' | 'INCOMPLETE';
}

interface InteractionsListResponse {
  items: InteractionListItem[]; // interactionId field matches backend
  total: number;                // flattened — no pagination wrapper object
  page: number;
  pageSize: number;
}

type StatusFilter = 'All' | 'Complete' | 'Incomplete';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (isNaN(start) || isNaN(end)) return '—';
  const diffSec = Math.floor((end - start) / 1000);
  if (diffSec < 0) return '—';
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function toStatusParam(filter: StatusFilter): string | undefined {
  if (filter === 'Complete') return 'COMPLETE';
  if (filter === 'Incomplete') return 'INCOMPLETE';
  return undefined;
}

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------

function StatusChip({ status }: { status: 'COMPLETE' | 'INCOMPLETE' }) {
  if (status === 'COMPLETE') {
    return (
      <Chip
        label="Complete"
        size="small"
        sx={{
          bgcolor: '#e8f5e9',
          borderColor: '#a5d6a7',
          color: '#2e7d32',
          border: '1px solid',
          fontSize: '0.75rem',
        }}
      />
    );
  }
  return (
    <Chip
      label="Incomplete"
      size="small"
      sx={{
        bgcolor: '#fff8e1',
        borderColor: '#ffe082',
        color: '#e65100',
        border: '1px solid',
        fontSize: '0.75rem',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Channel chip
// ---------------------------------------------------------------------------

function ChannelChip({ channel }: { channel: 'inbound_call' | 'manual' }) {
  if (channel === 'inbound_call') {
    return (
      <Chip
        label="Inbound"
        size="small"
        color="info"
        variant="outlined"
        sx={{ fontSize: '0.75rem' }}
      />
    );
  }
  return (
    <Chip
      label="Manual"
      size="small"
      variant="outlined"
      sx={{ fontSize: '0.75rem', color: 'text.secondary', borderColor: 'divider' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Detail Drawer
// ---------------------------------------------------------------------------

interface DetailDrawerProps {
  interaction: InteractionListItem | null;
  open: boolean;
  onClose: () => void;
  closeFocusRef: React.RefObject<HTMLElement>;
}

function DetailDrawer({ interaction, open, onClose, closeFocusRef }: DetailDrawerProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Focus close button when drawer opens
  useEffect(() => {
    if (open && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [open]);

  // Return focus to trigger row when drawer closes
  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      closeFocusRef.current?.focus();
    }, 50);
  }, [onClose, closeFocusRef]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: { width: 480, pt: '64px' },
        role: 'dialog',
        'aria-label': 'Interaction details',
        'aria-modal': true,
      }}
    >
      {interaction && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="h3" component="h2">
              Interaction Details
            </Typography>
            <IconButton
              ref={closeBtnRef}
              onClick={handleClose}
              aria-label="Close interaction details"
              size="small"
            >
              <CloseOutlinedIcon />
            </IconButton>
          </Box>

          {/* Body */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>
            {/* Status + channel row */}
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
              <StatusChip status={interaction.status} />
              <ChannelChip channel={interaction.channel} />
            </Box>

            {/* Identity section */}
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', mb: 1 }}
            >
              Identity
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Interaction ID
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                >
                  {interaction.interactionId}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Started At
                </Typography>
                <Typography variant="body2">{formatDateTime(interaction.startedAt)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Duration
                </Typography>
                <Typography variant="body2">
                  {formatDuration(interaction.startedAt, interaction.endedAt)}
                </Typography>
              </Box>
            </Box>

            {/* Customer section */}
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', mb: 1 }}
            >
              Customer
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Customer Name
                </Typography>
                <Typography variant="body2">{interaction.customerName ?? '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Phone Number
                </Typography>
                <Typography variant="body2">{interaction.customerPhoneNumber ?? '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Customer Ref
                </Typography>
                <Typography variant="body2">{interaction.customerRef ?? '—'}</Typography>
              </Box>
            </Box>

            {/* Agent section */}
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', mb: 1 }}
            >
              Agent
            </Typography>
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Agent Name
              </Typography>
              <Typography variant="body2">{interaction.agentName ?? '—'}</Typography>
            </Box>

            {/* Call Recording — only for inbound_call interactions */}
            {interaction.channel === 'inbound_call' && (
              <>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 1 }}
                >
                  Call Recording
                </Typography>
                <Box sx={{ mb: 3 }}>
                  <CtiCallRecording
                    interactionId={interaction.interactionId}
                    channel={interaction.channel}
                  />
                </Box>
              </>
            )}
          </Box>

          {/* Footer */}
          <Box
            sx={{
              px: 3,
              py: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              This record is read-only.
            </Typography>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function InteractionsListTable() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0); // 0-indexed for MUI TablePagination
  const [pageSize, setPageSize] = useState(25);
  const [selectedInteraction, setSelectedInteraction] = useState<InteractionListItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InteractionListItem | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const rowFocusRef = useRef<HTMLElement>(null);

  // Debounce search input 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['interactions', { status: statusFilter, search: debouncedSearch, page, pageSize }],
    queryFn: () =>
      apiClient
        .get<ApiResponse<InteractionsListResponse>>('/api/v1/interactions', {
          params: {
            status: toStatusParam(statusFilter),
            search: debouncedSearch || undefined,
            page: page + 1, // API is 1-indexed
            pageSize,
          },
        })
        .then((res) => res.data.data),
    ...QUERY_DEFAULTS,
  });

  const interactions = data?.items ?? [];
  const total = data?.total ?? 0;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/interactions/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      setDeleteError('');
      void queryClient.invalidateQueries({ queryKey: ['interactions'] });
    },
    onError: () => {
      setDeleteError('Failed to delete interaction. Please try again.');
    },
  });

  function handleDeleteClick(e: React.MouseEvent, row: InteractionListItem) {
    e.stopPropagation();
    setDeleteTarget(row);
    setDeleteError('');
  }

  function handleDeleteConfirm() {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.interactionId);
    }
  }

  function handleDeleteCancel() {
    setDeleteTarget(null);
    setDeleteError('');
  }

  function handleRowClick(row: InteractionListItem, el: HTMLElement) {
    setSelectedInteraction(row);
    setDrawerOpen(true);
    // Store reference for focus return — TypeScript won't accept assignment to .current
    (rowFocusRef as React.MutableRefObject<HTMLElement>).current = el;
  }

  function handleRowKeyDown(
    e: React.KeyboardEvent<HTMLTableRowElement>,
    row: InteractionListItem,
  ) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(row, e.currentTarget);
    }
  }

  function handleStatusFilterChange(
    _: React.MouseEvent<HTMLElement>,
    newFilter: StatusFilter | null,
  ) {
    if (newFilter !== null) {
      setStatusFilter(newFilter);
      setPage(0);
    }
  }

  function handlePageChange(_: unknown, newPage: number) {
    setPage(newPage);
  }

  function handleRowsPerPageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPageSize(parseInt(e.target.value, 10));
    setPage(0);
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Loading progress bar */}
      {isLoading && (
        <LinearProgress
          aria-label="Loading interactions"
          sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }}
        />
      )}

      {/* Filter + search bar (56px) */}
      <Box
        sx={{
          height: 56,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        {/* Status filter */}
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={handleStatusFilterChange}
          size="small"
          aria-label="Filter by status"
        >
          <ToggleButton value="All" aria-label="Show all interactions">
            All
          </ToggleButton>
          <ToggleButton value="Complete" aria-label="Show complete interactions">
            Complete
          </ToggleButton>
          <ToggleButton value="Incomplete" aria-label="Show incomplete interactions">
            Incomplete
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Search field */}
        <TextField
          size="small"
          placeholder="Search interactions…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search interactions"
          InputProps={{
            startAdornment: (
              <SearchOutlinedIcon
                sx={{ color: 'text.secondary', mr: 0.5, fontSize: 18 }}
                aria-hidden="true"
              />
            ),
            endAdornment: searchInput ? (
              <IconButton
                size="small"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
                sx={{ p: 0.25 }}
              >
                <ClearIcon sx={{ fontSize: 16 }} />
              </IconButton>
            ) : null,
          }}
          sx={{ width: 260 }}
        />
      </Box>

      {/* Table area (flex 1) */}
      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        <Table stickyHeader aria-label="Interactions list" size="small">
          <TableHead>
            <TableRow>
              <TableCell scope="col" sx={{ width: 160, fontWeight: 600 }}>
                Interaction ID
              </TableCell>
              <TableCell scope="col" sx={{ minWidth: 160, fontWeight: 600 }}>
                Customer Name
              </TableCell>
              <TableCell scope="col" sx={{ width: 140, fontWeight: 600 }}>
                Phone Number
              </TableCell>
              <TableCell scope="col" sx={{ width: 120, fontWeight: 600 }}>
                Channel
              </TableCell>
              <TableCell scope="col" sx={{ width: 160, fontWeight: 600 }}>
                Agent
              </TableCell>
              <TableCell scope="col" sx={{ width: 164, fontWeight: 600 }}>
                Started At
              </TableCell>
              <TableCell scope="col" sx={{ width: 120, fontWeight: 600, textAlign: 'center' }}>
                Status
              </TableCell>
              <TableCell scope="col" sx={{ width: 56 }} />
            </TableRow>
          </TableHead>

          <TableBody>
            {/* Loading skeleton rows */}
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                  <TableCell />
                </TableRow>
              ))}

            {/* Error state */}
            {isError && !isLoading && (
              <TableRow>
                <TableCell colSpan={8}>
                </TableCell>
              </TableRow>
            )}

            {/* Empty state */}
            {!isLoading && !isError && interactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      py: 8,
                      gap: 1,
                    }}
                  >
                    <InboxOutlinedIcon
                      sx={{ fontSize: 48, color: 'text.disabled' }}
                      aria-hidden="true"
                    />
                    <Typography variant="h3" color="text.secondary">
                      No interactions found
                    </Typography>
                    <Typography variant="body2" color="text.disabled">
                      Try adjusting your search or filter.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}

            {/* Data rows */}
            {!isLoading &&
              interactions.map((row) => (
                <TableRow
                  key={row.interactionId}
                  hover
                  tabIndex={0}
                  onClick={(e) => handleRowClick(row, e.currentTarget)}
                  onKeyDown={(e) => handleRowKeyDown(e, row)}
                  sx={{ cursor: 'pointer' }}
                  aria-label={`Interaction ${row.interactionId}, ${row.customerName ?? 'unknown customer'}`}
                >
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: 'monospace', display: 'block' }}
                    >
                      {row.interactionId}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.customerName ?? '—'}</TableCell>
                  <TableCell>{row.customerPhoneNumber ?? '—'}</TableCell>
                  <TableCell>
                    <ChannelChip channel={row.channel} />
                  </TableCell>
                  <TableCell>{row.agentName ?? '—'}</TableCell>
                  <TableCell>{formatDateTime(row.startedAt)}</TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <StatusChip status={row.status} />
                  </TableCell>
                  <TableCell
                    sx={{ textAlign: 'center', p: 0.5 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconButton
                      size="small"
                      aria-label={`Delete interaction ${row.interactionId}`}
                      onClick={(e) => handleDeleteClick(e, row)}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[25, 50, 100]}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
        sx={{ borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}
      />

      {/* Detail Drawer */}
      <DetailDrawer
        interaction={selectedInteraction}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        closeFocusRef={rowFocusRef}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-interaction-title"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="delete-interaction-title">Delete Interaction</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete this interaction?
            {deleteTarget && (
              <Box component="span" sx={{ display: 'block', mt: 1, fontFamily: 'monospace', fontSize: '0.8rem', color: 'text.secondary' }}>
                {deleteTarget.interactionId}
              </Box>
            )}
          </DialogContentText>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

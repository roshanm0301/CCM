/**
 * DealerCatalogView — filterable, sortable, paginated case grid for dealer users.
 * Source: CCM_Phase6_Resolution_Activities.md § Dealer Catalog View
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { getDealerCatalog, type DealerCatalogFilters, type DealerCatalogItem } from './dealerCatalogApi';
import { CaseFiltersDrawer } from './CaseFiltersDrawer';
import { formatDateTime } from '@/shared/utils/dateFormatter';
import { QUERY_DEFAULTS } from '@/shared/api/queryConfig';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCaseStatusColor(
  status: string,
): 'success' | 'warning' | 'default' {
  if (status === 'Open') return 'success';
  if (status === 'In Progress') return 'warning';
  return 'default';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DealerCatalogView() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1); // 1-indexed
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [appliedFilters, setAppliedFilters] = useState<DealerCatalogFilters>({});
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const { data, isLoading, isError } = useQuery({
    ...QUERY_DEFAULTS,
    queryKey: [
      'dealerCatalog', page, PAGE_SIZE, sortDir,
      appliedFilters.caseNature ?? '',
      appliedFilters.productType ?? '',
      appliedFilters.activityStatus ?? '',
      appliedFilters.dateFrom ?? '',
      appliedFilters.dateTo ?? '',
      [...(appliedFilters.caseStatus   ?? [])].sort().join(','),
      [...(appliedFilters.department   ?? [])].sort().join(','),
      [...(appliedFilters.caseCategory ?? [])].sort().join(','),
      [...(appliedFilters.caseSubcategory ?? [])].sort().join(','),
    ],
    queryFn: () => getDealerCatalog(appliedFilters, page, PAGE_SIZE, sortDir),
    refetchInterval: 30_000,
  });

  const items: DealerCatalogItem[] = data?.items ?? [];
  const total: number = data?.total ?? 0;

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  function handleSortToggle() {
    setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    setPage(1);
  }

  function handleApplyFilters(filters: DealerCatalogFilters) {
    setAppliedFilters(filters);
    setPage(1);
  }

  // MUI TablePagination uses 0-indexed page
  function handlePageChange(_: unknown, newPage: number) {
    setPage(newPage + 1);
  }

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  const COL_COUNT = 12;

  function renderSkeletonRows() {
    return Array.from({ length: 5 }).map((_, rowIdx) => (
      <TableRow key={rowIdx}>
        {Array.from({ length: COL_COUNT }).map((_, colIdx) => (
          <TableCell key={colIdx}>
            <Skeleton variant="text" />
          </TableCell>
        ))}
      </TableRow>
    ));
  }

  function renderEmptyRow() {
    return (
      <TableRow>
        <TableCell colSpan={COL_COUNT} align="center" sx={{ py: 6 }}>
          <Typography variant="body2" color="text.secondary">
            No cases assigned to you.
          </Typography>
        </TableCell>
      </TableRow>
    );
  }

  function renderDataRows() {
    return items.map((row) => (
      <TableRow key={row.id} hover>
        <TableCell>
          <Typography variant="body2" fontFamily="monospace">
            {row.caseId}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" noWrap>
            {formatDateTime(row.registeredAt)}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{row.department}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{row.caseNature}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{row.caseCategoryName || '—'}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{row.caseSubcategoryName || '—'}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{row.customerName || '—'}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{row.customerMobile || '—'}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{row.currentAssignedRole || '—'}</Typography>
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
            sx={{ textTransform: 'none', color: '#EB6A2C' }}
          >
            View
          </Button>
        </TableCell>
      </TableRow>
    ));
  }

  // ------------------------------------------------------------------
  // Main render
  // ------------------------------------------------------------------

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          My Cases
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FilterListIcon />}
          aria-label="Open filters"
          onClick={() => setDrawerOpen(true)}
          sx={{ textTransform: 'none' }}
        >
          Filters
        </Button>
      </Box>

      {/* Error alert */}
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load cases. Please try again.
        </Alert>
      )}

      {/* Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ flex: 1 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 600 }}>Case ID</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                <TableSortLabel
                  active
                  direction={sortDir}
                  onClick={handleSortToggle}
                  aria-label="Sort by registered date"
                >
                  Registered Date/Time
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Department</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Case Nature</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Case Category</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Case Subcategory</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Customer Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Customer Mobile</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Current Assigned Role</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Case Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Activity Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">
                Action
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && renderSkeletonRows()}
            {!isLoading && !isError && items.length === 0 && renderEmptyRow()}
            {!isLoading && !isError && items.length > 0 && renderDataRows()}
            {/* Show empty row on error with no data */}
            {!isLoading && isError && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={COL_COUNT} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={total}
        page={page - 1} // TablePagination is 0-indexed
        onPageChange={handlePageChange}
        rowsPerPage={PAGE_SIZE}
        rowsPerPageOptions={[PAGE_SIZE]}
        aria-label="Dealer catalog pagination"
      />

      {/* Filters drawer */}
      <CaseFiltersDrawer
        open={drawerOpen}
        appliedFilters={appliedFilters}
        onApply={handleApplyFilters}
        onClose={() => setDrawerOpen(false)}
      />
    </Box>
  );
}

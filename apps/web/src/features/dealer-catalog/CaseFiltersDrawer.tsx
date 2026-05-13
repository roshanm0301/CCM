/**
 * CaseFiltersDrawer — right-side filter drawer for the Dealer Catalog.
 * Source: CCM_Phase6_Resolution_Activities.md § Dealer Catalog View
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  type SelectChangeEvent,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { fetchCategories, fetchCategory } from '@/features/case-category/caseCategoryApi';
import type { SubcategoryDto } from '@/features/case-category/caseCategoryApi';
import type { DealerCatalogFilters } from './dealerCatalogApi';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEPARTMENTS = ['SALES', 'SERVICE', 'PARTS', 'BODYSHOP'] as const;
const CASE_NATURES = ['Complaint', 'Enquiry', 'Request'] as const;
const CASE_STATUSES = [
  'Open',
  'In Progress',
  'Closed \u2013 Verified',
  'Closed \u2013 Not Verified',
] as const;
const ACTIVITY_STATUSES = ['Fresh', 'In Progress', 'Resolved'] as const;

const DRAWER_WIDTH = 320;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CaseFiltersDrawerProps {
  open: boolean;
  appliedFilters: DealerCatalogFilters;
  onApply: (filters: DealerCatalogFilters) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CaseFiltersDrawer({
  open,
  appliedFilters,
  onApply,
  onClose,
}: CaseFiltersDrawerProps) {
  const [pendingFilters, setPendingFilters] = useState<DealerCatalogFilters>(appliedFilters);
  const [dateError, setDateError] = useState<string | null>(null);

  // Load all active categories (for Category multi-select filter)
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['caseCategories', 'filterDrawer'],
    queryFn: fetchCategories,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const activeCategories = useMemo(
    () => (categoriesData ?? []).filter((c) => c.isActive),
    [categoriesData],
  );

  // Load subcategories for all active categories (batch, parallel)
  const selectedCategoryIds = useMemo(() => {
    if (!pendingFilters.caseCategory || pendingFilters.caseCategory.length === 0) return [];
    return activeCategories
      .filter((c) => pendingFilters.caseCategory!.includes(c.displayName))
      .map((c) => c.id);
  }, [pendingFilters.caseCategory, activeCategories]);

  // Fetch details of selected categories to get their subcategories
  const { data: selectedCategoryDetails } = useQuery({
    queryKey: ['caseCategoryDetails', ...selectedCategoryIds],
    queryFn: () => Promise.all(selectedCategoryIds.map((id) => fetchCategory(id))),
    enabled: open && selectedCategoryIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const availableSubcategories = useMemo<SubcategoryDto[]>(() => {
    if (!selectedCategoryDetails) return [];
    return selectedCategoryDetails.flatMap((cat) =>
      (cat.subcategories ?? []).filter((s) => s.isActive),
    );
  }, [selectedCategoryDetails]);

  // Sync pending state when drawer opens with externally-applied filters
  useEffect(() => {
    if (open) {
      setPendingFilters(appliedFilters);
      setDateError(null);
    }
  }, [open, appliedFilters]);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  function handleMultiSelectChange(
    field: keyof DealerCatalogFilters,
    event: SelectChangeEvent<string[]>,
  ) {
    const value = event.target.value;
    const newValues = typeof value === 'string' ? value.split(',') : value;
    setPendingFilters((prev) => {
      const next: DealerCatalogFilters = { ...prev, [field]: newValues };
      // When category selection changes, reset subcategory to avoid stale values
      if (field === 'caseCategory') {
        next.caseSubcategory = undefined;
      }
      return next;
    });
  }

  function handleSingleSelectChange(
    field: keyof DealerCatalogFilters,
    event: SelectChangeEvent<string>,
  ) {
    setPendingFilters((prev) => ({
      ...prev,
      [field]: event.target.value || undefined,
    }));
  }

  function handleDateChange(field: 'dateFrom' | 'dateTo', value: string) {
    setPendingFilters((prev) => ({ ...prev, [field]: value || undefined }));
    setDateError(null);
  }

  function handleApply() {
    const { dateFrom, dateTo } = pendingFilters;
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setDateError('"Registered From" must be on or before "Registered To".');
      return;
    }
    setDateError(null);
    onApply(pendingFilters);
    onClose();
  }

  function handleReset() {
    setPendingFilters({});
    setDateError(null);
    // Does NOT call onApply — grid unchanged until Apply is clicked
  }

  function handleClose() {
    // Discard pending changes, close without applying
    setPendingFilters(appliedFilters);
    setDateError(null);
    onClose();
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: { width: DRAWER_WIDTH },
      }}
    >
      {/* Header */}
      <Toolbar
        disableGutters
        sx={{
          px: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          minHeight: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          Filters
        </Typography>
        <IconButton
          aria-label="Close filters"
          onClick={handleClose}
          size="small"
          edge="end"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      {/* Filter fields */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>
        <Stack spacing={2.5}>
          {/* Department */}
          <FormControl size="small" fullWidth>
            <InputLabel id="filter-department-label">Department</InputLabel>
            <Select
              labelId="filter-department-label"
              multiple
              value={(pendingFilters.department ?? []) as string[]}
              onChange={(e: SelectChangeEvent<string[]>) =>
                handleMultiSelectChange('department', e)
              }
              input={<OutlinedInput label="Department" />}
              renderValue={(selected) => (selected as string[]).join(', ')}
              aria-label="Filter by department"
            >
              {DEPARTMENTS.map((d) => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Case Nature */}
          <FormControl size="small" fullWidth>
            <InputLabel id="filter-case-nature-label">Case Nature</InputLabel>
            <Select
              labelId="filter-case-nature-label"
              value={(pendingFilters.caseNature ?? '') as string}
              onChange={(e: SelectChangeEvent<string>) =>
                handleSingleSelectChange('caseNature', e)
              }
              input={<OutlinedInput label="Case Nature" />}
              aria-label="Filter by case nature"
            >
              <MenuItem value="">
                <em>All</em>
              </MenuItem>
              {CASE_NATURES.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Case Status */}
          <FormControl size="small" fullWidth>
            <InputLabel id="filter-case-status-label">Case Status</InputLabel>
            <Select
              labelId="filter-case-status-label"
              multiple
              value={(pendingFilters.caseStatus ?? []) as string[]}
              onChange={(e: SelectChangeEvent<string[]>) =>
                handleMultiSelectChange('caseStatus', e)
              }
              input={<OutlinedInput label="Case Status" />}
              renderValue={(selected) => (selected as string[]).join(', ')}
              aria-label="Filter by case status"
            >
              {CASE_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Activity Status */}
          <FormControl size="small" fullWidth>
            <InputLabel id="filter-activity-status-label">Activity Status</InputLabel>
            <Select
              labelId="filter-activity-status-label"
              value={(pendingFilters.activityStatus ?? '') as string}
              onChange={(e: SelectChangeEvent<string>) =>
                handleSingleSelectChange('activityStatus', e)
              }
              input={<OutlinedInput label="Activity Status" />}
              aria-label="Filter by activity status"
            >
              <MenuItem value="">
                <em>All</em>
              </MenuItem>
              {ACTIVITY_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Case Category */}
          <FormControl size="small" fullWidth>
            <InputLabel id="filter-case-category-label">Case Category</InputLabel>
            <Select
              labelId="filter-case-category-label"
              multiple
              value={(pendingFilters.caseCategory ?? []) as string[]}
              onChange={(e: SelectChangeEvent<string[]>) =>
                handleMultiSelectChange('caseCategory', e)
              }
              input={<OutlinedInput label="Case Category" />}
              renderValue={(selected) => (selected as string[]).join(', ')}
              aria-label="Filter by case category"
              endAdornment={
                categoriesLoading ? (
                  <CircularProgress size={16} sx={{ mr: 2 }} />
                ) : undefined
              }
            >
              {activeCategories.map((c) => (
                <MenuItem key={c.id} value={c.displayName}>
                  {c.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Case Subcategory — only shown when at least one category is selected */}
          {selectedCategoryIds.length > 0 && (
            <FormControl size="small" fullWidth>
              <InputLabel id="filter-case-subcategory-label">Case Subcategory</InputLabel>
              <Select
                labelId="filter-case-subcategory-label"
                multiple
                value={(pendingFilters.caseSubcategory ?? []) as string[]}
                onChange={(e: SelectChangeEvent<string[]>) =>
                  handleMultiSelectChange('caseSubcategory', e)
                }
                input={<OutlinedInput label="Case Subcategory" />}
                renderValue={(selected) => (selected as string[]).join(', ')}
                aria-label="Filter by case subcategory"
              >
                {availableSubcategories.length === 0 ? (
                  <MenuItem disabled>
                    <em>No subcategories available</em>
                  </MenuItem>
                ) : (
                  availableSubcategories.map((s) => (
                    <MenuItem key={s.id} value={s.displayName}>
                      {s.displayName}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          )}

          <Divider />

          {/* Date Range */}
          <Typography variant="body2" fontWeight={600} color="text.secondary">
            Registration Date Range
          </Typography>
          <TextField
            label="Registered From"
            type="date"
            size="small"
            fullWidth
            value={pendingFilters.dateFrom ?? ''}
            onChange={(e) => handleDateChange('dateFrom', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            inputProps={{ 'aria-label': 'Registered from date' }}
          />
          <TextField
            label="Registered To"
            type="date"
            size="small"
            fullWidth
            value={pendingFilters.dateTo ?? ''}
            onChange={(e) => handleDateChange('dateTo', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            inputProps={{ 'aria-label': 'Registered to date' }}
          />

          {dateError && (
            <Alert severity="error" sx={{ mt: 0 }}>
              {dateError}
            </Alert>
          )}
        </Stack>
      </Box>

      {/* Footer actions */}
      <Box
        sx={{
          px: 2,
          py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 1.5,
        }}
      >
        <Button
          variant="outlined"
          color="inherit"
          fullWidth
          onClick={handleReset}
          aria-label="Reset filters"
          sx={{ textTransform: 'none' }}
        >
          Reset
        </Button>
        <Button
          variant="contained"
          fullWidth
          onClick={handleApply}
          aria-label="Apply filters"
          sx={{
            textTransform: 'none',
            bgcolor: '#EB6A2C',
            '&:hover': { bgcolor: '#d45a1f' },
          }}
        >
          Apply
        </Button>
      </Box>
    </Drawer>
  );
}

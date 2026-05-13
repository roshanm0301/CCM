/**
 * CaseCategoryForm — create / edit form for Case Category master.
 * Also renders the subcategory table + modal for existing categories.
 * Source: CCM_Phase3_CaseCategory_Master.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  fetchCategory,
  createCategory,
  updateCategory,
  createSubcategory,
  updateSubcategory,
  fetchDepartments,
  fetchCaseNatures,
  fetchProductTypes,
  type CategoryDto,
  type SubcategoryDto,
  type LookupValue,
} from './caseCategoryApi';
import { SubcategoryModal } from './SubcategoryModal';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const ALLOWED_TEXT_REGEX = /^[A-Za-z0-9\s&/\-(),.]*$/;
const CODE_REGEX = /^[A-Z0-9_-]*$/;

interface FormState {
  code: string;
  displayName: string;
  definition: string;
  departments: string[];
  caseNatures: string[];
  productTypes: string[];
  isActive: boolean;
}

interface FormErrors {
  code?: string;
  displayName?: string;
  definition?: string;
  departments?: string;
  caseNatures?: string;
  productTypes?: string;
}

function validate(form: FormState): FormErrors {
  const errs: FormErrors = {};
  if (!form.code.trim()) {
    errs.code = 'Code is required';
  } else if (!CODE_REGEX.test(form.code)) {
    errs.code = 'Code must be uppercase alphanumeric with _ or -';
  } else if (form.code.length > 30) {
    errs.code = 'Code must be at most 30 characters';
  }
  if (!form.displayName.trim()) {
    errs.displayName = 'Display Name is required';
  } else if (!ALLOWED_TEXT_REGEX.test(form.displayName)) {
    errs.displayName = 'Invalid characters in Display Name';
  } else if (form.displayName.length > 100) {
    errs.displayName = 'Display Name must be at most 100 characters';
  }
  if (!form.definition.trim()) {
    errs.definition = 'Definition is required';
  } else if (!ALLOWED_TEXT_REGEX.test(form.definition)) {
    errs.definition = 'Invalid characters in Definition';
  } else if (form.definition.length > 500) {
    errs.definition = 'Definition must be at most 500 characters';
  }
  if (form.departments.length === 0) {
    errs.departments = 'Please select at least one value for Department';
  }
  if (form.caseNatures.length === 0) {
    errs.caseNatures = 'Please select at least one value for Case Nature';
  }
  if (form.productTypes.length === 0) {
    errs.productTypes = 'Please select at least one value for Product Type';
  }
  return errs;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CaseCategoryFormProps {
  /** null = create mode, string = edit mode (category id) */
  editId: string | null;
  onCancel: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CaseCategoryForm({ editId, onCancel, onSaved }: CaseCategoryFormProps) {
  const isEdit = editId !== null;

  // Lookup data
  const [departments, setDepartments] = useState<LookupValue[]>([]);
  const [caseNatures, setCaseNatures] = useState<LookupValue[]>([]);
  const [productTypes, setProductTypes] = useState<LookupValue[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupsError, setLookupsError] = useState<string | null>(null);

  // Category data (edit mode)
  const [category, setCategory] = useState<CategoryDto | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(isEdit);

  // Form state
  const [form, setForm] = useState<FormState>({
    code: '',
    displayName: '',
    definition: '',
    departments: [],
    caseNatures: [],
    productTypes: [],
    isActive: true,
  });
  const [touched, setTouched] = useState<Partial<Record<keyof FormErrors, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Subcategory modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubcategoryDto | null>(null);
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load lookups
  // ---------------------------------------------------------------------------

  const loadLookups = useCallback(async () => {
    setLookupsLoading(true);
    setLookupsError(null);
    try {
      const [deps, natures, types] = await Promise.all([
        fetchDepartments(),
        fetchCaseNatures(),
        fetchProductTypes(),
      ]);
      setDepartments(deps);
      setCaseNatures(natures);
      setProductTypes(types);
    } catch {
      setLookupsError('Failed to load lookup values. Please refresh.');
    } finally {
      setLookupsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  // ---------------------------------------------------------------------------
  // Load existing category (edit mode)
  // ---------------------------------------------------------------------------

  const loadCategory = useCallback(async () => {
    if (!editId) return;
    setCategoryLoading(true);
    try {
      const cat = await fetchCategory(editId);
      setCategory(cat);
      setForm({
        code: cat.code,
        displayName: cat.displayName,
        definition: cat.definition,
        departments: cat.departments,
        caseNatures: cat.caseNatures,
        productTypes: cat.productTypes,
        isActive: cat.isActive,
      });
    } catch {
      setSaveError('Failed to load category. Please go back and try again.');
    } finally {
      setCategoryLoading(false);
    }
  }, [editId]);

  useEffect(() => {
    if (isEdit) {
      void loadCategory();
    }
  }, [isEdit, loadCategory]);

  // ---------------------------------------------------------------------------
  // Form helpers
  // ---------------------------------------------------------------------------

  const errors = validate(form);

  function touch(field: keyof FormErrors) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function touchAll() {
    setTouched({
      code: true,
      displayName: true,
      definition: true,
      departments: true,
      caseNatures: true,
      productTypes: true,
    });
  }

  function handleMultiSelect(
    field: 'departments' | 'caseNatures' | 'productTypes',
    e: SelectChangeEvent<string[]>,
  ) {
    const val = e.target.value;
    setForm((f) => ({
      ...f,
      [field]: typeof val === 'string' ? val.split(',') : val,
    }));
    touch(field);
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSave() {
    touchAll();
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (isEdit && editId) {
        await updateCategory(editId, {
          code: form.code,
          displayName: form.displayName,
          definition: form.definition,
          departments: form.departments,
          caseNatures: form.caseNatures,
          productTypes: form.productTypes,
          isActive: form.isActive,
        });
      } else {
        await createCategory({
          code: form.code,
          displayName: form.displayName,
          definition: form.definition,
          departments: form.departments,
          caseNatures: form.caseNatures,
          productTypes: form.productTypes,
          isActive: form.isActive,
        });
      }
      onSaved();
    } catch (err: unknown) {
      const msg =
        err !== null &&
        typeof err === 'object' &&
        'response' in err &&
        err.response !== null &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data !== null &&
        typeof err.response.data === 'object' &&
        'error' in err.response.data &&
        err.response.data.error !== null &&
        typeof err.response.data.error === 'object' &&
        'message' in err.response.data.error
          ? String(err.response.data.error.message)
          : 'Failed to save case category. Please try again.';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Subcategory handlers
  // ---------------------------------------------------------------------------

  function openAddSubcategory() {
    setEditingSub(null);
    setSubError(null);
    setModalOpen(true);
  }

  function openEditSubcategory(sub: SubcategoryDto) {
    setEditingSub(sub);
    setSubError(null);
    setModalOpen(true);
  }

  async function handleSubSave(data: {
    code: string;
    displayName: string;
    definition: string;
    isActive: boolean;
  }) {
    if (!editId) return;
    setSubSaving(true);
    setSubError(null);
    try {
      if (editingSub) {
        await updateSubcategory(editId, editingSub.id, data);
      } else {
        await createSubcategory(editId, data);
      }
      setModalOpen(false);
      await loadCategory();
    } catch (err: unknown) {
      const msg =
        err !== null &&
        typeof err === 'object' &&
        'response' in err &&
        err.response !== null &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data !== null &&
        typeof err.response.data === 'object' &&
        'error' in err.response.data &&
        err.response.data.error !== null &&
        typeof err.response.data.error === 'object' &&
        'message' in err.response.data.error
          ? String(err.response.data.error.message)
          : 'Failed to save subcategory. Please try again.';
      setSubError(msg);
    } finally {
      setSubSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isDataLoading = lookupsLoading || categoryLoading;

  return (
    <Box>
      {/* Back button + title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onCancel}
          sx={{ textTransform: 'none', color: 'text.secondary' }}
        >
          Back
        </Button>
        <Typography variant="h6" fontWeight={600}>
          {isEdit ? 'Edit Case Category' : 'New Case Category'}
        </Typography>
      </Box>

      {lookupsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {lookupsError}
        </Alert>
      )}
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveError}
        </Alert>
      )}

      {isDataLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton key={n} height={56} />
          ))}
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
            {/* Code */}
            <TextField
              label="Code"
              required
              size="small"
              value={form.code}
              onChange={(e) => {
                setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }));
              }}
              onBlur={() => touch('code')}
              error={touched.code === true && Boolean(errors.code)}
              helperText={
                touched.code === true ? errors.code : 'Uppercase alphanumeric, _ or - only'
              }
              inputProps={{ maxLength: 30 }}
            />

            {/* Display Name */}
            <TextField
              label="Display Name"
              required
              size="small"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              onBlur={() => touch('displayName')}
              error={touched.displayName === true && Boolean(errors.displayName)}
              helperText={touched.displayName === true ? errors.displayName : undefined}
              inputProps={{ maxLength: 100 }}
            />

            {/* Definition — full width */}
            <Box sx={{ gridColumn: { md: '1 / -1' } }}>
              <TextField
                label="Definition"
                required
                size="small"
                fullWidth
                multiline
                rows={3}
                value={form.definition}
                onChange={(e) => setForm((f) => ({ ...f, definition: e.target.value }))}
                onBlur={() => touch('definition')}
                error={touched.definition === true && Boolean(errors.definition)}
                helperText={
                  touched.definition === true
                    ? errors.definition
                    : `${form.definition.length}/500 characters`
                }
                inputProps={{ maxLength: 500 }}
              />
            </Box>

            {/* Departments */}
            <FormControl
              size="small"
              error={touched.departments === true && Boolean(errors.departments)}
            >
              <InputLabel>Departments *</InputLabel>
              <Select
                multiple
                value={form.departments}
                onChange={(e) => handleMultiSelect('departments', e)}
                onBlur={() => touch('departments')}
                input={<OutlinedInput label="Departments *" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((v) => (
                      <Chip key={v} label={v} size="small" />
                    ))}
                  </Box>
                )}
              >
                {departments.map((d) => (
                  <MenuItem key={d.code} value={d.code}>
                    {d.label ?? d.code}
                  </MenuItem>
                ))}
              </Select>
              {touched.departments === true && errors.departments && (
                <FormHelperText>{errors.departments}</FormHelperText>
              )}
            </FormControl>

            {/* Case Natures */}
            <FormControl
              size="small"
              error={touched.caseNatures === true && Boolean(errors.caseNatures)}
            >
              <InputLabel>Case Natures *</InputLabel>
              <Select
                multiple
                value={form.caseNatures}
                onChange={(e) => handleMultiSelect('caseNatures', e)}
                onBlur={() => touch('caseNatures')}
                input={<OutlinedInput label="Case Natures *" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((v) => (
                      <Chip key={v} label={v} size="small" />
                    ))}
                  </Box>
                )}
              >
                {caseNatures.map((n) => (
                  <MenuItem key={n.code} value={n.code}>
                    {n.label ?? n.code}
                  </MenuItem>
                ))}
              </Select>
              {touched.caseNatures === true && errors.caseNatures && (
                <FormHelperText>{errors.caseNatures}</FormHelperText>
              )}
            </FormControl>

            {/* Product Types */}
            <FormControl
              size="small"
              error={touched.productTypes === true && Boolean(errors.productTypes)}
            >
              <InputLabel>Product Types *</InputLabel>
              <Select
                multiple
                value={form.productTypes}
                onChange={(e) => handleMultiSelect('productTypes', e)}
                onBlur={() => touch('productTypes')}
                input={<OutlinedInput label="Product Types *" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((v) => (
                      <Chip key={v} label={v} size="small" />
                    ))}
                  </Box>
                )}
              >
                {productTypes.map((p) => (
                  <MenuItem key={p.code} value={p.code}>
                    {p.code}
                  </MenuItem>
                ))}
              </Select>
              {touched.productTypes === true && errors.productTypes && (
                <FormHelperText>{errors.productTypes}</FormHelperText>
              )}
            </FormControl>

            {/* Is Active */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    sx={{ color: '#EB6A2C', '&.Mui-checked': { color: '#EB6A2C' } }}
                  />
                }
                label="Is Active"
              />
            </Box>
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'flex-end' }}>
            <Button onClick={onCancel} disabled={saving} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSave()}
              disabled={saving}
              sx={{
                bgcolor: '#EB6A2C',
                '&:hover': { bgcolor: '#d45e22' },
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* ---------------------------------------------------------------------------
          Subcategory section — only visible when editing an existing category
      --------------------------------------------------------------------------- */}
      {isEdit && !isDataLoading && category && (
        <Box sx={{ mt: 4 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              Subcategories
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={openAddSubcategory}
              sx={{
                textTransform: 'none',
                borderColor: '#EB6A2C',
                color: '#EB6A2C',
                '&:hover': { borderColor: '#d45e22', bgcolor: 'rgba(235,106,44,0.04)' },
              }}
            >
              Add Subcategory
            </Button>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Display Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Definition</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(category.subcategories ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No subcategories yet. Click "Add Subcategory" to create one.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  (category.subcategories ?? []).map((sub) => (
                    <TableRow key={sub.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {sub.code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{sub.displayName}</Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={sub.definition}
                        >
                          {sub.definition}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={sub.isActive ? 'Active' : 'Inactive'}
                          size="small"
                          color={sub.isActive ? 'success' : 'default'}
                          variant={sub.isActive ? 'filled' : 'outlined'}
                        />
                        {sub.inactivatedByCascade && (
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                            (cascaded)
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          startIcon={<EditIcon fontSize="small" />}
                          onClick={() => openEditSubcategory(sub)}
                          sx={{
                            textTransform: 'none',
                            color: '#EB6A2C',
                            '&:hover': { bgcolor: 'rgba(235,106,44,0.08)' },
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Subcategory modal */}
      <SubcategoryModal
        open={modalOpen}
        initial={editingSub}
        saving={subSaving}
        error={subError}
        onSave={(data) => void handleSubSave(data)}
        onCancel={() => setModalOpen(false)}
      />
    </Box>
  );
}

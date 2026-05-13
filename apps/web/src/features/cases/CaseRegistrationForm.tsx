/**
 * CaseRegistrationForm — form for registering a new case.
 * Source: CCM Phase 4 Case Creation Workspace spec.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StoreIcon from '@mui/icons-material/Store';
import {
  fetchCategories,
  fetchCategory,
  fetchCaseNatures,
  fetchDepartments,
  fetchPriorities,
  fetchProductTypes,
} from '@/features/case-category/caseCategoryApi';
import type { CategoryDto, LookupValue, SubcategoryDto } from '@/features/case-category/caseCategoryApi';
import { checkDuplicate, createCase } from './casesApi';
import type { CaseDto, DuplicateCheckResult, DealerItem } from './casesApi';
import { DealerSearchModal } from './DealerSearchModal';
import { DuplicateCaseModal } from './DuplicateCaseModal';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CaseRegistrationFormProps {
  interactionId: string;
  customerRef: string;
  vehicleRef: string | null;
  derivedProductType: string | null;
  onRegistered: (cas: CaseDto) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CaseRegistrationForm({
  interactionId,
  customerRef,
  vehicleRef,
  derivedProductType,
  onRegistered,
  onClose,
}: CaseRegistrationFormProps) {
  // ── Lookup data ─────────────────────────────────────────────────────────
  const [caseNatures, setCaseNatures] = useState<LookupValue[]>([]);
  const [departments, setDepartments] = useState<LookupValue[]>([]);
  const [priorities, setPriorities] = useState<LookupValue[]>([]);
  const [productTypes, setProductTypes] = useState<LookupValue[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryDto[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupsError, setLookupsError] = useState<string | null>(null);

  // ── Dynamic category/subcategory ─────────────────────────────────────────
  const [applicableCategories, setApplicableCategories] = useState<CategoryDto[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryDto[]>([]);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);

  // ── Form fields ──────────────────────────────────────────────────────────
  const [caseNature, setCaseNature] = useState('');
  const [department, setDepartment] = useState('');
  const [priority, setPriority] = useState('');
  const [manualProductType, setManualProductType] = useState('');
  const [caseCategoryId, setCaseCategoryId] = useState('');
  const [caseSubcategoryId, setCaseSubcategoryId] = useState('');
  const [customerRemarks, setCustomerRemarks] = useState('');
  const [agentRemarks, setAgentRemarks] = useState('');
  const [selectedDealer, setSelectedDealer] = useState<DealerItem | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [dealerModalOpen, setDealerModalOpen] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult['existingCase'] | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [lastCheckedCombo, setLastCheckedCombo] = useState('');

  // ── Derived ──────────────────────────────────────────────────────────────
  const effectiveProductType = derivedProductType ?? manualProductType;

  // ── Load lookups on mount ────────────────────────────────────────────────
  const loadLookups = useCallback(async () => {
    setLookupsLoading(true);
    setLookupsError(null);
    try {
      const calls: Promise<unknown>[] = [
        fetchCaseNatures(),
        fetchDepartments(),
        fetchPriorities(),
        fetchCategories(),
      ];
      if (!derivedProductType) {
        calls.push(fetchProductTypes());
      }
      const results = await Promise.all(calls);
      setCaseNatures(results[0] as LookupValue[]);
      setDepartments(results[1] as LookupValue[]);
      setPriorities(results[2] as LookupValue[]);
      setAllCategories(results[3] as CategoryDto[]);
      if (!derivedProductType) {
        setProductTypes(results[4] as LookupValue[]);
      }
    } catch {
      setLookupsError('Failed to load form data. Please close and try again.');
    } finally {
      setLookupsLoading(false);
    }
  }, [derivedProductType]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  // ── Filter applicable categories ─────────────────────────────────────────
  useEffect(() => {
    if (!caseNature || !department || !effectiveProductType) {
      setApplicableCategories([]);
      return;
    }
    const filtered = allCategories.filter(
      (c) =>
        c.isActive &&
        c.departments.includes(department) &&
        c.caseNatures.includes(caseNature) &&
        c.productTypes.includes(effectiveProductType),
    );
    setApplicableCategories(filtered);
  }, [caseNature, department, effectiveProductType, allCategories]);

  // ── Load subcategories when category selected ────────────────────────────
  useEffect(() => {
    if (!caseCategoryId) {
      setSubcategories([]);
      return;
    }
    setSubcategoriesLoading(true);
    fetchCategory(caseCategoryId)
      .then((cat) => {
        const activeSubs = (cat.subcategories ?? []).filter((s) => s.isActive);
        setSubcategories(activeSubs);
      })
      .catch(() => {
        setSubcategories([]);
      })
      .finally(() => setSubcategoriesLoading(false));
  }, [caseCategoryId]);

  // ── Cascade: caseNature change → clear department, productType, category, subcategory, dealer ──
  useEffect(() => {
    setDepartment('');
    setManualProductType('');
    setCaseCategoryId('');
    setCaseSubcategoryId('');
    setSelectedDealer(null);
    setLastCheckedCombo('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseNature]);

  // ── Cascade: department change → clear category, subcategory ─────────────
  useEffect(() => {
    setCaseCategoryId('');
    setCaseSubcategoryId('');
    setLastCheckedCombo('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department]);

  // ── Cascade: manual product type change → clear category, subcategory, dealer ──
  useEffect(() => {
    if (derivedProductType) return; // only applies when manual
    setCaseCategoryId('');
    setCaseSubcategoryId('');
    setSelectedDealer(null);
    setLastCheckedCombo('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualProductType]);

  // ── Cascade: category change → clear subcategory ─────────────────────────
  useEffect(() => {
    setCaseSubcategoryId('');
    setLastCheckedCombo('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseCategoryId]);

  // ── Duplicate check ──────────────────────────────────────────────────────
  const triggerCombo =
    caseNature && department && caseCategoryId && caseSubcategoryId
      ? `${caseNature}|${department}|${caseCategoryId}|${caseSubcategoryId}`
      : '';

  useEffect(() => {
    if (!triggerCombo) return;
    if (triggerCombo === lastCheckedCombo) return;

    setLastCheckedCombo(triggerCombo);
    checkDuplicate({
      customerRef,
      vehicleRef: vehicleRef ?? undefined,
      caseNature,
      department,
      caseCategoryId,
      caseSubcategoryId,
    })
      .then((result) => {
        if (result.isDuplicate && result.existingCase) {
          setDuplicateResult(result.existingCase);
          setDuplicateModalOpen(true);
        }
      })
      .catch(() => {
        setErrors((prev) => ({
          ...prev,
          _duplicate: 'Duplicate check unavailable. Submission blocked.',
        }));
      });
  // Intentionally omitting stable refs — only re-run when the combo string changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerCombo]);

  // ── Validation ───────────────────────────────────────────────────────────
  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!caseNature) newErrors.caseNature = 'Case Nature is a mandatory field.';
    if (!department) newErrors.department = 'Department is a mandatory field.';
    if (!derivedProductType && !manualProductType)
      newErrors.productType = 'Product Type is a mandatory field.';
    if (!caseCategoryId) newErrors.caseCategory = 'Case Category is a mandatory field.';
    if (!caseSubcategoryId) newErrors.caseSubcategory = 'Case Subcategory is a mandatory field.';
    if (!customerRemarks.trim())
      newErrors.customerRemarks = 'Customer Remarks is a mandatory field.';
    else if (customerRemarks.length > 1000)
      newErrors.customerRemarks = 'Customer remarks cannot exceed 1000 characters.';
    if (!agentRemarks.trim()) newErrors.agentRemarks = 'Agent Remarks is a mandatory field.';
    else if (agentRemarks.length > 1000)
      newErrors.agentRemarks = 'Agent remarks cannot exceed 1000 characters.';
    if (!selectedDealer) newErrors.dealer = 'Dealer assignment is mandatory.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleRegister() {
    if (errors['_duplicate']) return; // duplicate check blocked submission
    if (!validate()) return;
    setSubmitting(true);
    try {
      const cas = await createCase({
        interactionId,
        customerRef,
        vehicleRef: vehicleRef ?? null,
        caseNature,
        department,
        priority: priority || null,
        productType: effectiveProductType,
        productTypeSource: derivedProductType ? 'Derived' : 'Manually Selected',
        caseCategoryId,
        caseSubcategoryId,
        customerRemarks,
        agentRemarks,
        dealerRef: selectedDealer!.dealerCode,
      });
      onRegistered(cas);
    } catch (err: unknown) {
      // Extract the API error message from the axios response body when available,
      // otherwise fall back to the generic axios message or a safe default.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiMsg = (err as any)?.response?.data?.message as string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const httpStatus = (err as any)?.response?.status as number | undefined;
      let msg: string;
      if (httpStatus === 409) {
        msg = apiMsg ?? 'A case has already been registered for this interaction.';
      } else {
        msg = apiMsg ?? (err instanceof Error ? err.message : 'Registration failed. Please try again.');
      }
      setErrors((prev) => ({ ...prev, _submit: msg }));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  function handleResetConfirm() {
    setCaseNature('');
    setDepartment('');
    setPriority('');
    setManualProductType('');
    setCaseCategoryId('');
    setCaseSubcategoryId('');
    setCustomerRemarks('');
    setAgentRemarks('');
    setSelectedDealer(null);
    setErrors({});
    setLastCheckedCombo('');
    setDuplicateResult(null);
    setResetDialogOpen(false);
  }

  // ── Render: loading / error ──────────────────────────────────────────────
  if (lookupsLoading) {
    return (
      <Paper variant="outlined" sx={{ p: 3, m: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Skeleton key={n} height={56} />
          ))}
        </Box>
      </Paper>
    );
  }

  if (lookupsError) {
    return (
      <Paper variant="outlined" sx={{ p: 3, m: 2 }}>
        <Alert severity="error">{lookupsError}</Alert>
      </Paper>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <>
      <Paper variant="outlined" sx={{ m: 2 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2.5,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            New Case
          </Typography>
          <IconButton
            aria-label="Close case registration form"
            size="small"
            onClick={onClose}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ p: 2.5 }}>
          {/* Global errors */}
          {errors['_duplicate'] && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors['_duplicate']}
            </Alert>
          )}
          {errors['_submit'] && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors['_submit']}
            </Alert>
          )}

          {/* Two-column grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
            {/* Case Nature */}
            <FormControl size="small" error={Boolean(errors['caseNature'])}>
              <InputLabel required>Case Nature</InputLabel>
              <Select
                value={caseNature}
                label="Case Nature *"
                onChange={(e: SelectChangeEvent) => setCaseNature(e.target.value)}
              >
                {caseNatures.map((n) => (
                  <MenuItem key={n.code} value={n.code}>
                    {n.label ?? n.code}
                  </MenuItem>
                ))}
              </Select>
              {errors['caseNature'] && (
                <FormHelperText>{errors['caseNature']}</FormHelperText>
              )}
            </FormControl>

            {/* Department */}
            <FormControl size="small" error={Boolean(errors['department'])}>
              <InputLabel required>Department</InputLabel>
              <Select
                value={department}
                label="Department *"
                onChange={(e: SelectChangeEvent) => setDepartment(e.target.value)}
              >
                {departments.map((d) => (
                  <MenuItem key={d.code} value={d.code}>
                    {d.label ?? d.code}
                  </MenuItem>
                ))}
              </Select>
              {errors['department'] && (
                <FormHelperText>{errors['department']}</FormHelperText>
              )}
            </FormControl>

            {/* Priority (optional) */}
            <FormControl size="small">
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                label="Priority"
                onChange={(e: SelectChangeEvent) => setPriority(e.target.value)}
              >
                <MenuItem value="">None</MenuItem>
                {priorities.map((p) => (
                  <MenuItem key={p.code} value={p.code}>
                    {p.label ?? p.code}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Product Type */}
            {derivedProductType ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90 }}>
                  Product Type
                </Typography>
                <Chip label={derivedProductType} size="small" color="primary" variant="outlined" />
                <Typography variant="caption" color="text.secondary">
                  (Derived from vehicle)
                </Typography>
              </Box>
            ) : (
              <FormControl size="small" error={Boolean(errors['productType'])}>
                <InputLabel required>Product Type</InputLabel>
                <Select
                  value={manualProductType}
                  label="Product Type *"
                  onChange={(e: SelectChangeEvent) => setManualProductType(e.target.value)}
                >
                  {productTypes.map((p) => (
                    <MenuItem key={p.code} value={p.code}>
                      {p.label ?? p.code}
                    </MenuItem>
                  ))}
                </Select>
                {errors['productType'] && (
                  <FormHelperText>{errors['productType']}</FormHelperText>
                )}
              </FormControl>
            )}

            {/* Case Category */}
            <FormControl
              size="small"
              error={Boolean(errors['caseCategory'])}
              disabled={applicableCategories.length === 0}
            >
              <InputLabel required>Case Category</InputLabel>
              <Select
                value={caseCategoryId}
                label="Case Category *"
                onChange={(e: SelectChangeEvent) => {
                  setCaseCategoryId(e.target.value);
                }}
              >
                {applicableCategories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.displayName}
                  </MenuItem>
                ))}
              </Select>
              {errors['caseCategory'] && (
                <FormHelperText>{errors['caseCategory']}</FormHelperText>
              )}
              {!errors['caseCategory'] && applicableCategories.length === 0 && caseNature && department && effectiveProductType && (
                <FormHelperText>No categories match the selected combination.</FormHelperText>
              )}
            </FormControl>

            {/* Case Subcategory */}
            <FormControl
              size="small"
              error={Boolean(errors['caseSubcategory'])}
              disabled={!caseCategoryId || subcategoriesLoading}
            >
              <InputLabel required>Case Subcategory</InputLabel>
              <Select
                value={caseSubcategoryId}
                label="Case Subcategory *"
                onChange={(e: SelectChangeEvent) => {
                  setCaseSubcategoryId(e.target.value);
                }}
              >
                {subcategories.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.displayName}
                  </MenuItem>
                ))}
              </Select>
              {errors['caseSubcategory'] && (
                <FormHelperText>{errors['caseSubcategory']}</FormHelperText>
              )}
            </FormControl>

            {/* Customer Remarks — full width */}
            <Box sx={{ gridColumn: { md: '1 / -1' } }}>
              <TextField
                label="Customer Remarks"
                required
                size="small"
                fullWidth
                multiline
                rows={3}
                value={customerRemarks}
                onChange={(e) => setCustomerRemarks(e.target.value)}
                error={Boolean(errors['customerRemarks'])}
                helperText={
                  errors['customerRemarks'] ??
                  `${customerRemarks.length}/1000 characters`
                }
                inputProps={{ maxLength: 1000 }}
              />
            </Box>

            {/* Agent Remarks — full width */}
            <Box sx={{ gridColumn: { md: '1 / -1' } }}>
              <TextField
                label="Agent Remarks"
                required
                size="small"
                fullWidth
                multiline
                rows={3}
                value={agentRemarks}
                onChange={(e) => setAgentRemarks(e.target.value)}
                error={Boolean(errors['agentRemarks'])}
                helperText={
                  errors['agentRemarks'] ??
                  `${agentRemarks.length}/1000 characters`
                }
                inputProps={{ maxLength: 1000 }}
              />
            </Box>
          </Box>

          {/* Dealer selection — full width */}
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
              Dealer Assignment <Typography component="span" color="error">*</Typography>
            </Typography>

            {selectedDealer ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  p: 1.5,
                  border: '1px solid',
                  borderColor: errors['dealer'] ? 'error.main' : 'primary.main',
                  borderRadius: 1,
                  bgcolor: 'primary.50',
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {selectedDealer.branchName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedDealer.dealerName} &mdash; {selectedDealer.dealerCode} |{' '}
                    {selectedDealer.city}, {selectedDealer.state}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setDealerModalOpen(true)}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  Change Dealer
                </Button>
              </Box>
            ) : (
              <Box>
                <Button
                  variant="outlined"
                  startIcon={<StoreIcon />}
                  onClick={() => setDealerModalOpen(true)}
                  disabled={!effectiveProductType}
                  sx={{ textTransform: 'none' }}
                  color={errors['dealer'] ? 'error' : 'primary'}
                >
                  {effectiveProductType ? 'Select Dealer' : 'Select Product Type first'}
                </Button>
                {errors['dealer'] && (
                  <FormHelperText error sx={{ mt: 0.5, ml: 1 }}>
                    {errors['dealer']}
                  </FormHelperText>
                )}
              </Box>
            )}
          </Box>

          {/* Action row */}
          <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              color="error"
              onClick={() => setResetDialogOpen(true)}
              disabled={submitting}
              sx={{ textTransform: 'none' }}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => void handleRegister()}
              disabled={submitting || Boolean(errors['_duplicate'])}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {submitting ? 'Registering…' : 'Register Case'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Dealer search modal */}
      {effectiveProductType && (
        <DealerSearchModal
          open={dealerModalOpen}
          productType={effectiveProductType}
          onSelect={(dealer) => {
            setSelectedDealer(dealer);
            setErrors((prev) => {
              const next = { ...prev };
              delete next['dealer'];
              return next;
            });
          }}
          onClose={() => setDealerModalOpen(false)}
        />
      )}

      {/* Duplicate case modal */}
      {duplicateResult && (
        <DuplicateCaseModal
          open={duplicateModalOpen}
          existingCase={duplicateResult}
          onViewExisting={() => {
            // Placeholder: full case detail view is out of scope for Phase 4
            setDuplicateModalOpen(false);
          }}
          onCancel={() => setDuplicateModalOpen(false)}
        />
      )}

      {/* Reset confirmation dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset Form</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to reset? All entered case details will be cleared.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={handleResetConfirm} color="error" variant="contained" sx={{ textTransform: 'none' }}>
            Reset
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}


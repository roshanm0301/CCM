/**
 * ActivityTemplateForm — create / edit form for Activity Template.
 *
 * Sections:
 * 1. Template header (name, appliesTo, department, productType, isActive)
 * 2. Steps table (stepNo, activity, role, SLA, weight, mandatory, startStep, outcomes, delete)
 * 3. Save / Cancel
 *
 * Integrity validation errors are surfaced from the API as a list.
 *
 * Source: CCM_Phase5_ActivityFlowConfiguration.md § Features 3–6
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Badge,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  fetchTemplate,
  createTemplate,
  updateTemplate,
  fetchTemplateDepartments,
  fetchTemplateProductTypes,
  fetchTemplateAppliesTo,
  fetchTemplateRoles,
  fetchActiveActivities,
  type StepDto,
  type OutcomeDto,
  type LookupValue,
  type ActivityMasterDto,
} from './activityTemplateApi';
import { OutcomeConfigModal } from './OutcomeConfigModal';

// ---------------------------------------------------------------------------
// Local step type (adds stable React key)
// ---------------------------------------------------------------------------

interface LocalStep extends StepDto {
  _key: number;
}

let _stepKeyCounter = 0;
function nextStepKey() { return ++_stepKeyCounter; }

// ---------------------------------------------------------------------------
// Header form state & validation
// ---------------------------------------------------------------------------

interface HeaderForm {
  templateName: string;
  appliesTo: string;
  department: string;
  productType: string;
  isActive: boolean;
}

interface HeaderErrors {
  templateName?: string;
  appliesTo?: string;
  department?: string;
  productType?: string;
}

function validateHeader(form: HeaderForm): HeaderErrors {
  const errs: HeaderErrors = {};
  if (!form.templateName.trim()) errs.templateName = 'Template Name is required.';
  if (!form.appliesTo)           errs.appliesTo = 'Applies To is required.';
  if (!form.department)          errs.department = 'Department is required.';
  if (!form.productType)         errs.productType = 'Product Type is required.';
  return errs;
}

const EMPTY_HEADER: HeaderForm = {
  templateName: '',
  appliesTo:    '',
  department:   '',
  productType:  '',
  isActive:     true,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActivityTemplateFormProps {
  editId: string | null;
  onCancel: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityTemplateForm({ editId, onCancel, onSaved }: ActivityTemplateFormProps) {
  const [header, setHeader] = useState<HeaderForm>(EMPTY_HEADER);
  const [headerTouched, setHeaderTouched] = useState<Partial<Record<keyof HeaderForm, boolean>>>({});
  const [steps, setSteps] = useState<LocalStep[]>([]);

  // Lookups
  const [departments, setDepartments] = useState<LookupValue[]>([]);
  const [productTypes, setProductTypes] = useState<LookupValue[]>([]);
  const [appliesTo, setAppliesTo] = useState<LookupValue[]>([]);
  const [roles, setRoles] = useState<LookupValue[]>([]);
  const [activities, setActivities] = useState<ActivityMasterDto[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiErrors, setApiErrors] = useState<string[]>([]);

  // Outcome modal state
  const [outcomeModal, setOutcomeModal] = useState<{ open: boolean; stepKey: number | null }>({
    open: false,
    stepKey: null,
  });

  // Step-level inline errors (delete blocked)
  const [stepErrors, setStepErrors] = useState<Record<number, string>>({});

  const isEditMode = editId !== null;
  const headerErrors = validateHeader(header);

  // Load lookups + (if edit) template data
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const [deps, pts, ats, rls, acts] = await Promise.all([
          fetchTemplateDepartments(),
          fetchTemplateProductTypes(),
          fetchTemplateAppliesTo(),
          fetchTemplateRoles(),
          fetchActiveActivities(),
        ]);
        setDepartments(deps);
        setProductTypes(pts);
        setAppliesTo(ats);
        setRoles(rls);
        setActivities(acts);

        if (editId) {
          const tpl = await fetchTemplate(editId);
          setHeader({
            templateName: tpl.templateName,
            appliesTo:    tpl.appliesTo,
            department:   tpl.department,
            productType:  tpl.productType,
            isActive:     tpl.isActive,
          });
          setSteps(tpl.steps.map((s) => ({ ...s, _key: nextStepKey() })));
        }
      } catch {
        setApiErrors(['Failed to load form data. Please go back and try again.']);
      } finally {
        setLoading(false);
      }
    };
    void loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // ---------------------------------------------------------------------------
  // Header handlers
  // ---------------------------------------------------------------------------

  const handleHeaderChange = useCallback(
    (field: keyof HeaderForm, value: string | boolean) => {
      setHeader((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleHeaderBlur = useCallback((field: keyof HeaderForm) => {
    setHeaderTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // ---------------------------------------------------------------------------
  // Step handlers
  // ---------------------------------------------------------------------------

  function addStep() {
    const nextNo = steps.length > 0 ? Math.max(...steps.map((s) => s.stepNo)) + 1 : 1;
    setSteps((prev) => [
      ...prev,
      {
        _key:             nextStepKey(),
        stepNo:           nextNo,
        activityId:       '',
        assignedRole:     '',
        slaValue:         null,
        slaUnit:          null,
        weightPercentage: 0,
        isMandatory:      false,
        isStartStep:      false,
        outcomes:         [],
      },
    ]);
  }

  function updateStep(key: number, patch: Partial<LocalStep>) {
    setSteps((prev) => prev.map((s) => (s._key === key ? { ...s, ...patch } : s)));
    // Clear step-level error when user edits
    setStepErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function setStartStep(key: number) {
    setSteps((prev) =>
      prev.map((s) => ({ ...s, isStartStep: s._key === key })),
    );
  }

  function deleteStep(key: number) {
    const step = steps.find((s) => s._key === key);
    if (!step) return;

    // Check if this stepNo is referenced as nextStepNo in any outcome anywhere
    const isReferenced = steps.some((s) =>
      s.outcomes.some((o) => o.nextStepNo === step.stepNo),
    );

    if (isReferenced) {
      setStepErrors((prev) => ({
        ...prev,
        [key]: 'Step is being used in outcome routing.',
      }));
      return;
    }
    setSteps((prev) => prev.filter((s) => s._key !== key));
  }

  // ---------------------------------------------------------------------------
  // Outcome modal handlers
  // ---------------------------------------------------------------------------

  function openOutcomeModal(stepKey: number) {
    setOutcomeModal({ open: true, stepKey });
  }

  function closeOutcomeModal() {
    setOutcomeModal({ open: false, stepKey: null });
  }

  function handleOutcomeSave(outcomes: OutcomeDto[]) {
    if (outcomeModal.stepKey !== null) {
      updateStep(outcomeModal.stepKey, { outcomes });
    }
    closeOutcomeModal();
  }

  const activeStep = outcomeModal.stepKey !== null
    ? steps.find((s) => s._key === outcomeModal.stepKey)
    : null;

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    // Touch all header fields
    setHeaderTouched({ templateName: true, appliesTo: true, department: true, productType: true });

    if (Object.keys(validateHeader(header)).length > 0) return;

    setSaving(true);
    setApiErrors([]);

    const payload = {
      templateName: header.templateName.trim(),
      appliesTo:    header.appliesTo,
      department:   header.department,
      productType:  header.productType,
      isActive:     header.isActive,
      steps:        steps.map(({ _key: _k, ...rest }) => rest),
    };

    try {
      if (isEditMode && editId) {
        await updateTemplate(editId, payload);
      } else {
        await createTemplate(payload);
      }
      onSaved();
    } catch (err: unknown) {
      const errData = (err as {
        response?: { data?: { error?: { message?: string; details?: unknown } } };
      })?.response?.data?.error;

      if (Array.isArray(errData?.details)) {
        // Graph integrity errors — each detail is a string or Zod issue
        const msgs = (errData.details as Array<{ message?: string } | string>).map((d) =>
          typeof d === 'string' ? d : d.message ?? String(d),
        );
        setApiErrors(msgs);
      } else {
        setApiErrors([errData?.message ?? 'Save failed. Please try again.']);
      }
    } finally {
      setSaving(false);
    }
  }, [header, steps, isEditMode, editId, onSaved]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const stepSummaries = steps.map((s) => {
    const act = activities.find((a) => a.id === s.activityId);
    return { stepNo: s.stepNo, label: act?.displayName ?? `Step ${s.stepNo}` };
  });

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  // ---------------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------------

  return (
    <Box>
      {/* Back + title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={onCancel} size="small" aria-label="Back to list">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={600}>
          {isEditMode ? 'Edit Activity Template' : 'New Activity Template'}
        </Typography>
      </Box>

      {apiErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            Please fix the following errors:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {apiErrors.map((msg, i) => (
              <li key={i}>
                <Typography variant="body2">{msg}</Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Header Card                                                         */}
      {/* ----------------------------------------------------------------- */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Template Details
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {/* Template Name */}
            <Box sx={{ gridColumn: '1 / -1' }}>
              <TextField
                label="Template Name"
                required
                fullWidth
                size="small"
                value={header.templateName}
                onChange={(e) => handleHeaderChange('templateName', e.target.value)}
                onBlur={() => handleHeaderBlur('templateName')}
                error={headerTouched.templateName === true && Boolean(headerErrors.templateName)}
                helperText={headerTouched.templateName === true ? headerErrors.templateName : undefined}
                inputProps={{ maxLength: 200 }}
              />
            </Box>

            {/* Applies To */}
            <FormControl
              size="small"
              required
              error={headerTouched.appliesTo === true && Boolean(headerErrors.appliesTo)}
            >
              <InputLabel>Applies To</InputLabel>
              <Select
                label="Applies To"
                value={header.appliesTo}
                onChange={(e: SelectChangeEvent) => handleHeaderChange('appliesTo', e.target.value)}
                onBlur={() => handleHeaderBlur('appliesTo')}
              >
                {appliesTo.map((v) => (
                  <MenuItem key={v.code} value={v.code}>{v.label}</MenuItem>
                ))}
              </Select>
              {headerTouched.appliesTo === true && headerErrors.appliesTo && (
                <FormHelperText>{headerErrors.appliesTo}</FormHelperText>
              )}
            </FormControl>

            {/* Department */}
            <FormControl
              size="small"
              required
              error={headerTouched.department === true && Boolean(headerErrors.department)}
            >
              <InputLabel>Department</InputLabel>
              <Select
                label="Department"
                value={header.department}
                onChange={(e: SelectChangeEvent) => handleHeaderChange('department', e.target.value)}
                onBlur={() => handleHeaderBlur('department')}
              >
                {departments.map((v) => (
                  <MenuItem key={v.code} value={v.code}>{v.label}</MenuItem>
                ))}
              </Select>
              {headerTouched.department === true && headerErrors.department && (
                <FormHelperText>{headerErrors.department}</FormHelperText>
              )}
            </FormControl>

            {/* Product Type */}
            <FormControl
              size="small"
              required
              error={headerTouched.productType === true && Boolean(headerErrors.productType)}
            >
              <InputLabel>Product Type</InputLabel>
              <Select
                label="Product Type"
                value={header.productType}
                onChange={(e: SelectChangeEvent) => handleHeaderChange('productType', e.target.value)}
                onBlur={() => handleHeaderBlur('productType')}
              >
                {productTypes.map((v) => (
                  <MenuItem key={v.code} value={v.code}>{v.label}</MenuItem>
                ))}
              </Select>
              {headerTouched.productType === true && headerErrors.productType && (
                <FormHelperText>{headerErrors.productType}</FormHelperText>
              )}
            </FormControl>

            {/* Is Active */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={header.isActive}
                    onChange={(e) => handleHeaderChange('isActive', e.target.checked)}
                    sx={{ color: '#EB6A2C', '&.Mui-checked': { color: '#EB6A2C' } }}
                  />
                }
                label="Active"
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Steps Card                                                          */}
      {/* ----------------------------------------------------------------- */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Steps
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={addStep}
              sx={{ textTransform: 'none', color: '#EB6A2C' }}
            >
              Add Step
            </Button>
          </Box>

          {steps.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No steps added. Click "Add Step" to define the flow.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600, minWidth: 60 }}>Step No.</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 160 }}>Activity *</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 160 }}>Assigned Role *</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 80 }}>SLA Value</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 90 }}>SLA Unit</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 80 }}>Weight %</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Mandatory</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Start</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Outcomes</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Del</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {steps.map((step) => (
                    <React.Fragment key={step._key}>
                      <TableRow hover>
                        {/* Step No. */}
                        <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                          <TextField
                            size="small"
                            type="number"
                            value={step.stepNo}
                            onChange={(e) =>
                              updateStep(step._key, { stepNo: parseInt(e.target.value, 10) || 1 })
                            }
                            inputProps={{ min: 1, style: { width: 50 } }}
                          />
                        </TableCell>

                        {/* Activity */}
                        <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                          <FormControl size="small" fullWidth>
                            <Select
                              value={step.activityId}
                              displayEmpty
                              onChange={(e: SelectChangeEvent) =>
                                updateStep(step._key, { activityId: e.target.value })
                              }
                            >
                              <MenuItem value="" disabled>
                                <em>Select Activity</em>
                              </MenuItem>
                              {activities.map((a) => (
                                <MenuItem key={a.id} value={a.id}>
                                  {a.displayName}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>

                        {/* Assigned Role */}
                        <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                          <FormControl size="small" fullWidth>
                            <Select
                              value={step.assignedRole}
                              displayEmpty
                              onChange={(e: SelectChangeEvent) =>
                                updateStep(step._key, { assignedRole: e.target.value })
                              }
                            >
                              <MenuItem value="" disabled>
                                <em>Select Role</em>
                              </MenuItem>
                              {roles.map((r) => (
                                <MenuItem key={r.code} value={r.code}>
                                  {r.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>

                        {/* SLA Value */}
                        <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                          <TextField
                            size="small"
                            type="number"
                            value={step.slaValue ?? ''}
                            onChange={(e) =>
                              updateStep(step._key, {
                                slaValue: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            inputProps={{ min: 0, style: { width: 70 } }}
                          />
                        </TableCell>

                        {/* SLA Unit */}
                        <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                          <FormControl size="small" fullWidth>
                            <Select
                              value={step.slaUnit ?? ''}
                              displayEmpty
                              onChange={(e: SelectChangeEvent) =>
                                updateStep(step._key, {
                                  slaUnit: (e.target.value || null) as 'Hours' | 'Days' | null,
                                })
                              }
                            >
                              <MenuItem value=""><em>None</em></MenuItem>
                              <MenuItem value="Hours">Hours</MenuItem>
                              <MenuItem value="Days">Days</MenuItem>
                            </Select>
                          </FormControl>
                        </TableCell>

                        {/* Weight % */}
                        <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                          <TextField
                            size="small"
                            type="number"
                            value={step.weightPercentage}
                            onChange={(e) =>
                              updateStep(step._key, {
                                weightPercentage: Math.min(100, Math.max(0, Number(e.target.value))),
                              })
                            }
                            inputProps={{ min: 0, max: 100, style: { width: 60 } }}
                          />
                        </TableCell>

                        {/* Is Mandatory */}
                        <TableCell align="center" sx={{ verticalAlign: 'top', pt: 1 }}>
                          <Checkbox
                            checked={step.isMandatory}
                            onChange={(e) => updateStep(step._key, { isMandatory: e.target.checked })}
                            size="small"
                            sx={{ color: '#EB6A2C', '&.Mui-checked': { color: '#EB6A2C' } }}
                          />
                        </TableCell>

                        {/* Is Start Step — radio (single-select) */}
                        <TableCell align="center" sx={{ verticalAlign: 'top', pt: 1 }}>
                          <Radio
                            checked={step.isStartStep}
                            onChange={() => setStartStep(step._key)}
                            size="small"
                            sx={{ color: '#EB6A2C', '&.Mui-checked': { color: '#EB6A2C' } }}
                          />
                        </TableCell>

                        {/* Configure Outcomes */}
                        <TableCell align="center" sx={{ verticalAlign: 'top', pt: 0.75 }}>
                          <Tooltip title="Configure Outcomes">
                            <IconButton
                              size="small"
                              onClick={() => openOutcomeModal(step._key)}
                              sx={{ color: step.outcomes.length === 0 ? 'error.main' : 'text.secondary' }}
                            >
                              <Badge
                                badgeContent={step.outcomes.length}
                                color={step.outcomes.length === 0 ? 'error' : 'default'}
                                max={99}
                              >
                                <SettingsOutlinedIcon fontSize="small" />
                              </Badge>
                            </IconButton>
                          </Tooltip>
                        </TableCell>

                        {/* Delete step */}
                        <TableCell align="center" sx={{ verticalAlign: 'top', pt: 0.75 }}>
                          <IconButton
                            size="small"
                            onClick={() => deleteStep(step._key)}
                            aria-label="Delete step"
                            sx={{ color: 'error.main' }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>

                      {/* Inline error row for delete-blocked steps */}
                      {stepErrors[step._key] && (
                        <TableRow>
                          <TableCell colSpan={10} sx={{ pt: 0, pb: 0.5, border: 0 }}>
                            <Typography variant="caption" color="error">
                              {stepErrors[step._key]}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Action buttons                                                      */}
      {/* ----------------------------------------------------------------- */}
      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={onCancel}
          disabled={saving}
          sx={{ textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{
            bgcolor: '#EB6A2C',
            '&:hover': { bgcolor: '#d45e22' },
            textTransform: 'none',
            fontWeight: 600,
            minWidth: 100,
          }}
        >
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Save Template'}
        </Button>
      </Box>

      {/* ----------------------------------------------------------------- */}
      {/* Outcome Config Modal                                                */}
      {/* ----------------------------------------------------------------- */}
      {activeStep && (
        <OutcomeConfigModal
          open={outcomeModal.open}
          stepNo={activeStep.stepNo}
          stepLabel={
            activities.find((a) => a.id === activeStep.activityId)?.displayName ??
            `Step ${activeStep.stepNo}`
          }
          allSteps={stepSummaries}
          initialOutcomes={activeStep.outcomes}
          roles={roles}
          onSave={handleOutcomeSave}
          onClose={closeOutcomeModal}
        />
      )}
    </Box>
  );
}

/**
 * OutcomeConfigModal — per-step outcome configuration dialog.
 *
 * Rules enforced:
 * - Outcome Name mandatory, unique within step (case-insensitive, trimmed)
 * - Move Forward requires Next Step
 * - Loop requires Next Step blank
 * - Close requires Next Step blank
 *
 * Source: CCM_Phase5_ActivityFlowConfiguration.md § Feature 5
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { OutcomeDto, LookupValue } from './activityTemplateApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepSummary {
  stepNo: number;
  label: string;
}

interface OutcomeConfigModalProps {
  open: boolean;
  stepNo: number;
  stepLabel: string;
  allSteps: StepSummary[];
  initialOutcomes: OutcomeDto[];
  roles: LookupValue[];
  onSave: (outcomes: OutcomeDto[]) => void;
  onClose: () => void;
}

interface OutcomeRow extends OutcomeDto {
  _key: number; // local-only stable key for React list rendering
}

interface OutcomeErrors {
  outcomeName?: string;
  outcomeType?: string;
  nextStepNo?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _outcomeKeyCounter = 0;
function nextKey() { return ++_outcomeKeyCounter; }

function blankOutcome(): OutcomeRow {
  return {
    _key:                    nextKey(),
    outcomeName:             '',
    outcomeType:             'MoveForward',
    nextStepNo:              null,
    roleOverride:            null,
    requiresOtpVerification: false,
  };
}

function validateOutcome(
  outcome: OutcomeRow,
  allOutcomes: OutcomeRow[],
): OutcomeErrors {
  const errs: OutcomeErrors = {};

  if (!outcome.outcomeName.trim()) {
    errs.outcomeName = 'Outcome Name is required.';
  } else {
    const dup = allOutcomes.find(
      (o) =>
        o._key !== outcome._key &&
        o.outcomeName.trim().toLowerCase() === outcome.outcomeName.trim().toLowerCase(),
    );
    if (dup) errs.outcomeName = 'Duplicate outcome name is not allowed within the same step.';
  }

  if (!outcome.outcomeType) {
    errs.outcomeType = 'Outcome Type is required.';
  } else if (outcome.outcomeType === 'MoveForward' && outcome.nextStepNo === null) {
    errs.nextStepNo = 'Next Step is required for Move Forward outcome.';
  } else if (outcome.outcomeType === 'Loop' && outcome.nextStepNo !== null) {
    errs.nextStepNo = 'Next Step must be blank for Loop outcome.';
  } else if (outcome.outcomeType === 'Close' && outcome.nextStepNo !== null) {
    errs.nextStepNo = 'Next Step must be blank for Close outcome.';
  }

  return errs;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OutcomeConfigModal({
  open,
  stepNo,
  stepLabel,
  allSteps,
  initialOutcomes,
  roles,
  onSave,
  onClose,
}: OutcomeConfigModalProps) {
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>(() =>
    initialOutcomes.map((o) => ({ ...o, _key: nextKey() })),
  );
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Re-initialise when the modal re-opens for a (possibly different) step
  React.useEffect(() => {
    if (open) {
      setOutcomes(initialOutcomes.map((o) => ({ ...o, _key: nextKey() })));
      setTouched(new Set());
      setSubmitAttempted(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Steps that can be chosen as "Next Step" — any step except the current one
  const nextStepOptions = allSteps.filter((s) => s.stepNo !== stepNo);

  const addOutcome = useCallback(() => {
    setOutcomes((prev) => [...prev, blankOutcome()]);
  }, []);

  const removeOutcome = useCallback((key: number) => {
    setOutcomes((prev) => prev.filter((o) => o._key !== key));
  }, []);

  const updateOutcome = useCallback((key: number, patch: Partial<OutcomeRow>) => {
    setOutcomes((prev) =>
      prev.map((o) => {
        if (o._key !== key) return o;
        const updated = { ...o, ...patch };
        // Auto-clear nextStepNo when type changes to Loop or Close
        if (
          patch.outcomeType !== undefined &&
          (patch.outcomeType === 'Loop' || patch.outcomeType === 'Close')
        ) {
          updated.nextStepNo = null;
        }
        return updated;
      }),
    );
  }, []);

  const markTouched = useCallback((key: number) => {
    setTouched((prev) => new Set([...prev, key]));
  }, []);

  const allErrors = outcomes.map((o) => ({
    key: o._key,
    errs: validateOutcome(o, outcomes),
  }));

  const hasErrors = allErrors.some((e) => Object.keys(e.errs).length > 0);

  const handleSave = useCallback(() => {
    setSubmitAttempted(true);
    // Touch all outcomes
    setTouched(new Set(outcomes.map((o) => o._key)));
    if (hasErrors) return;
    onSave(
      outcomes.map(({ _key: _k, ...rest }) => rest),
    );
  }, [outcomes, hasErrors, onSave]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Typography variant="h6" fontWeight={600}>
          Configure Outcomes — Step {stepNo}: {stepLabel}
        </Typography>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        {submitAttempted && hasErrors && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Please fix the validation errors below before saving.
          </Alert>
        )}

        {outcomes.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No outcomes configured. Click "Add Outcome" to add one.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600, minWidth: 160 }}>Outcome Name *</TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 140 }}>Type *</TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 140 }}>Next Step</TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 140 }}>Role Override</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">OTP</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Del</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {outcomes.map((outcome) => {
                const isTouched = touched.has(outcome._key);
                const rowErrors = allErrors.find((e) => e.key === outcome._key)?.errs ?? {};

                return (
                  <TableRow key={outcome._key}>
                    {/* Outcome Name */}
                    <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                      <TextField
                        size="small"
                        value={outcome.outcomeName}
                        onChange={(e) => updateOutcome(outcome._key, { outcomeName: e.target.value })}
                        onBlur={() => markTouched(outcome._key)}
                        error={isTouched && Boolean(rowErrors.outcomeName)}
                        helperText={isTouched ? rowErrors.outcomeName : undefined}
                        inputProps={{ maxLength: 100 }}
                        fullWidth
                      />
                    </TableCell>

                    {/* Outcome Type */}
                    <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={outcome.outcomeType}
                          onChange={(e: SelectChangeEvent) =>
                            updateOutcome(outcome._key, {
                              outcomeType: e.target.value as OutcomeDto['outcomeType'],
                            })
                          }
                          onBlur={() => markTouched(outcome._key)}
                        >
                          <MenuItem value="MoveForward">Move Forward</MenuItem>
                          <MenuItem value="Loop">Loop</MenuItem>
                          <MenuItem value="Close">Close</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>

                    {/* Next Step */}
                    <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                      <FormControl
                        size="small"
                        fullWidth
                        disabled={outcome.outcomeType !== 'MoveForward'}
                        error={isTouched && Boolean(rowErrors.nextStepNo)}
                      >
                        <Select
                          value={outcome.nextStepNo !== null ? String(outcome.nextStepNo) : ''}
                          displayEmpty
                          onChange={(e: SelectChangeEvent) =>
                            updateOutcome(outcome._key, {
                              nextStepNo: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          onBlur={() => markTouched(outcome._key)}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {nextStepOptions.map((s) => (
                            <MenuItem key={s.stepNo} value={String(s.stepNo)}>
                              {s.stepNo} — {s.label}
                            </MenuItem>
                          ))}
                        </Select>
                        {isTouched && rowErrors.nextStepNo && (
                          <Typography variant="caption" color="error" sx={{ mt: 0.25, ml: 1.75 }}>
                            {rowErrors.nextStepNo}
                          </Typography>
                        )}
                      </FormControl>
                    </TableCell>

                    {/* Role Override */}
                    <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={outcome.roleOverride ?? ''}
                          displayEmpty
                          onChange={(e: SelectChangeEvent) =>
                            updateOutcome(outcome._key, {
                              roleOverride: e.target.value === '' ? null : e.target.value,
                            })
                          }
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {roles.map((r) => (
                            <MenuItem key={r.code} value={r.code}>
                              {r.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>

                    {/* OTP */}
                    <TableCell align="center" sx={{ verticalAlign: 'top', pt: 1 }}>
                      <Checkbox
                        checked={outcome.requiresOtpVerification}
                        onChange={(e) =>
                          updateOutcome(outcome._key, { requiresOtpVerification: e.target.checked })
                        }
                        size="small"
                        sx={{ color: '#EB6A2C', '&.Mui-checked': { color: '#EB6A2C' } }}
                      />
                    </TableCell>

                    {/* Delete */}
                    <TableCell align="center" sx={{ verticalAlign: 'top', pt: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => removeOutcome(outcome._key)}
                        aria-label="Delete outcome"
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Box sx={{ mt: 2 }}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={addOutcome}
            sx={{ textTransform: 'none', color: '#EB6A2C' }}
          >
            Add Outcome
          </Button>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          sx={{
            bgcolor: '#EB6A2C',
            '&:hover': { bgcolor: '#d45e22' },
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          Save Outcomes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

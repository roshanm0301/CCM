/**
 * SubcategoryModal — MUI Dialog for creating / editing a subcategory.
 * Source: CCM_Phase3_CaseCategory_Master.md
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import type { SubcategoryDto } from './caseCategoryApi';

interface SubcategoryModalProps {
  open: boolean;
  initial: SubcategoryDto | null;
  saving: boolean;
  error: string | null;
  onSave: (data: {
    code: string;
    displayName: string;
    definition: string;
    isActive: boolean;
  }) => void;
  onCancel: () => void;
}

interface FormState {
  code: string;
  displayName: string;
  definition: string;
  isActive: boolean;
}

interface FormErrors {
  code?: string;
  displayName?: string;
  definition?: string;
}

const ALLOWED_TEXT_REGEX = /^[A-Za-z0-9\s&/\-(),.]*$/;
const CODE_REGEX = /^[A-Z0-9_-]*$/;

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
  return errs;
}

export function SubcategoryModal({
  open,
  initial,
  saving,
  error,
  onSave,
  onCancel,
}: SubcategoryModalProps) {
  const [form, setForm] = useState<FormState>({
    code: '',
    displayName: '',
    definition: '',
    isActive: true,
  });
  const [touched, setTouched] = useState<Record<keyof FormErrors, boolean>>({
    code: false,
    displayName: false,
    definition: false,
  });

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              code: initial.code,
              displayName: initial.displayName,
              definition: initial.definition,
              isActive: initial.isActive,
            }
          : { code: '', displayName: '', definition: '', isActive: true },
      );
      setTouched({ code: false, displayName: false, definition: false });
    }
  }, [open, initial]);

  const errors = validate(form);
  const isValid = Object.keys(errors).length === 0;

  function handleSubmit() {
    setTouched({ code: true, displayName: true, definition: true });
    if (!isValid) return;
    onSave(form);
  }

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography fontWeight={600}>{initial ? 'Edit Subcategory' : 'Add Subcategory'}</Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Code */}
          <TextField
            label="Code"
            required
            size="small"
            value={form.code}
            onChange={(e) => {
              setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }));
            }}
            onBlur={() => setTouched((t) => ({ ...t, code: true }))}
            error={touched.code && Boolean(errors.code)}
            helperText={touched.code ? errors.code : 'Uppercase alphanumeric, _ or - only'}
            inputProps={{ maxLength: 30 }}
          />

          {/* Display Name */}
          <TextField
            label="Display Name"
            required
            size="small"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, displayName: true }))}
            error={touched.displayName && Boolean(errors.displayName)}
            helperText={touched.displayName ? errors.displayName : undefined}
            inputProps={{ maxLength: 100 }}
          />

          {/* Definition */}
          <TextField
            label="Definition"
            required
            size="small"
            multiline
            rows={3}
            value={form.definition}
            onChange={(e) => setForm((f) => ({ ...f, definition: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, definition: true }))}
            error={touched.definition && Boolean(errors.definition)}
            helperText={touched.definition ? errors.definition : undefined}
            inputProps={{ maxLength: 500 }}
          />

          {/* Is Active */}
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
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCancel} disabled={saving} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
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
      </DialogActions>
    </Dialog>
  );
}

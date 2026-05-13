/**
 * ActivityMasterDrawer — right-side drawer for creating and editing activities.
 *
 * Behaviour per spec:
 * - On save success: form clears, drawer stays open, onSaved() called
 * - On edit: pre-fills form from fetched record
 * - Cancel: clears form + closes drawer
 *
 * Source: CCM_Phase5_ActivityFlowConfiguration.md § Feature 1
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  Drawer,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import {
  fetchActivities,
  createActivity,
  updateActivity,
  type ActivityMasterDto,
} from './activityMasterApi';

// ---------------------------------------------------------------------------
// Form state & validation
// ---------------------------------------------------------------------------

interface FormState {
  code: string;
  displayName: string;
  description: string;
  isActive: boolean;
}

interface FormErrors {
  code?: string;
  displayName?: string;
}

const EMPTY_FORM: FormState = { code: '', displayName: '', description: '', isActive: true };

function validate(form: FormState): FormErrors {
  const errs: FormErrors = {};
  if (!form.code.trim()) {
    errs.code = 'Code is required.';
  } else if (form.code.length > 30) {
    errs.code = 'Code must be at most 30 characters.';
  }
  if (!form.displayName.trim()) {
    errs.displayName = 'Display Name is required.';
  } else if (form.displayName.length > 150) {
    errs.displayName = 'Display Name must be at most 150 characters.';
  }
  return errs;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActivityMasterDrawerProps {
  open: boolean;
  editId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const DRAWER_WIDTH = 400;

export function ActivityMasterDrawer({ open, editId, onClose, onSaved }: ActivityMasterDrawerProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const errors = validate(form);
  const isEditMode = editId !== null;

  // Load existing record when editId changes
  useEffect(() => {
    if (!editId) {
      setForm(EMPTY_FORM);
      setTouched({});
      setApiError(null);
      return;
    }
    setLoadingEdit(true);
    setApiError(null);
    // Fetch the single record from the list endpoint (no single-GET endpoint needed)
    fetchActivities()
      .then((all) => {
        const found = all.find((a) => a.id === editId);
        if (found) {
          setForm({
            code:        found.code,
            displayName: found.displayName,
            description: found.description,
            isActive:    found.isActive,
          });
        }
      })
      .catch(() => setApiError('Failed to load activity data.'))
      .finally(() => setLoadingEdit(false));
  }, [editId]);

  // Clear form when drawer is closed
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setTouched({});
      setApiError(null);
    }
  }, [open]);

  const handleChange = useCallback(
    (field: keyof FormState, value: string | boolean) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleBlur = useCallback((field: keyof FormState) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleSave = useCallback(async () => {
    // Touch all fields to reveal any errors
    setTouched({ code: true, displayName: true });
    if (Object.keys(validate(form)).length > 0) return;

    setSaving(true);
    setApiError(null);
    try {
      if (isEditMode && editId) {
        await updateActivity(editId, {
          code:        form.code.trim(),
          displayName: form.displayName.trim(),
          description: form.description.trim(),
          isActive:    form.isActive,
        });
      } else {
        await createActivity({
          code:        form.code.trim(),
          displayName: form.displayName.trim(),
          description: form.description.trim(),
          isActive:    form.isActive,
        });
      }
      // Per spec: form clears + drawer stays open; parent refreshes grid
      setForm(EMPTY_FORM);
      setTouched({});
      onSaved();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Save failed. Please try again.';
      setApiError(msg);
    } finally {
      setSaving(false);
    }
  }, [form, isEditMode, editId, onSaved]);

  const handleCancel = useCallback(() => {
    setForm(EMPTY_FORM);
    setTouched({});
    setApiError(null);
    onClose();
  }, [onClose]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleCancel}
      sx={{
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          pt: '64px', // offset below fixed AppBar
          boxSizing: 'border-box',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Drawer header */}
        <Box sx={{ px: 3, py: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            {isEditMode ? 'Edit Activity' : 'Add Activity'}
          </Typography>
        </Box>

        <Divider />

        {/* Form body */}
        <Box sx={{ px: 3, py: 2, flex: 1, overflowY: 'auto' }}>
          {loadingEdit ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {apiError && (
                <Alert severity="error" onClose={() => setApiError(null)}>
                  {apiError}
                </Alert>
              )}

              <TextField
                label="Code"
                required
                fullWidth
                size="small"
                value={form.code}
                onChange={(e) => handleChange('code', e.target.value)}
                onBlur={() => handleBlur('code')}
                error={touched.code === true && Boolean(errors.code)}
                helperText={touched.code === true ? errors.code : undefined}
                inputProps={{ maxLength: 30 }}
              />

              <TextField
                label="Display Name"
                required
                fullWidth
                size="small"
                value={form.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                onBlur={() => handleBlur('displayName')}
                error={touched.displayName === true && Boolean(errors.displayName)}
                helperText={touched.displayName === true ? errors.displayName : undefined}
                inputProps={{ maxLength: 150 }}
              />

              <TextField
                label="Description"
                fullWidth
                size="small"
                multiline
                rows={3}
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                inputProps={{ maxLength: 500 }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.isActive}
                    onChange={(e) => handleChange('isActive', e.target.checked)}
                    sx={{ color: '#EB6A2C', '&.Mui-checked': { color: '#EB6A2C' } }}
                  />
                }
                label="Active"
              />
            </Box>
          )}
        </Box>

        <Divider />

        {/* Action buttons */}
        <Box sx={{ px: 3, py: 2, display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={handleCancel}
            disabled={saving}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || loadingEdit}
            sx={{
              bgcolor: '#EB6A2C',
              '&:hover': { bgcolor: '#d45e22' },
              textTransform: 'none',
              fontWeight: 600,
              minWidth: 80,
            }}
          >
            {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Save'}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}

/**
 * ResolutionActivityForm — current-activity form for the Resolution tab.
 * Allows the assigned-role user to select an outcome, add remarks, optionally
 * attach a file, and save the activity.
 *
 * Source: CCM Phase 6 Resolution Activities spec.
 */

import React, { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import axios from 'axios';
import { apiClient } from '@/shared/api/client';
import { BRAND_COLORS } from '@/shared/theme/colors';
import type { CurrentActivityDto, SaveActivityResult } from './resolutionApi';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ResolutionActivityFormProps {
  caseId: string;
  templateId: string;
  currentActivity: CurrentActivityDto;
  version: number;
  caseStatus: string;
  userRoles: string[];
  onSaved: (result: SaveActivityResult) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const REMARKS_MAX = 500;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResolutionActivityForm({
  caseId,
  templateId,
  currentActivity,
  version,
  caseStatus,
  userRoles,
  onSaved,
}: ResolutionActivityFormProps) {
  const isClosed = caseStatus.includes('Closed');

  // ── Form state ─────────────────────────────────────────────────────────────
  const [selectedOutcome, setSelectedOutcome] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // ── Async state ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Validation state ───────────────────────────────────────────────────────
  const [touched, setTouched] = useState({ outcome: false, remarks: false });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const outcomeError = touched.outcome && !selectedOutcome ? 'Please select an outcome.' : '';
  const remarksError =
    touched.remarks && remarks.trim().length === 0
      ? 'Remarks are required.'
      : touched.remarks && remarks.length > REMARKS_MAX
      ? `Max ${REMARKS_MAX} characters.`
      : '';

  const isFormValid = selectedOutcome !== '' && remarks.trim().length > 0 && remarks.length <= REMARKS_MAX && !fileError;

  // ── File handler ───────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFileError(null);
    setFile(null);
    setFileBase64(null);

    if (!selected) return;

    if (selected.size > MAX_FILE_BYTES) {
      setFileError('File exceeds 5 MB limit.');
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix ("data:...;base64,")
      const base64 = result.split(',')[1] ?? result;
      setFile(selected);
      setFileBase64(base64);
    };
    reader.readAsDataURL(selected);
  }

  // ── Save handler ───────────────────────────────────────────────────────────
  async function handleSave() {
    setTouched({ outcome: true, remarks: true });
    if (!isFormValid) return;

    setSaving(true);
    setSaveError(null);

    try {
      // Step 1: upload attachment if present
      let uploadedAttachmentId: string | undefined;
      if (file && fileBase64) {
        const attachRes = await apiClient.post<{ success: boolean; data: { id: string } }>(
          '/api/v1/attachments',
          {
            caseId,
            stepNo: currentActivity.stepNo,
            filename: file.name,
            contentType: file.type,
            base64Content: fileBase64,
          },
          { timeout: 120_000 }, // 2-minute timeout for base64 file uploads
        );
        uploadedAttachmentId = attachRes.data.data.id;
      }

      // Step 2: resolve outcomeType
      const outcomeObj = currentActivity.outcomes.find((o) => o.outcomeName === selectedOutcome);
      const outcomeType = outcomeObj?.outcomeType ?? '';

      // Step 3: save activity
      const saveRes = await apiClient.post<{ success: boolean; data: SaveActivityResult }>(
        '/api/v1/resolution-activities',
        {
          caseId,
          templateId,
          stepNo: currentActivity.stepNo,
          activityId: currentActivity.activityId,
          outcomeName: selectedOutcome,
          outcomeType,
          remarks,
          attachmentId: uploadedAttachmentId,
          version,
        },
      );

      // ── Reset form ────────────────────────────────────────────────────────
      setSelectedOutcome('');
      setRemarks('');
      setFile(null);
      setFileBase64(null);
      setFileError(null);
      setTouched({ outcome: false, remarks: false });
      if (fileInputRef.current) fileInputRef.current.value = '';

      onSaved(saveRes.data.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const apiMessage = (err.response?.data as { message?: string } | undefined)?.message;

        if (status === 409) {
          setSaveError('Data has changed. Please refresh and try again.');
        } else if (status === 422) {
          setSaveError(apiMessage ?? 'Validation error. Please check your inputs.');
        } else {
          setSaveError('Failed to save. Please try again.');
        }
      } else {
        setSaveError('Failed to save. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Paper variant="outlined" sx={{ p: 2, position: 'relative', overflow: 'hidden' }}>
      {/* Saving progress bar */}
      {saving && (
        <LinearProgress
          sx={{ position: 'absolute', top: 0, left: 0, right: 0 }}
          aria-label="Saving activity"
        />
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Step {currentActivity.stepNo}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Assigned Role: {currentActivity.assignedRole}
        </Typography>
        {isClosed && (
          <Chip label="Closed" size="small" color="default" sx={{ ml: 'auto' }} />
        )}
      </Box>

      {/* Closed alert */}
      {isClosed && (
        <Alert severity="info" sx={{ mb: 1.5 }} >
          This case is closed. No further activity can be submitted.
        </Alert>
      )}

      {/* Save error */}
      {saveError && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}

      {/* Outcome select */}
      <FormControl
        fullWidth
        size="small"
        error={Boolean(outcomeError)}
        disabled={isClosed || saving}
        sx={{ mb: 1.5 }}
      >
        <InputLabel id="outcome-label">Outcome *</InputLabel>
        <Select
          labelId="outcome-label"
          label="Outcome *"
          value={selectedOutcome}
          onChange={(e: SelectChangeEvent) => {
            setSelectedOutcome(e.target.value);
            setTouched((t) => ({ ...t, outcome: true }));
          }}
          aria-label="Select outcome"
        >
          {currentActivity.outcomes.map((o) => (
            <MenuItem key={o.outcomeName} value={o.outcomeName}>
              {o.outcomeName}
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ ml: 1 }}
              >
                ({o.outcomeType})
              </Typography>
            </MenuItem>
          ))}
        </Select>
        {outcomeError && <FormHelperText>{outcomeError}</FormHelperText>}
      </FormControl>

      {/* Remarks */}
      <TextField
        fullWidth
        size="small"
        multiline
        minRows={3}
        label="Remarks *"
        value={remarks}
        disabled={isClosed || saving}
        onChange={(e) => {
          setRemarks(e.target.value);
          setTouched((t) => ({ ...t, remarks: true }));
        }}
        onBlur={() => setTouched((t) => ({ ...t, remarks: true }))}
        error={Boolean(remarksError)}
        helperText={
          remarksError
            ? remarksError
            : `${remarks.length}/${REMARKS_MAX}`
        }
        inputProps={{ maxLength: REMARKS_MAX + 10, 'aria-label': 'Remarks' }}
        sx={{ mb: 1.5 }}
      />

      {/* Attachment */}
      <Box sx={{ mb: 2 }}>
        <input
          ref={fileInputRef}
          id="resolution-file-input"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: 'none' }}
          disabled={isClosed || saving}
          onChange={handleFileChange}
          aria-label="Attach file"
        />
        <Button
          component="label"
          htmlFor="resolution-file-input"
          variant="outlined"
          size="small"
          startIcon={<AttachFileIcon />}
          disabled={isClosed || saving}
          sx={{ textTransform: 'none' }}
          aria-label="Choose attachment"
        >
          {file ? 'Change file' : 'Attach file'}
        </Button>

        {file && (
          <Typography variant="caption" sx={{ ml: 1.5, color: 'text.secondary' }}>
            {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </Typography>
        )}
        {fileError && (
          <Typography variant="caption" color="error" sx={{ ml: 1.5, display: 'block', mt: 0.5 }}>
            {fileError}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          PDF, JPG, JPEG or PNG — max 5 MB
        </Typography>
      </Box>

      {/* Save button */}
      <Button
        variant="contained"
        size="small"
        disabled={isClosed || saving}
        onClick={() => void handleSave()}
        aria-label="Save activity"
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          bgcolor: BRAND_COLORS.orange,
          '&:hover': { bgcolor: '#c9581e' },
          '&.Mui-disabled': { opacity: 0.6 },
        }}
        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
      >
        {saving ? 'Saving…' : 'Save Activity'}
      </Button>
    </Paper>
  );
}

/**
 * WrapupForm — Screen 6 disposition form.
 *
 * Fields: Contact Reason, Identification Outcome, Interaction Disposition, Remarks.
 * Master data loaded from /api/v1/master-data/:type.
 * Conditional mandatory remarks when disposition is in required list.
 * Character counter on remarks (X / 1000).
 * After save: shows Close Interaction + Mark Incomplete buttons.
 *
 * Source: ux-specification.md Screen 6, phase1-technical-blueprint §5.9–5.11
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormHelperText,
  Grid2 as Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  type SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material';
import { apiClient } from '@/shared/api/client';
import { useInteractionStore } from '@/features/interaction/interactionStore';
import { useCtiStore } from '@/features/cti/ctiStore';
import { InteractionStatus } from '@ccm/types';
import { CtiCallRecording } from '@/features/cti/CtiCallRecording';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReferenceValueItem {
  code: string;
  label: string;
  sortOrder: number;
  remarksRequired?: boolean;
}

interface MasterDataResponse {
  success: true;
  data: {
    type: string;
    items: ReferenceValueItem[];
  };
}

interface WrapupApiResponse {
  success: true;
  data: {
    interactionId: string;
    status: InteractionStatus;
    wrapup: {
      contactReasonCode: string;
      identificationOutcomeCode: string;
      interactionDispositionCode: string;
      remarks: string | null;
    };
  };
}


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WrapupFormProps {
  onInteractionClosed: (outcome: 'CLOSED' | 'INCOMPLETE') => void;
}

export function WrapupForm({ onInteractionClosed }: WrapupFormProps) {
  const { interactionId, setSavedWrapup, setStatus, setWrapupPending } = useInteractionStore();
  const channel = useInteractionStore((s) => s.channel);

  // Master data
  const [contactReasons, setContactReasons] = useState<ReferenceValueItem[]>([]);
  const [idOutcomes, setIdOutcomes] = useState<ReferenceValueItem[]>([]);
  const [dispositions, setDispositions] = useState<ReferenceValueItem[]>([]);
  const [masterDataLoading, setMasterDataLoading] = useState(true);
  const [masterDataError, setMasterDataError] = useState('');

  // Form state
  const [contactReason, setContactReason] = useState('');
  const [idOutcome, setIdOutcome] = useState('');
  const [disposition, setDisposition] = useState('');
  const [remarks, setRemarks] = useState('');

  // Validation errors
  const [contactReasonError, setContactReasonError] = useState('');
  const [idOutcomeError, setIdOutcomeError] = useState('');
  const [dispositionError, setDispositionError] = useState('');
  const [remarksError, setRemarksError] = useState('');

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  // Close/incomplete state
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');

  // Accessibility
  const [remarksAnnouncement, setRemarksAnnouncement] = useState('');
  const postSaveRef = useRef<HTMLDivElement>(null);
  const contactReasonRef = useRef<HTMLDivElement>(null);

  // Derive whether remarks are required from the selected disposition item returned
  // by the master-data API. The API returns remarksRequired as a top-level boolean
  // field on each disposition item. Defaults to false while master data is loading
  // so the user is never blocked before options arrive.
  // Source: phase1-technical-blueprint §5.9
  const selectedDisposition = dispositions.find((d) => d.code === disposition);
  const remarksRequired = selectedDisposition?.remarksRequired === true;

  // Load master data
  useEffect(() => {
    async function loadMasterData() {
      setMasterDataLoading(true);
      setMasterDataError('');

      try {
        const [crRes, ioRes, dispRes] = await Promise.all([
          apiClient.get<MasterDataResponse>('/api/v1/master-data/contact-reasons'),
          apiClient.get<MasterDataResponse>('/api/v1/master-data/identification-outcomes'),
          apiClient.get<MasterDataResponse>('/api/v1/master-data/interaction-dispositions'),
        ]);

        setContactReasons(crRes.data.data.items);
        setIdOutcomes(ioRes.data.data.items);
        setDispositions(dispRes.data.data.items);
      } catch {
        setMasterDataError(
          'Unable to load form options. Please refresh and try again.',
        );
      } finally {
        setMasterDataLoading(false);
      }
    }

    loadMasterData();
  }, []);

  // Announce remarks required change to screen readers
  useEffect(() => {
    if (remarksRequired) {
      setRemarksAnnouncement('Remarks are now required for the selected disposition.');
    } else {
      setRemarksAnnouncement('');
    }
  }, [remarksRequired]);

  function handleDispositionChange(e: SelectChangeEvent<string>) {
    const newValue = e.target.value;
    setDisposition(newValue);
    if (dispositionError) setDispositionError('');
    // Clear remarks error if the newly selected disposition does not require remarks
    const newSelection = dispositions.find((d) => d.code === newValue);
    if (newSelection?.remarksRequired !== true) {
      setRemarksError('');
    }
  }

  const handleSave = useCallback(async () => {
    if (!interactionId) return;

    // Validate
    let firstErrorRef: React.RefObject<HTMLDivElement | null> | null = null;
    let hasError = false;

    if (!contactReason) {
      setContactReasonError('Select Contact Reason.');
      hasError = true;
      if (!firstErrorRef) firstErrorRef = contactReasonRef as React.RefObject<HTMLDivElement | null>;
    }
    if (!idOutcome) {
      setIdOutcomeError('Select Identification Outcome.');
      hasError = true;
    }
    if (!disposition) {
      setDispositionError('Select Interaction Disposition.');
      hasError = true;
    }
    if (remarksRequired && !remarks.trim()) {
      setRemarksError('Enter remarks for the selected disposition.');
      hasError = true;
    }

    if (hasError) {
      // Focus first failing field
      (firstErrorRef?.current?.querySelector('input, select, textarea') as HTMLElement | null)?.focus();
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      const res = await apiClient.patch<WrapupApiResponse>(
        `/api/v1/interactions/${interactionId}/wrapup`,
        {
          contactReasonCode: contactReason,
          identificationOutcomeCode: idOutcome,
          interactionDispositionCode: disposition,
          remarks: remarks.trim() || null,
        },
      );

      const wrapupData = res.data.data.wrapup;
      setSavedWrapup({
        contactReasonCode: wrapupData.contactReasonCode,
        identificationOutcomeCode: wrapupData.identificationOutcomeCode,
        interactionDispositionCode: wrapupData.interactionDispositionCode,
        remarks: wrapupData.remarks,
      });
      setStatus(res.data.data.status);
      // Release the navigation lock — agent has completed wrapup
      setWrapupPending(false);
      setSaved(true);

      // Focus post-save area for accessibility
      setTimeout(() => {
        postSaveRef.current?.focus();
      }, 100);
    } catch {
      setSaveError('Unable to save interaction wrap-up. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    interactionId,
    contactReason,
    idOutcome,
    disposition,
    remarks,
    remarksRequired,
    setSavedWrapup,
    setStatus,
    setWrapupPending,
  ]);

  async function handleClose() {
    if (!interactionId) return;
    setClosing(true);
    setCloseError('');

    try {
      await apiClient.post(`/api/v1/interactions/${interactionId}/close`);
      // Reset CTI call state to 'idle' so the Make-a-Call button and mode toggle
      // are re-enabled for the next call.  callControls are preserved (clearCallState
      // intentionally does not clear them) so Answer/Decline still work.
      useCtiStore.getState().clearCallState();
      onInteractionClosed('CLOSED');
    } catch {
      setCloseError('Unable to close interaction. Please try again.');
      setClosing(false);
    }
  }

  async function handleMarkIncomplete() {
    if (!interactionId) return;
    setClosing(true);
    setCloseError('');

    try {
      await apiClient.post(`/api/v1/interactions/${interactionId}/incomplete`);
      // Reset CTI call state to 'idle' — same reason as handleClose above.
      useCtiStore.getState().clearCallState();
      onInteractionClosed('INCOMPLETE');
    } catch {
      setCloseError('Unable to mark interaction as incomplete. Please try again.');
      setClosing(false);
    }
  }

  if (masterDataLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress aria-label="Loading form options" />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Loading form…
        </Typography>
      </Box>
    );
  }

  if (masterDataError) {
    return (
      <Alert severity="error" role="alert" sx={{ m: 2 }}>
        {masterDataError}
      </Alert>
    );
  }

  return (
    <Box
      component="section"
      aria-label="Interaction wrap-up"
      sx={{ p: { xs: 2, md: 3 } }}
    >
      {/* Accessibility announcement region */}
      <Box
        aria-live="polite"
        aria-atomic="true"
        sx={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}
      >
        {remarksAnnouncement}
      </Box>

      <Card
        elevation={0}
        variant="outlined"
        sx={{ borderRadius: 2, maxWidth: { md: 600, lg: 640 }, mx: 'auto' }}
      >
        {saving && <LinearProgress aria-label="Saving wrap-up" sx={{ height: 3 }} />}
        <CardContent
          component="form"
          aria-label="Interaction wrap-up"
          sx={{ p: { xs: 2, md: 3 } }}
        >
          {/* Call recording player — only shown for inbound_call interactions */}
          {interactionId && channel === 'inbound_call' && (
            <Box sx={{ mb: 3 }}>
              <CtiCallRecording interactionId={interactionId} channel={channel} />
            </Box>
          )}

          <Typography variant="h3" component="h2" color="text.primary" sx={{ mb: 3 }}>
            Wrap-up
          </Typography>

          <Grid container spacing={2}>
            {/* Contact Reason + Identification Outcome on one row at lg */}
            <Grid size={{ xs: 12, lg: 6 }}>
              <FormControl
                fullWidth
                size="small"
                error={Boolean(contactReasonError)}
                ref={contactReasonRef}
              >
                <InputLabel id="contact-reason-label" required>
                  Contact Reason
                </InputLabel>
                <Select
                  id="contact-reason"
                  labelId="contact-reason-label"
                  value={contactReason}
                  label="Contact Reason"
                  onChange={(e) => {
                    setContactReason(e.target.value);
                    if (contactReasonError) setContactReasonError('');
                  }}
                  aria-required="true"
                  disabled={saving || saved}
                  inputProps={{
                    'aria-describedby': contactReasonError ? 'contact-reason-error' : undefined,
                  }}
                >
                  <MenuItem value="">
                    <em>Select</em>
                  </MenuItem>
                  {contactReasons.map((item) => (
                    <MenuItem key={item.code} value={item.code}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
                {contactReasonError && (
                  <FormHelperText id="contact-reason-error" role="alert">
                    {contactReasonError}
                  </FormHelperText>
                )}
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, lg: 6 }}>
              <FormControl fullWidth size="small" error={Boolean(idOutcomeError)}>
                <InputLabel id="id-outcome-label" required>
                  Identification Outcome
                </InputLabel>
                <Select
                  id="identification-outcome"
                  labelId="id-outcome-label"
                  value={idOutcome}
                  label="Identification Outcome"
                  onChange={(e) => {
                    setIdOutcome(e.target.value);
                    if (idOutcomeError) setIdOutcomeError('');
                  }}
                  aria-required="true"
                  disabled={saving || saved}
                  inputProps={{
                    'aria-describedby': idOutcomeError ? 'id-outcome-error' : undefined,
                  }}
                >
                  <MenuItem value="">
                    <em>Select</em>
                  </MenuItem>
                  {idOutcomes.map((item) => (
                    <MenuItem key={item.code} value={item.code}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
                {idOutcomeError && (
                  <FormHelperText id="id-outcome-error" role="alert">
                    {idOutcomeError}
                  </FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* Interaction Disposition — full width */}
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth size="small" error={Boolean(dispositionError)}>
                <InputLabel id="disposition-label" required>
                  Interaction Disposition
                </InputLabel>
                <Select
                  id="interaction-disposition"
                  labelId="disposition-label"
                  value={disposition}
                  label="Interaction Disposition"
                  onChange={handleDispositionChange}
                  aria-required="true"
                  disabled={saving || saved}
                  inputProps={{
                    'aria-describedby': dispositionError ? 'disposition-error' : undefined,
                  }}
                >
                  <MenuItem value="">
                    <em>Select</em>
                  </MenuItem>
                  {dispositions.map((item) => (
                    <MenuItem key={item.code} value={item.code}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
                {dispositionError && (
                  <FormHelperText id="disposition-error" role="alert">
                    {dispositionError}
                  </FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* Remarks */}
            <Grid size={{ xs: 12 }}>
              <TextField
                id="remarks"
                label={
                  <Box component="span">
                    Remarks
                    {remarksRequired && (
                      <Box
                        component="span"
                        sx={{ color: 'error.main', ml: 0.5 }}
                        aria-hidden="true"
                      >
                        *
                      </Box>
                    )}
                  </Box>
                }
                multiline
                rows={4}
                fullWidth
                value={remarks}
                onChange={(e) => {
                  setRemarks(e.target.value);
                  if (remarksError) setRemarksError('');
                }}
                error={Boolean(remarksError)}
                helperText={
                  remarksError
                    ? remarksError
                    : `${remarks.length} / 1000`
                }
                inputProps={{
                  maxLength: 1000,
                  'aria-required': remarksRequired,
                  'aria-describedby': remarksError ? 'remarks-error' : 'remarks-counter',
                }}
                FormHelperTextProps={{
                  id: remarksError ? 'remarks-error' : 'remarks-counter',
                  role: remarksError ? 'alert' : undefined,
                  sx: { textAlign: 'right' },
                  'aria-live': 'off',
                }}
                disabled={saving || saved}
                sx={{
                  '& .MuiOutlinedInput-root': remarksRequired && !remarksError
                    ? { '& fieldset': { borderColor: 'warning.main' } }
                    : {},
                }}
              />
            </Grid>
          </Grid>

          {/* Save error */}
          {saveError && (
            <Alert severity="error" role="alert" sx={{ mt: 2 }}>
              {saveError}
            </Alert>
          )}

          {/* Save button */}
          {!saved && (
            <Button
              id="save-wrapup-btn"
              variant="contained"
              color="primary"
              size="large"
              onClick={handleSave}
              disabled={saving}
              sx={{ mt: 3, width: { xs: '100%', md: 'auto' } }}
              aria-label="Save wrap-up"
            >
              {saving ? 'Saving…' : 'Save Wrap-up'}
            </Button>
          )}

          {/* Post-save area */}
          {saved && (
            <Box
              ref={postSaveRef}
              tabIndex={-1}
              aria-live="polite"
              aria-atomic="true"
              sx={{ mt: 3 }}
            >
              <Alert severity="success" sx={{ mb: 2 }}>
                {disposition === 'incomplete_interaction'
                  ? 'Wrap-up saved. Mark the interaction as incomplete to continue.'
                  : 'Wrap-up saved. You can now close the interaction.'}
              </Alert>

              {closeError && (
                <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                  {closeError}
                </Alert>
              )}

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 2,
                }}
              >
                {disposition === 'incomplete_interaction' ? (
                  <Button
                    id="mark-incomplete-btn"
                    variant="contained"
                    color="secondary"
                    size="medium"
                    onClick={handleMarkIncomplete}
                    disabled={closing}
                    aria-label="Mark this interaction as incomplete"
                    sx={{ width: { xs: '100%', md: 'auto' } }}
                  >
                    {closing ? 'Saving…' : 'Mark Incomplete'}
                  </Button>
                ) : (
                  <Button
                    id="close-interaction-btn"
                    variant="contained"
                    color="primary"
                    size="medium"
                    onClick={handleClose}
                    disabled={closing}
                    aria-label="Close this interaction"
                    sx={{ width: { xs: '100%', md: 'auto' } }}
                  >
                    {closing ? 'Closing…' : 'Close Interaction'}
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

/**
 * FollowUpTab — displays follow-up history and allows agents to add new
 * immutable follow-up entries for a case.
 *
 * Source: CCM Phase 6 Resolution Activities spec.
 */

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Skeleton,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import Link from '@mui/material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import type { FollowUpDto, AddFollowUpPayload } from '@/features/follow-up/followUpApi';
import { formatDateTime } from '@/shared/utils/dateFormatter';
import { BRAND_COLORS } from '@/shared/theme/colors';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FollowUpTabProps {
  caseId: string;
  caseStatus: string;
  userRoles: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REMARKS_MAX = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchFollowUps(caseId: string): Promise<FollowUpDto[]> {
  const res = await apiClient.get<{ success: boolean; data: FollowUpDto[] }>(
    '/api/v1/follow-ups',
    { params: { caseId } },
  );
  return res.data.data;
}

async function postFollowUp(payload: AddFollowUpPayload): Promise<FollowUpDto> {
  const res = await apiClient.post<{ success: boolean; data: FollowUpDto }>(
    '/api/v1/follow-ups',
    payload,
  );
  return res.data.data;
}

// ---------------------------------------------------------------------------
// FollowUpEntry sub-component
// ---------------------------------------------------------------------------

function FollowUpEntry({ entry, isLast }: { entry: FollowUpDto; isLast: boolean }) {
  return (
    <>
      <Box sx={{ py: 1.5 }}>
        {/* Header row: agent + timestamp */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
          <Typography variant="body2" fontWeight={600}>
            {entry.agentName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDateTime(entry.createdAt)}
          </Typography>
        </Box>

        {/* Customer remarks */}
        <Box sx={{ mb: 0.75 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
            Customer Remarks
          </Typography>
          <Typography variant="body2">
            {entry.customerRemarks || <em style={{ color: '#9e9e9e' }}>—</em>}
          </Typography>
        </Box>

        {/* Agent remarks */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
            Agent Remarks
          </Typography>
          <Typography variant="body2">
            {entry.agentRemarks || <em style={{ color: '#9e9e9e' }}>—</em>}
          </Typography>
        </Box>

        {entry.callRecordingLink && /^https?:\/\//i.test(entry.callRecordingLink) && (
          <Box sx={{ mt: 0.75 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.25 }}
            >
              Call Recording Link
            </Typography>
            <Link
              href={entry.callRecordingLink}
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              underline="hover"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              View Recording
              <OpenInNewIcon sx={{ fontSize: 14 }} aria-hidden="true" />
            </Link>
          </Box>
        )}
      </Box>
      {!isLast && <Divider />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FollowUpTab({ caseId, caseStatus, userRoles }: FollowUpTabProps) {
  const queryClient = useQueryClient();

  const isClosed = caseStatus.includes('Closed');
  const canAddFollowUp =
    (userRoles.includes('agent') || userRoles.includes('ccm_agent')) && !isClosed;

  // ── Inline form state ──────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [customerRemarks, setCustomerRemarks] = useState('');
  const [agentRemarks, setAgentRemarks] = useState('');
  const [touched, setTouched] = useState({ customer: false, agent: false });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: history, isLoading, isError } = useQuery<FollowUpDto[]>({
    queryKey: ['followUps', caseId],
    queryFn: () => fetchFollowUps(caseId),
    enabled: Boolean(caseId),
  });

  // ── Mutation ───────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: postFollowUp,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['followUps', caseId] });
      collapseForm();
      setSuccessOpen(true);
    },
    onError: () => {
      setSaveError('Failed to save follow-up. Please try again.');
    },
  });

  // ── Derived validation ─────────────────────────────────────────────────────
  const customerError =
    touched.customer && customerRemarks.trim().length === 0
      ? 'Customer remarks are required.'
      : touched.customer && customerRemarks.length > REMARKS_MAX
      ? `Max ${REMARKS_MAX} characters.`
      : '';

  const agentError =
    touched.agent && agentRemarks.trim().length === 0
      ? 'Agent remarks are required.'
      : touched.agent && agentRemarks.length > REMARKS_MAX
      ? `Max ${REMARKS_MAX} characters.`
      : '';

  const isFormValid =
    customerRemarks.trim().length > 0 &&
    customerRemarks.length <= REMARKS_MAX &&
    agentRemarks.trim().length > 0 &&
    agentRemarks.length <= REMARKS_MAX;

  // ── Handlers ───────────────────────────────────────────────────────────────
  function collapseForm() {
    setFormOpen(false);
    setCustomerRemarks('');
    setAgentRemarks('');
    setTouched({ customer: false, agent: false });
    setSaveError(null);
  }

  function handleSave() {
    setTouched({ customer: true, agent: true });
    if (!isFormValid) return;
    setSaveError(null);
    mutation.mutate({ caseId, customerRemarks: customerRemarks.trim(), agentRemarks: agentRemarks.trim() });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Add Follow Up button / closed notice */}
      {isClosed ? (
        <Alert severity="info" icon={false}>
          <Chip label="Info" size="small" sx={{ mr: 1 }} />
          Follow-up creation is disabled for closed cases.
        </Alert>
      ) : canAddFollowUp ? (
        <Box>
          {!formOpen && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setFormOpen(true)}
              aria-label="Add follow up"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Add Follow Up
            </Button>
          )}

          {/* Inline form */}
          {formOpen && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                New Follow Up
              </Typography>

              {saveError && (
                <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setSaveError(null)}>
                  {saveError}
                </Alert>
              )}

              <TextField
                fullWidth
                size="small"
                multiline
                minRows={2}
                label="Customer Remarks *"
                value={customerRemarks}
                onChange={(e) => {
                  setCustomerRemarks(e.target.value);
                  setTouched((t) => ({ ...t, customer: true }));
                }}
                onBlur={() => setTouched((t) => ({ ...t, customer: true }))}
                error={Boolean(customerError)}
                helperText={customerError || `${customerRemarks.length}/${REMARKS_MAX}`}
                inputProps={{ maxLength: REMARKS_MAX + 10, 'aria-label': 'Customer remarks' }}
                disabled={mutation.isPending}
                sx={{ mb: 1.5 }}
              />

              <TextField
                fullWidth
                size="small"
                multiline
                minRows={2}
                label="Agent Remarks *"
                value={agentRemarks}
                onChange={(e) => {
                  setAgentRemarks(e.target.value);
                  setTouched((t) => ({ ...t, agent: true }));
                }}
                onBlur={() => setTouched((t) => ({ ...t, agent: true }))}
                error={Boolean(agentError)}
                helperText={agentError || `${agentRemarks.length}/${REMARKS_MAX}`}
                inputProps={{ maxLength: REMARKS_MAX + 10, 'aria-label': 'Agent remarks' }}
                disabled={mutation.isPending}
                sx={{ mb: 1.5 }}
              />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={mutation.isPending || !isFormValid}
                  onClick={handleSave}
                  aria-label="Save follow up"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    bgcolor: BRAND_COLORS.orange,
                    '&:hover': { bgcolor: '#c9581e' },
                  }}
                  startIcon={mutation.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
                >
                  {mutation.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  variant="text"
                  size="small"
                  disabled={mutation.isPending}
                  onClick={collapseForm}
                  aria-label="Cancel follow up"
                  sx={{ textTransform: 'none' }}
                >
                  Cancel
                </Button>
              </Box>
            </Paper>
          )}
        </Box>
      ) : null}

      {/* History list */}
      <Paper variant="outlined">
        <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Follow-Up History
          </Typography>
        </Box>

        {isLoading && (
          <Box sx={{ p: 2 }}>
            <Skeleton variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
          </Box>
        )}

        {isError && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">Failed to load follow-up history.</Alert>
          </Box>
        )}

        {!isLoading && !isError && (!history || history.length === 0) && (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No follow-ups have been added yet.
            </Typography>
          </Box>
        )}

        {!isLoading && !isError && history && history.length > 0 && (
          <Box sx={{ px: 2 }}>
            {[...history]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((entry, idx, arr) => (
                <FollowUpEntry key={entry.id} entry={entry} isLast={idx === arr.length - 1} />
              ))}
          </Box>
        )}
      </Paper>

      {/* Success snackbar */}
      <Snackbar
        open={successOpen}
        autoHideDuration={3000}
        onClose={() => setSuccessOpen(false)}
        message="Follow-up saved successfully."
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

/**
 * CaseSuccessModal — shown immediately after successful case registration.
 * Agent must explicitly dismiss via "Close" or navigate via "View Case".
 * Backdrop clicks and Escape key do not close the modal.
 * On close: CaseWorkspace calls loadHistory() to populate the history grid.
 */
import React from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Typography,
  Box,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '@/shared/utils/dateFormatter';
import type { CaseDto } from './casesApi';

interface CaseSuccessModalProps {
  open: boolean;
  registeredCase: CaseDto;
  onClose: () => void;
}

export function CaseSuccessModal({ open, registeredCase, onClose }: CaseSuccessModalProps) {
  const navigate = useNavigate();

  function handleViewCase() {
    navigate(`/cases/${registeredCase.caseId}`);
    onClose();
  }

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      aria-labelledby="case-success-dialog-title"
      aria-describedby="case-success-dialog-desc"
      onClose={(_event, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        onClose();
      }}
    >
      <DialogTitle
        id="case-success-dialog-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'success.light',
          pb: 1.5,
          borderBottom: '1px solid',
          borderColor: 'success.200',
        }}
      >
        <CheckCircleOutlineIcon color="success" fontSize="small" />
        <Typography component="span" fontWeight={600} color="success.dark" variant="subtitle1">
          Case Registered Successfully
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        <Typography
          id="case-success-dialog-desc"
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2 }}
        >
          Your case has been created. The details are shown below.
        </Typography>

        <Grid container spacing={2}>
          {/* Case ID */}
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary" fontWeight={500} display="block" sx={{ mb: 0.25 }}>
              Case ID
            </Typography>
            <Typography variant="body2" fontWeight={600} fontFamily="monospace" color="text.primary">
              {registeredCase.caseId}
            </Typography>
          </Grid>

          {/* Case Nature */}
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary" fontWeight={500} display="block" sx={{ mb: 0.25 }}>
              Case Nature
            </Typography>
            <Typography variant="body2" fontWeight={500} color="text.primary">
              {registeredCase.caseNature}
            </Typography>
          </Grid>

          {/* Status */}
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary" fontWeight={500} display="block" sx={{ mb: 0.5 }}>
              Status
            </Typography>
            <Chip label={registeredCase.caseStatus} size="small" color="success" />
          </Grid>

          {/* Registered At */}
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary" fontWeight={500} display="block" sx={{ mb: 0.25 }}>
              Registered At
            </Typography>
            <Typography variant="body2" fontWeight={500} color="text.primary">
              {formatDateTime(registeredCase.registeredAt)}
            </Typography>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1, gap: 1, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          onClick={onClose}
        >
          Close
        </Button>
        <Button
          variant="contained"
          color="success"
          size="small"
          endIcon={<OpenInNewIcon fontSize="small" />}
          onClick={handleViewCase}
          autoFocus
          aria-label={`View case ${registeredCase.caseId}`}
        >
          View Case
        </Button>
      </DialogActions>
    </Dialog>
  );
}

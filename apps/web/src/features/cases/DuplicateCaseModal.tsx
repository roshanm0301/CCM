/**
 * DuplicateCaseModal — alerts agent when an open duplicate case is found.
 * Source: CCM Phase 4 Case Creation Workspace spec.
 */

import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DuplicateCaseModalProps {
  open: boolean;
  existingCase: {
    caseId: string;
    caseNature: string;
    documentStatus: string;
    registeredAt: string;
  };
  onViewExisting: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DuplicateCaseModal({
  open,
  existingCase,
  onViewExisting,
  onCancel,
}: DuplicateCaseModalProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: 'warning.dark',
          pb: 1,
        }}
      >
        <WarningAmberIcon color="warning" />
        Open Case Found
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A case with the same Case Nature, Department, Category and Subcategory is already open
          for this customer and vehicle.
        </Typography>

        <Box
          sx={{
            bgcolor: 'grey.50',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
          }}
        >
          <DetailRow label="Registered Date & Time" value={formatDateTime(existingCase.registeredAt)} />
          <DetailRow label="Case Nature" value={existingCase.caseNature} />
          <DetailRow label="Document Name" value={existingCase.caseId} />
          <DetailRow label="Document Status" value={existingCase.documentStatus} />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" color="warning" onClick={onViewExisting}>
          View Existing Case
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Internal helper component
// ---------------------------------------------------------------------------

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        mb: 0.75,
        alignItems: 'flex-start',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.primary">
        {value}
      </Typography>
    </Box>
  );
}

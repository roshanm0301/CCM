/**
 * ActivityTemplateList — catalog table for Activity Template master.
 * Source: CCM_Phase5_ActivityFlowConfiguration.md § Feature 3
 */

import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import type { ActivityTemplateSummaryDto } from './activityTemplateApi';

interface ActivityTemplateListProps {
  templates: ActivityTemplateSummaryDto[];
  loading: boolean;
  error: string | null;
  onNew: () => void;
  onEdit: (id: string) => void;
}

export function ActivityTemplateList({
  templates,
  loading,
  error,
  onNew,
  onEdit,
}: ActivityTemplateListProps) {
  return (
    <Box>
      {/* Header row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography variant="h6" fontWeight={600} color="text.primary">
          Activity Flow Templates
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onNew}
          sx={{
            bgcolor: '#EB6A2C',
            '&:hover': { bgcolor: '#d45e22' },
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          New Activity Template
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box>
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} height={52} sx={{ mb: 0.5 }} />
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600 }}>Template Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Applies To</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Department</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Product Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      No activity templates found. Click "New Activity Template" to create one.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((tpl) => (
                  <TableRow key={tpl.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {tpl.templateName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{tpl.appliesTo}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{tpl.department}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{tpl.productType}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={tpl.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={tpl.isActive ? 'success' : 'default'}
                        variant={tpl.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        startIcon={<EditIcon fontSize="small" />}
                        onClick={() => onEdit(tpl.id)}
                        sx={{
                          textTransform: 'none',
                          color: '#EB6A2C',
                          '&:hover': { bgcolor: 'rgba(235,106,44,0.08)' },
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

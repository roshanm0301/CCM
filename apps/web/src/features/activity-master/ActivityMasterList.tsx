/**
 * ActivityMasterList — catalog table for Activity Master.
 * Source: CCM_Phase5_ActivityFlowConfiguration.md § Feature 2
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
import type { ActivityMasterDto } from './activityMasterApi';

interface ActivityMasterListProps {
  activities: ActivityMasterDto[];
  loading: boolean;
  error: string | null;
  onNew: () => void;
  onEdit: (id: string) => void;
}

export function ActivityMasterList({
  activities,
  loading,
  error,
  onNew,
  onEdit,
}: ActivityMasterListProps) {
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
          Activity Master
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
          Add Activity
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
                <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Display Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      No activities found. Click "Add Activity" to create one.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                activities.map((activity) => (
                  <TableRow key={activity.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {activity.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {activity.displayName}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={activity.description}
                      >
                        {activity.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={activity.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={activity.isActive ? 'success' : 'default'}
                        variant={activity.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        startIcon={<EditIcon fontSize="small" />}
                        onClick={() => onEdit(activity.id)}
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

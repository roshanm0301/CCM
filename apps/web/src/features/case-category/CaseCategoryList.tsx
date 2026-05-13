/**
 * CaseCategoryList — table view for Case Category master.
 * Source: CCM_Phase3_CaseCategory_Master.md
 */

import React from 'react';
import {
  Box,
  Button,
  Chip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import type { CategoryDto } from './caseCategoryApi';

interface CaseCategoryListProps {
  categories: CategoryDto[];
  loading: boolean;
  error: string | null;
  onNew: () => void;
  onEdit: (id: string) => void;
}

export function CaseCategoryList({
  categories,
  loading,
  error,
  onNew,
  onEdit,
}: CaseCategoryListProps) {
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
          Case Category Master
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
          New Case Category
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
                <TableCell sx={{ fontWeight: 600 }}>Definition</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Departments</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Case Natures</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Product Types</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Sub-categories</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      No case categories found. Click "New Case Category" to create one.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((cat) => (
                  <TableRow key={cat.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {cat.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {cat.displayName}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={cat.definition}
                      >
                        {cat.definition}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {cat.departments.map((d) => (
                          <Chip key={d} label={d} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {cat.caseNatures.map((n) => (
                          <Chip key={n} label={n} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {cat.productTypes.map((p) => (
                          <Chip key={p} label={p} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={cat.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={cat.isActive ? 'success' : 'default'}
                        variant={cat.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" color="text.secondary">
                        {cat.subcategoryCount ?? 0}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        startIcon={<EditIcon fontSize="small" />}
                        onClick={() => onEdit(cat.id)}
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

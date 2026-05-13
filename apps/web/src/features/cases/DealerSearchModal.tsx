/**
 * DealerSearchModal — full-screen dialog for dealer selection.
 * Source: CCM Phase 4 Case Creation Workspace spec.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { searchDealers } from './casesApi';
import type { DealerItem } from './casesApi';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DealerSearchModalProps {
  open: boolean;
  productType: string;
  onSelect: (dealer: DealerItem) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DealerSearchModal({ open, productType, onSelect, onClose }: DealerSearchModalProps) {
  const [dealers, setDealers] = useState<DealerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterPin, setFilterPin] = useState('');

  // Load dealers when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    searchDealers({ productType })
      .then((res) => {
        setDealers(res.dealers);
      })
      .catch(() => {
        setError('Failed to load dealers. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, productType]);

  // Reset filters when closed
  useEffect(() => {
    if (!open) {
      setFilterSearch('');
      setFilterState('');
      setFilterCity('');
      setFilterPin('');
    }
  }, [open]);

  // Cascading filter options
  const uniqueStates = [...new Set(dealers.map((d) => d.state))].sort();
  const uniqueCities = [
    ...new Set(
      dealers
        .filter((d) => !filterState || d.state === filterState)
        .map((d) => d.city),
    ),
  ].sort();
  const uniquePinCodes = [
    ...new Set(
      dealers
        .filter(
          (d) =>
            (!filterState || d.state === filterState) &&
            (!filterCity || d.city === filterCity),
        )
        .map((d) => d.pinCode),
    ),
  ].sort();

  // Client-side filtered list
  const filtered = dealers.filter((d) => {
    const matchesSearch =
      !filterSearch ||
      d.dealerName.toLowerCase().includes(filterSearch.toLowerCase()) ||
      d.branchName.toLowerCase().includes(filterSearch.toLowerCase());
    const matchesState = !filterState || d.state === filterState;
    const matchesCity = !filterCity || d.city === filterCity;
    const matchesPin = !filterPin || d.pinCode === filterPin;
    return matchesSearch && matchesState && matchesCity && matchesPin;
  });

  function handleStateChange(e: SelectChangeEvent) {
    setFilterState(e.target.value);
    setFilterCity('');
    setFilterPin('');
  }

  function handleCityChange(e: SelectChangeEvent) {
    setFilterCity(e.target.value);
    setFilterPin('');
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 1.5,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          Select Dealer
        </Typography>
        <IconButton aria-label="Close dealer search" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Filter row */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr 1fr' },
            gap: 2,
            mb: 3,
          }}
        >
          <TextField
            label="Search"
            size="small"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Dealer or branch name…"
            fullWidth
          />

          <FormControl size="small" fullWidth>
            <InputLabel>State</InputLabel>
            <Select value={filterState} label="State" onChange={handleStateChange}>
              <MenuItem value="">All States</MenuItem>
              {uniqueStates.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>City</InputLabel>
            <Select value={filterCity} label="City" onChange={handleCityChange}>
              <MenuItem value="">All Cities</MenuItem>
              {uniqueCities.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>Pin Code</InputLabel>
            <Select
              value={filterPin}
              label="Pin Code"
              onChange={(e: SelectChangeEvent) => setFilterPin(e.target.value)}
            >
              <MenuItem value="">All Pin Codes</MenuItem>
              {uniquePinCodes.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Loading */}
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} variant="rectangular" height={100} sx={{ borderRadius: 1 }} />
            ))}
          </Box>
        )}

        {/* Error */}
        {error && !loading && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Results */}
        {!loading && !error && (
          <>
            {filtered.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No dealers found.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {filtered.map((dealer) => (
                  <DealerCard
                    key={dealer.id}
                    dealer={dealer}
                    onSelect={() => {
                      onSelect(dealer);
                      onClose();
                    }}
                  />
                ))}
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Dealer Card
// ---------------------------------------------------------------------------

interface DealerCardProps {
  dealer: DealerItem;
  onSelect: () => void;
}

function DealerCard({ dealer, onSelect }: DealerCardProps) {
  const cardContent = (
    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ color: dealer.isActive ? 'text.primary' : 'text.disabled' }}>
              {dealer.branchName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ({dealer.branchCode})
            </Typography>
          </Box>
          <Typography variant="body2" color={dealer.isActive ? 'text.secondary' : 'text.disabled'} sx={{ mb: 0.25 }}>
            {dealer.dealerName} &mdash; {dealer.dealerCode}
          </Typography>
          <Typography variant="caption" color={dealer.isActive ? 'text.secondary' : 'text.disabled'} sx={{ display: 'block', mb: 0.25 }}>
            {dealer.contactNumber}
          </Typography>
          <Typography variant="caption" color={dealer.isActive ? 'text.secondary' : 'text.disabled'}>
            {dealer.address}, {dealer.city}, {dealer.state} &mdash; {dealer.pinCode}
          </Typography>
        </Box>
        <Chip
          label={dealer.isActive ? 'Active' : 'Inactive'}
          size="small"
          color={dealer.isActive ? 'success' : 'default'}
          variant={dealer.isActive ? 'filled' : 'outlined'}
        />
      </Box>
    </CardContent>
  );

  if (dealer.isActive) {
    return (
      <Card variant="outlined" sx={{ '&:hover': { borderColor: 'primary.main', boxShadow: 1 } }}>
        <CardActionArea onClick={onSelect} aria-label={`Select dealer ${dealer.branchName}`}>
          {cardContent}
        </CardActionArea>
      </Card>
    );
  }

  return (
    <Card
      variant="outlined"
      aria-disabled="true"
      role="button"
      sx={{ opacity: 0.6, bgcolor: 'action.disabledBackground', cursor: 'not-allowed' }}
    >
      {cardContent}
    </Card>
  );
}

/**
 * SearchResults — Screen 4 result list and vehicle disambiguation.
 *
 * Multiple results: renders a list with Select buttons.
 * Single result: auto-selects (caller handles this via useEffect).
 * Vehicle disambiguation: shown when selected customer has > 1 vehicle.
 * On Select: PATCH /api/v1/interactions/:id/context.
 *
 * Source: ux-specification.md Screen 4 §4.3–4.11
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { InteractionStatus } from '@ccm/types';
import { apiClient } from '@/shared/api/client';
import {
  useInteractionStore,
  type SearchResultItem,
  type SearchResultVehicle,
} from '@/features/interaction/interactionStore';

// ---------------------------------------------------------------------------
// Masking helpers
// ---------------------------------------------------------------------------

/** Mask mobile: show only last 4 digits. e.g. xxxxxxx1234 */
function maskMobile(mobile: string): string {
  if (mobile.length <= 4) return mobile;
  return 'x'.repeat(mobile.length - 4) + mobile.slice(-4);
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface UpdateContextResponse {
  success: true;
  data: {
    interactionId: string;
    status: InteractionStatus;
    currentCustomerRef: string;
    currentVehicleRef: string | null;
    currentDealerRef: string | null;
    updatedAt: string;
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SearchResultsProps {
  results: SearchResultItem[];
  firstResultRef?: React.RefObject<HTMLButtonElement>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchResults({ results, firstResultRef }: SearchResultsProps) {
  const {
    interactionId,
    selectedCustomerRef,
    setSelectedRefs,
    setStatus,
    setCustomerContext,
    setVehicleContext,
    setDealerContext,
  } = useInteractionStore();

  const [selectingIndex, setSelectingIndex] = useState<number | null>(null);
  const [contextError, setContextError] = useState('');
  const [disambiguationVehicles, setDisambiguationVehicles] = useState<SearchResultVehicle[] | null>(null);
  const [disambiguationCustomerRef, setDisambiguationCustomerRef] = useState<string | null>(null);
  const [disambiguationPrimaryMobile, setDisambiguationPrimaryMobile] = useState<string | null>(null);
  const [disambiguationDealerRef, setDisambiguationDealerRef] = useState<string | null>(null);
  const [selectingVehicleIndex, setSelectingVehicleIndex] = useState<number | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const disambHeadingRef = useRef<HTMLParagraphElement>(null);

  // Auto-select single result
  useEffect(() => {
    if (results.length === 1 && !selectedCustomerRef) {
      handleSelectCustomer(results[0], 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  async function loadContextData(
    customerRef: string,
    vehicleRef: string | null,
    dealerRef: string | null,
    isReselection: boolean,
    customerPhoneNumber: string | null,
  ) {
    if (!interactionId) {
      return;
    }

    setLoadingContext(true);
    setContextError('');

    try {
      // 1. Update context refs on the interaction
      const ctxRes = await apiClient.patch<UpdateContextResponse>(
        `/api/v1/interactions/${interactionId}/context`,
        {
          customerRef,
          vehicleRef,
          dealerRef,
          isReselection,
          customerPhoneNumber,
        },
      );

      const { status } = ctxRes.data.data;
      setSelectedRefs(customerRef, vehicleRef, dealerRef);
      setStatus(status);

      // 2. Load context cards in parallel — each may fail independently
      // API envelope: { success: true; data: EntityType }
      // Axios .get<T>() returns AxiosResponse<T>, so .data is T

      type CustomerEnvelope = { success: true; data: Parameters<typeof setCustomerContext>[0] };
      type VehicleEnvelope = { success: true; data: Parameters<typeof setVehicleContext>[0] };
      type DealerEnvelope = { success: true; data: Parameters<typeof setDealerContext>[0] };

      // Wrap optional fetches in a helper that returns null when ref is absent
      async function fetchIfRef<T>(ref: string | null, url: string) {
        if (!ref) return null;
        const res = await apiClient.get<T>(url);
        return res.data;
      }

      const [customerResult, vehicleResult, dealerResult] = await Promise.allSettled([
        apiClient.get<CustomerEnvelope>(`/api/v1/context/customer/${customerRef}`),
        fetchIfRef<VehicleEnvelope>(vehicleRef, `/api/v1/context/vehicle/${vehicleRef ?? ''}`),
        fetchIfRef<DealerEnvelope>(dealerRef, `/api/v1/context/dealer/${dealerRef ?? ''}`),
      ]);

      // Set context — failed cards show "unavailable" state (null), not crash
      if (customerResult.status === 'fulfilled') {
        setCustomerContext(customerResult.value.data.data);
      } else {
        setCustomerContext(null);
      }

      if (vehicleResult.status === 'fulfilled') {
        setVehicleContext(vehicleResult.value ? vehicleResult.value.data : null);
      } else {
        setVehicleContext(null);
      }

      if (dealerResult.status === 'fulfilled') {
        setDealerContext(dealerResult.value ? dealerResult.value.data : null);
      } else {
        setDealerContext(null);
      }
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const httpStatus = (err as any)?.response?.status as number | undefined;
      if (httpStatus === 403) {
        setContextError(
          'You do not have access to this interaction. Please start a new interaction.',
        );
      } else {
        setContextError('Unable to load selected record. Please try again.');
      }
    } finally {
      setLoadingContext(false);
    }
  }

  async function handleSelectCustomer(item: SearchResultItem, index: number) {
    setSelectingIndex(index);
    setContextError('');
    setDisambiguationVehicles(null);

    const isReselection = Boolean(selectedCustomerRef);

    if (item.vehicles.length === 0) {
      await loadContextData(item.customerRef, null, null, isReselection, item.primaryMobile);
      setSelectingIndex(null);
    } else if (item.vehicles.length === 1) {
      const vehicle = item.vehicles[0];
      await loadContextData(
        item.customerRef,
        vehicle.vehicleRef,
        vehicle.dealerRef,
        isReselection,
        item.primaryMobile,
      );
      setSelectingIndex(null);
    } else {
      // Multiple vehicles — show disambiguation panel
      setDisambiguationVehicles(item.vehicles);
      setDisambiguationCustomerRef(item.customerRef);
      setDisambiguationPrimaryMobile(item.primaryMobile);
      setDisambiguationDealerRef(null);
      setSelectingIndex(null);
      setTimeout(() => {
        disambHeadingRef.current?.focus();
      }, 100);
    }
  }

  async function handleSelectVehicle(vehicle: SearchResultVehicle, index: number) {
    if (!disambiguationCustomerRef) return;
    setSelectingVehicleIndex(index);
    await loadContextData(
      disambiguationCustomerRef,
      vehicle.vehicleRef,
      vehicle.dealerRef ?? disambiguationDealerRef,
      Boolean(selectedCustomerRef),
      disambiguationPrimaryMobile,
    );
    setSelectingVehicleIndex(null);
    setDisambiguationVehicles(null);
  }

  return (
    <Box>
      <Divider sx={{ my: 1.5 }} />

      <Typography
        variant="subtitle1"
        color="text.secondary"
        sx={{ mb: 1 }}
      >
        Search Results ({results.length} found)
      </Typography>

      {loadingContext && (
        <LinearProgress aria-label="Loading context" sx={{ mb: 1 }} />
      )}

      {contextError && (
        <Alert
          severity="error"
          role="alert"
          sx={{ mb: 1.5 }}
          action={
            <Button
              size="small"
              color="inherit"
              onClick={() => {
                if (disambiguationCustomerRef) {
                  setContextError('');
                }
              }}
            >
              Retry
            </Button>
          }
        >
          {contextError}
        </Alert>
      )}

      {/* Result list */}
      <List
        disablePadding
        role="list"
        aria-label="Customer search results"
        sx={{
          maxHeight: 320,
          overflowY: results.length > 5 ? 'auto' : 'visible',
        }}
      >
        {results.map((item, index) => {
          const isSelected = item.customerRef === selectedCustomerRef;
          const isLoading = selectingIndex === index;
          const vehicleInfo =
            item.vehicles[0] ?? null;

          return (
            <ListItem
              key={item.customerRef}
              divider
              role="listitem"
              alignItems="flex-start"
              aria-selected={isSelected}
              sx={{
                bgcolor: isSelected ? 'primary.50' : 'background.paper',
                '&:hover': { bgcolor: 'action.hover' },
                flexDirection: { xs: 'column', md: 'row' },
                gap: 1,
                py: 1.5,
              }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                {/* Customer name */}
                <Typography
                  variant="body1"
                  fontWeight="medium"
                  color="text.primary"
                  sx={{ mb: 0.25 }}
                >
                  {item.customerName}
                </Typography>

                {/* Mobile masked */}
                <Typography variant="body2" color="text.secondary">
                  {maskMobile(item.primaryMobile)}
                </Typography>

                {/* Vehicle info */}
                {vehicleInfo && (
                  <Box sx={{ display: { xs: 'block', md: 'flex' }, gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {vehicleInfo.registrationNumber}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Select button */}
              <Box sx={{ flexShrink: 0 }}>
                {isSelected && !isLoading ? (
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    disabled
                    startIcon={<CheckIcon />}
                    aria-label={`${item.customerName} is currently selected`}
                    sx={{ width: { xs: '100%', md: 'auto' } }}
                  >
                    Selected
                  </Button>
                ) : (
                  <Button
                    id={`select-result-${index}`}
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={() => handleSelectCustomer(item, index)}
                    disabled={isLoading || loadingContext}
                    aria-label={`Select customer ${item.customerName}`}
                    ref={index === 0 ? firstResultRef : undefined}
                    sx={{ width: { xs: '100%', md: 'auto' } }}
                  >
                    {isLoading ? (
                      <CircularProgress size={16} sx={{ color: 'inherit' }} />
                    ) : (
                      'Select'
                    )}
                  </Button>
                )}
              </Box>
            </ListItem>
          );
        })}
      </List>

      {/* Vehicle disambiguation panel */}
      {disambiguationVehicles && (
        <Box sx={{ mt: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography
            ref={disambHeadingRef}
            variant="subtitle1"
            color="text.primary"
            sx={{ mb: 1 }}
            tabIndex={-1}
            aria-label="Multiple vehicles found. Select one."
          >
            Multiple vehicles found. Select one.
          </Typography>

          <List disablePadding role="list" aria-label="Vehicle selection list">
            {disambiguationVehicles.map((vehicle, index) => (
              <ListItem
                key={vehicle.vehicleRef}
                divider
                role="listitem"
                alignItems="flex-start"
                sx={{
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 1,
                  py: 1,
                }}
              >
                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight="medium" color="text.primary">
                      {vehicle.registrationNumber}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {vehicle.modelName} {vehicle.variant}
                    </Typography>
                  }
                />
                <Button
                  id={`select-vehicle-${index}`}
                  variant="outlined"
                  color="primary"
                  size="small"
                  onClick={() => handleSelectVehicle(vehicle, index)}
                  disabled={selectingVehicleIndex !== null || loadingContext}
                  aria-label={`Select vehicle ${vehicle.registrationNumber}`}
                  sx={{ flexShrink: 0, width: { xs: '100%', md: 'auto' } }}
                >
                  {selectingVehicleIndex === index ? (
                    <CircularProgress size={16} sx={{ color: 'inherit' }} />
                  ) : (
                    'Select'
                  )}
                </Button>
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}

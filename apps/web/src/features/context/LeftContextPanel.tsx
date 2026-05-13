/**
 * LeftContextPanel — 300px left panel shown when CONTEXT_CONFIRMED.
 *
 * Contains (stacked top→bottom):
 *  1. Collapsed search summary (filter type + value + Change button)
 *  2. Customer Details card
 *  3. Vehicle Details card
 *  4. Dealer Details card
 *  5. "Start Wrap-up" sticky action at bottom
 *
 * Width: 300px, full-height, scrollable, border-right: 1px #DEE4EB
 * Padding: 16px (outer), 12px between sections
 *
 * Source: Agent.docx §Left Search Panel
 */

import React from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  LinearProgress,
  Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@/shared/components/customIcon';
import { useInteractionStore } from '@/features/interaction/interactionStore';
import { CustomerCard } from './CustomerCard';
import { VehicleCard } from './VehicleCard';
import { DealerCard } from './DealerCard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LeftContextPanelProps {
  onStartWrapup: () => void;
  onChangeSelection: () => void;
  startWrapupLoading?: boolean;
  startWrapupError?: string | null;
  /** The last search filter type label (e.g. "Mobile") */
  searchFilterLabel?: string;
  /** The last search value entered */
  searchValue?: string;
  /**
   * When true the "Start Wrap-up" action bar at the bottom is hidden.
   * Use this when the panel is shown alongside the WrapupForm so the agent
   * can still see context details without a redundant action button.
   */
  hideActions?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeftContextPanel({
  onStartWrapup,
  onChangeSelection,
  startWrapupLoading = false,
  startWrapupError,
  hideActions = false,
  searchFilterLabel,
  searchValue,
}: LeftContextPanelProps) {
  const { customerContext, vehicleContext, dealerContext } = useInteractionStore();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Scrollable content area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {/* ── Collapsed search summary ── */}
        <Box>
          <Typography
            component="h2"
            sx={{
              fontSize: 'base',
              fontWeight: 'strong',
              color: '#000000',
              mb: 0.75,
            }}
          >
            Search
          </Typography>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: '#F4F7FA',
              borderRadius: 1.5,
              px: 1.5,
              py: 0.75,
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
              <SearchIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
              <Typography
                sx={{
                  fontSize: 'sm',
                  color: 'text.primary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {searchFilterLabel && searchValue
                  ? `${searchFilterLabel}: ${searchValue}`
                  : searchValue || '—'}
              </Typography>
            </Box>
            <Button
              variant="text"
              size="small"
              onClick={onChangeSelection}
              aria-label="Change search — returns to search view"
              sx={{
                fontSize: 'sm',
                color: '#EB6A2C',
                p: 0,
                minWidth: 0,
                fontWeight: 'medium',
                textTransform: 'none',
                flexShrink: 0,
                '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
              }}
            >
              Change
            </Button>
          </Box>
        </Box>

        <Divider sx={{ borderColor: '#DEE4EB' }} />

        {/* ── Customer Details card ── */}
        <CustomerCard
          data={customerContext}
          loading={false}
          error={null}
        />

        {/* ── Vehicle Details card ── */}
        <VehicleCard
          data={vehicleContext}
          loading={false}
          error={null}
          dealerName={dealerContext?.dealerName ?? null}
        />

        {/* ── Dealer Details card ── */}
        <DealerCard
          data={dealerContext}
          loading={false}
          error={null}
        />
      </Box>

      {/* ── Sticky action bar — hidden when alongside WrapupForm ── */}
      {!hideActions && <Box
        component="div"
        role="toolbar"
        aria-label="Interaction actions"
        sx={{
          flexShrink: 0,
          bgcolor: '#FFFFFF',
          borderTop: '1px solid #DEE4EB',
          px: 2,
          py: 1.5,
          position: 'relative',
        }}
      >
        {startWrapupLoading && (
          <LinearProgress
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
            }}
            aria-label="Starting wrap-up"
          />
        )}

        {startWrapupError && (
          <Alert severity="error" role="alert" sx={{ mb: 1, py: 0.5, fontSize: 'sm' }}>
            {startWrapupError}
          </Alert>
        )}

        <Button
          id="start-wrapup-btn"
          variant="contained"
          fullWidth
          onClick={onStartWrapup}
          disabled={startWrapupLoading}
          aria-label="Start wrap-up for this interaction"
          sx={{
            bgcolor: '#EB6A2C',
            color: '#FFFFFF',
            fontSize: 'base',
            fontWeight: 'strong',
            borderRadius: 2,
            height: 36,
            textTransform: 'none',
            '&:hover': { bgcolor: '#C45A24' },
            '&.Mui-disabled': { bgcolor: '#EB6A2C', opacity: 0.5, color: '#FFFFFF' },
          }}
        >
          {startWrapupLoading ? 'Starting…' : 'Start Wrap-up'}
        </Button>
      </Box>}
    </Box>
  );
}

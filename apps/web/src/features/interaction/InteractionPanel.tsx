/**
 * InteractionPanel — orchestrates Screens 3–6 within a single active interaction.
 *
 * State machine (mirrors InteractionStatus enum):
 *   IDENTIFYING       → Left: SearchPanel  |  Center: "Search for a customer" placeholder
 *   CONTEXT_CONFIRMED → Left: LeftContextPanel (search summary + 3 context cards + Start Wrap-up)
 *                       Center: placeholder (Case History — future scope)
 *   WRAPUP            → Full-width WrapupForm
 *   CLOSED/INCOMPLETE → InteractionActions (Screen 7)
 *
 * Layout:
 * - InteractionMetaBar (sticky 48px below 64px header)
 * - Main content flex row:
 *   - Left column 300px: SearchPanel or LeftContextPanel
 *   - Center column flex 1: placeholder / WrapupForm
 *
 * Source: Agent.docx §CSR Dashboard, ux-specification-v2.md Screen 6
 */

import React, { Component, type ReactNode, useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { InteractionStatus } from '@ccm/types';
import { useInteractionStore } from './interactionStore';
import { InteractionMetaBar } from './InteractionMetaBar';
import { SearchPanel } from '@/features/search/SearchPanel';
import { LeftContextPanel } from '@/features/context/LeftContextPanel';
import { WrapupForm } from '@/features/wrapup/WrapupForm';
import { InteractionActions } from './InteractionActions';
import { CaseWorkspace } from '@/features/cases/CaseWorkspace';
import { CtiActiveCallBar } from '@/features/cti/CtiActiveCallBar';
import { useCtiStore } from '@/features/cti/ctiStore';

// ---------------------------------------------------------------------------
// Error boundary — wraps the panel per spec §F
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean;
}

class InteractionErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error) {
    // Do not log sensitive data per security-principles.md
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[InteractionPanel error]', error.message);
    }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h3" color="error" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            An unexpected error occurred. Please refresh or start a new interaction.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface InteractionPanelProps {
  onInteractionComplete: () => void;
}

export function InteractionPanel({ onInteractionComplete }: InteractionPanelProps) {
  const {
    interactionId,
    status,
    startedAt,
    closureOutcome,
    customerContext,
    vehicleContext,
    channel,
    ctiFromNumber,
    searchResults,
    setStatus,
    setClosure,
    resetInteraction,
    clearSelection,
  } = useInteractionStore();

  const ctiCallStatus = useCtiStore((s) => s.callStatus);

  const [startWrapupLoading] = useState(false);
  const [startWrapupError] = useState<string | null>(null);

  // Track last search state to display in LeftContextPanel collapsed summary
  const [lastSearchFilterLabel, setLastSearchFilterLabel] = useState('');
  const [lastSearchValue, setLastSearchValue] = useState('');

  // ── Reset search summary when a new interaction begins ───────────────────
  // InteractionPanel stays mounted between CTI calls (hasActiveInteraction stays
  // true).  Without this reset, autoSummaryRef stays true from the previous call
  // and the LeftContextPanel search summary shows stale data.
  const autoSummaryRef = useRef(false);
  useEffect(() => {
    autoSummaryRef.current = false;
    setLastSearchFilterLabel('');
    setLastSearchValue('');
  }, [interactionId]);

  // ── Auto-capture search summary for pre-fetched inbound-call results ──────
  // When pre-fetched results arrive the agent never types a search term, so
  // onSearchCommitted is never called and lastSearchValue stays empty.
  // This effect seeds the summary from ctiFromNumber when results land so
  // LeftContextPanel shows "Mobile: 8554982643" instead of "—" after Select.
  useEffect(() => {
    if (autoSummaryRef.current) return;
    if (!ctiFromNumber || !searchResults || searchResults.length === 0) return;
    const digits = ctiFromNumber.replace(/\D/g, '');
    const normalized = digits.length > 10 ? digits.slice(-10) : digits;
    if (normalized.length >= 3) {
      setLastSearchFilterLabel('Mobile');
      setLastSearchValue(normalized);
      autoSummaryRef.current = true;
    }
  }, [ctiFromNumber, searchResults]);

  if (!interactionId || !status || !startedAt) {
    return null;
  }

  // Screen 7: Closure confirmation
  if (
    status === InteractionStatus.CLOSED ||
    status === InteractionStatus.INCOMPLETE ||
    closureOutcome
  ) {
    return (
      <InteractionActions
        outcome={closureOutcome ?? (status === InteractionStatus.CLOSED ? 'CLOSED' : 'INCOMPLETE')}
        interactionId={interactionId}
        onStartNew={() => {
          resetInteraction();
          onInteractionComplete();
        }}
      />
    );
  }

  function handleStartWrapup() {
    setStatus(InteractionStatus.WRAPUP);
  }

  function handleChangeSelection() {
    // clearSelection() now clears refs, searchResults, and all three context
    // cards atomically (FE-1 fix) — no extra setter calls needed.
    clearSelection();
    setStatus(InteractionStatus.IDENTIFYING);
  }

  function handleInteractionClosed(outcome: 'CLOSED' | 'INCOMPLETE') {
    const newStatus =
      outcome === 'CLOSED' ? InteractionStatus.CLOSED : InteractionStatus.INCOMPLETE;
    setStatus(newStatus);
    setClosure(outcome);
  }

  /** Called by SearchPanel when a search is committed — captures label + value for collapsed summary */
  function handleSearchCommitted(filterLabel: string, value: string) {
    setLastSearchFilterLabel(filterLabel);
    setLastSearchValue(value);
  }

  const isIdentifying = status === InteractionStatus.IDENTIFYING;
  const isContextConfirmed = status === InteractionStatus.CONTEXT_CONFIRMED;
  const isWrapup = status === InteractionStatus.WRAPUP;
  const isStopped = [
    InteractionStatus.CLOSED,
    InteractionStatus.INCOMPLETE,
  ].includes(status);

  // Shared left-column styles
  const leftColumnSx = {
    width: { xs: '100%', lg: 300 },
    flexShrink: 0,
    bgcolor: '#FFFFFF',
    borderRight: { lg: '1px solid #DEE4EB' },
    overflowY: 'auto',
    minHeight: { lg: 'calc(100vh - 64px - 48px)' },
  };

  return (
    <InteractionErrorBoundary>
      <Box
        sx={{
          minHeight: 'calc(100vh - 64px)',
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Sticky Interaction Meta Bar — top: 64px (below GlobalHeader) */}
        <InteractionMetaBar
          interactionId={interactionId}
          startedAt={startedAt}
          status={status}
          stopped={isStopped}
          channel={channel}
          ctiFromNumber={ctiFromNumber}
        />

        {/* CTI active-call controls bar — shown while an inbound call is live */}
        {ctiCallStatus === 'active' && channel === 'inbound_call' && (
          <CtiActiveCallBar />
        )}

        {/* Main content */}
        <Box
          component="main"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            gap: 0,
            overflow: 'hidden',
          }}
        >

          {/* ── IDENTIFYING: SearchPanel in left column ── */}
          {isIdentifying && (
            <>
              {/*
                Call-ended banner — shown when hangup fired before the HTTP
                response that created the interaction (quick test calls, network
                lag).  In this scenario triggerWrapupIfNeeded() in the hangup
                handler was a no-op (old interaction was INCOMPLETE or null), so
                WRAPUP is not auto-triggered.  The banner gives the agent two
                options:
                  1. Search for the customer first, then use the normal
                     "Start Wrap-up" flow from LeftContextPanel.
                  2. Skip search and start wrap-up directly.
              */}
              {ctiCallStatus === 'ended' && channel === 'inbound_call' && (
                <Box
                  role="status"
                  sx={{
                    bgcolor: 'warning.50',
                    borderBottom: '1px solid',
                    borderColor: 'warning.200',
                    px: 3,
                    py: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'warning.700', flex: 1 }}>
                    Call ended — search for the customer or start wrap-up directly.
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleStartWrapup}
                    sx={{
                      bgcolor: '#EB6A2C',
                      color: '#FFFFFF',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      '&:hover': { bgcolor: '#C45A24' },
                    }}
                  >
                    Start Wrap-up
                  </Button>
                </Box>
              )}

              {/* Left: Search */}
              <Box sx={{ ...leftColumnSx, p: 2 }}>
                <SearchPanel onSearchCommitted={handleSearchCommitted} />
              </Box>

              {/* Center: hint */}
              <Box
                sx={{
                  flex: 1,
                  bgcolor: 'background.default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 3,
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  Search for a customer to continue.
                </Typography>
              </Box>
            </>
          )}

          {/* ── CONTEXT_CONFIRMED: LeftContextPanel in left column ── */}
          {isContextConfirmed && (
            <>
              {/* Left: collapsed search + 3 context cards + Start Wrap-up */}
              <Box
                sx={{
                  ...leftColumnSx,
                  overflowY: 'hidden',       // internal scroll handled by LeftContextPanel
                  display: { xs: 'none', lg: 'flex' },
                  flexDirection: 'column',
                  minHeight: { lg: 'calc(100vh - 64px - 48px)' },
                }}
              >
                <LeftContextPanel
                  onStartWrapup={handleStartWrapup}
                  onChangeSelection={handleChangeSelection}
                  startWrapupLoading={startWrapupLoading}
                  startWrapupError={startWrapupError}
                  searchFilterLabel={lastSearchFilterLabel}
                  searchValue={lastSearchValue}
                />
              </Box>

              {/* Mobile: Change + Start Wrap-up (xs/sm only) */}
              <Box
                sx={{
                  display: { xs: 'flex', lg: 'none' },
                  gap: 1,
                  px: 2,
                  pt: 1.5,
                  pb: 1,
                  bgcolor: 'background.paper',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleChangeSelection}
                  sx={{ fontSize: 'sm', borderColor: 'divider', color: 'text.secondary' }}
                >
                  Change Selection
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleStartWrapup}
                  disabled={startWrapupLoading}
                  sx={{
                    bgcolor: '#EB6A2C',
                    color: '#FFFFFF',
                    fontSize: 'sm',
                    '&:hover': { bgcolor: '#C45A24' },
                    '&.Mui-disabled': { bgcolor: '#EB6A2C', opacity: 0.5 },
                  }}
                >
                  Start Wrap-up
                </Button>
              </Box>

              {/* Center: Case Workspace */}
              <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: '#F4F7FA' }}>
                <CaseWorkspace
                  interactionId={interactionId}
                  customerRef={customerContext?.customerRef ?? ''}
                  vehicleRef={vehicleContext?.vehicleRef ?? null}
                  derivedProductType={vehicleContext?.productType ?? null}
                />
              </Box>
            </>
          )}

          {/* ── WRAPUP: left panel stays visible + WrapupForm in center ── */}
          {isWrapup && (
            <>
              {/* Left: context panel — read-only, no "Start Wrap-up" button */}
              <Box
                sx={{
                  ...leftColumnSx,
                  overflowY: 'hidden',
                  display: { xs: 'none', lg: 'flex' },
                  flexDirection: 'column',
                  minHeight: { lg: 'calc(100vh - 64px - 48px)' },
                }}
              >
                <LeftContextPanel
                  onStartWrapup={handleStartWrapup}
                  onChangeSelection={handleChangeSelection}
                  startWrapupLoading={startWrapupLoading}
                  startWrapupError={startWrapupError}
                  searchFilterLabel={lastSearchFilterLabel}
                  searchValue={lastSearchValue}
                  hideActions
                />
              </Box>

              {/* Center: case workspace (always visible) + wrap-up form (independent) */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  bgcolor: 'background.default',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CaseWorkspace
                  interactionId={interactionId}
                  customerRef={customerContext?.customerRef ?? ''}
                  vehicleRef={vehicleContext?.vehicleRef ?? null}
                  derivedProductType={vehicleContext?.productType ?? null}
                />
                <WrapupForm onInteractionClosed={handleInteractionClosed} />
              </Box>
            </>
          )}

        </Box>
      </Box>
    </InteractionErrorBoundary>
  );
}

/**
 * CaseWorkspace — the main container for the center panel in CONTEXT_CONFIRMED state.
 * Orchestrates: header bar, CaseRegistrationForm (when open), CaseHistoryTable,
 * and the read-only registered case summary (post-registration or on resume).
 *
 * Source: CCM Phase 4 Case Creation Workspace spec.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useCaseStore } from './caseStore';
import { fetchCaseHistory, getCaseByInteractionId } from './casesApi';
import { CaseRegistrationForm } from './CaseRegistrationForm';
import { CaseHistoryTable } from './CaseHistoryTable';
import { CaseSuccessModal } from './CaseSuccessModal';
import type { CaseDto } from './casesApi';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CaseWorkspaceProps {
  interactionId: string;
  customerRef: string;
  vehicleRef: string | null;
  derivedProductType: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CaseWorkspace({
  interactionId,
  customerRef,
  vehicleRef,
  derivedProductType,
}: CaseWorkspaceProps) {
  const {
    caseHistory,
    openCaseCount,
    caseHistoryLoading,
    caseHistoryError,
    caseFormOpen,
    registeredCase,
    setCaseHistory,
    setCaseHistoryLoading,
    setCaseHistoryError,
    openCaseForm,
    closeCaseForm,
    setRegisteredCase,
    resetCaseWorkspace,
  } = useCaseStore();

  const [existingCaseCheckError, setExistingCaseCheckError] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // ── Load history ─────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!customerRef) return;
    setCaseHistoryLoading(true);
    setCaseHistoryError(null);
    try {
      const data = await fetchCaseHistory(customerRef);
      setCaseHistory(data.cases, data.openCaseCount);
    } catch {
      setCaseHistoryError('Unable to load case history.');
    } finally {
      setCaseHistoryLoading(false);
    }
  }, [customerRef, setCaseHistory, setCaseHistoryError, setCaseHistoryLoading]);

  // ── Check for existing case on this interaction (resume scenario) ─────────
  const checkExistingCase = useCallback(async () => {
    if (!interactionId) return;
    try {
      const existing = await getCaseByInteractionId(interactionId);
      if (existing && existing.customerRef === customerRef) {
        setRegisteredCase(existing);
      }
    } catch {
      setExistingCaseCheckError(true);
    }
  }, [interactionId, customerRef, setRegisteredCase]);

  // ── Reset + reload on customerRef change ─────────────────────────────────
  useEffect(() => {
    resetCaseWorkspace();
    void loadHistory();
    void checkExistingCase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Intentional: loadHistory and checkExistingCase are useCallback-memoized and
  // close over customerRef — they are recreated when customerRef changes, which
  // is the same trigger as this effect. resetCaseWorkspace is a stable Zustand
  // store action (guaranteed stable reference). Including these would cause no
  // behaviour change but would require additional memoization boilerplate.
  }, [customerRef]);

  // ── Post-registration callback ────────────────────────────────────────────
  function handleCaseRegistered(cas: CaseDto) {
    setRegisteredCase(cas);
    closeCaseForm();
    setShowSuccessModal(true);
  }

  function handleModalClose() {
    setShowSuccessModal(false);
    void loadHistory();
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Existing-case check error ── */}
      {existingCaseCheckError && (
        <Alert
          severity="warning"
          onClose={() => setExistingCaseCheckError(false)}
          sx={{ mx: 2, mt: 1.5 }}
        >
          Could not verify if a case already exists for this interaction. Proceed with caution.
        </Alert>
      )}

      {/* ── Header bar ── */}
      {!caseFormOpen && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            bgcolor: '#FFFFFF',
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              Case Workspace
            </Typography>
            {openCaseCount > 0 && (
              <Chip
                label={`${openCaseCount} Open ${openCaseCount === 1 ? 'Case' : 'Cases'}`}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
          </Box>

          {/* Show "+ New Case" only when no case is registered for this interaction */}
          {!registeredCase ? (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={openCaseForm}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              New Case
            </Button>
          ) : (
            <Chip
              label={`Case ${registeredCase.caseId} already registered`}
              size="small"
              color="info"
              variant="outlined"
            />
          )}
        </Box>
      )}

      {/* ── Case Registration Form ── */}
      {caseFormOpen && !registeredCase && (
        <Box sx={{ flexShrink: 0, overflowY: 'auto', maxHeight: '60vh' }}>
          <CaseRegistrationForm
            interactionId={interactionId}
            customerRef={customerRef}
            vehicleRef={vehicleRef}
            derivedProductType={derivedProductType}
            onRegistered={handleCaseRegistered}
            onClose={closeCaseForm}
          />
        </Box>
      )}

      {/* ── Case History ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {caseHistoryError && !caseHistoryLoading && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {caseHistoryError}
          </Alert>
        )}
        <CaseHistoryTable
          cases={caseHistory}
          loading={caseHistoryLoading}
          error={caseHistoryError}
        />
      </Box>

      {registeredCase && (
        <CaseSuccessModal
          open={showSuccessModal}
          registeredCase={registeredCase}
          onClose={handleModalClose}
        />
      )}
    </Box>
  );
}


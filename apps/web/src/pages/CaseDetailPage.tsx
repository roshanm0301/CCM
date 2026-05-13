/**
 * CaseDetailPage — page wrapper for the three-tab case detail view.
 *
 * Layout mirrors WorkspacePage:
 *   - GlobalHeader (fixed 64px)
 *   - NavRail (56px on md+) for non-dealer users
 *   - Main content offset below header / beside nav rail
 *
 * Source: CCM_Phase6_Resolution_Activities.md § Case Detail Screen
 */

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { GlobalHeader } from '@/shared/components/GlobalHeader';
import { NavRail } from '@/shared/components/NavRail';
import { CaseDetailScreen } from '@/features/cases/CaseDetailScreen';
import { useAuthStore } from '@/features/auth/authStore';
import { apiClient } from '@/shared/api/client';
import { QUERY_DEFAULTS } from '@/shared/api/queryConfig';
import type { CaseDetailDto } from '@/features/cases/casesApi';

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------
async function fetchCaseDetail(caseId: string): Promise<CaseDetailDto> {
  const res = await apiClient.get<{ success: boolean; data: CaseDetailDto }>(
    `/api/v1/cases/detail?caseId=${encodeURIComponent(caseId)}`,
  );
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const isDealer = userRoles.some((r) => r.startsWith('dealer_'));

  const {
    data: caseDetail,
    isLoading,
    isError,
    error,
  } = useQuery<CaseDetailDto>({
    ...QUERY_DEFAULTS,
    queryKey: ['caseDetail', caseId],
    queryFn: () => fetchCaseDetail(caseId ?? ''),
    enabled: Boolean(caseId),
  });

  // Determine back destination
  function handleBack() {
    if (isDealer) {
      navigate('/dealer-catalog');
    } else {
      navigate('/workspace');
    }
  }

  // Check for 404
  const is404 =
    isError &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any)?.response?.status === 404;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Fixed 64px header */}
      <GlobalHeader />

      {/* NavRail only for non-dealer (agent) users */}
      {!isDealer && <NavRail activeItem="home" />}

      {/* Main content */}
      <Box
        sx={{
          mt: '64px',
          ml: isDealer ? 0 : { xs: 0, md: '56px' },
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Loading */}
        {isLoading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexGrow: 1,
              py: 6,
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {/* Error / 404 */}
        {(isError || !caseId) && !isLoading && (
          <Box sx={{ p: 3 }}>
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={handleBack}
                  aria-label="Go back"
                >
                  Back
                </Button>
              }
            >
              {is404 || !caseId ? 'Case not found.' : 'Failed to load case details.'}
            </Alert>
          </Box>
        )}

        {/* Success */}
        {!isLoading && !isError && caseDetail && (
          <>
            {/* Back navigation bar */}
            <Box sx={{ px: 2, pt: 1.5, pb: 0 }}>
              <Button
                size="small"
                onClick={handleBack}
                aria-label="Back"
                sx={{ color: 'text.secondary' }}
              >
                ← Back
              </Button>
            </Box>

            <CaseDetailScreen
              caseDetail={caseDetail}
              userRoles={userRoles}
            />
          </>
        )}
      </Box>
    </Box>
  );
}

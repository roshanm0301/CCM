/**
 * DealerCatalogPage — page wrapper for the dealer catalog.
 * Layout: GlobalHeader (fixed 64px) + full-width content (no NavRail for dealers).
 * Source: CCM_Phase6_Resolution_Activities.md § Dealer Catalog View
 */

import React from 'react';
import { Box } from '@mui/material';
import { GlobalHeader } from '@/shared/components/GlobalHeader';
import { DealerCatalogView } from '@/features/dealer-catalog/DealerCatalogView';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

export function DealerCatalogPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <GlobalHeader />

      {/* Content area — full width, offset below fixed 64px header */}
      <Box
        component="main"
        sx={{
          flex: 1,
          mt: '64px',
          p: 3,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ErrorBoundary>
          <DealerCatalogView />
        </ErrorBoundary>
      </Box>
    </Box>
  );
}

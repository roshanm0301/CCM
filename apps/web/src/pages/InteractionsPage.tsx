/**
 * InteractionsPage — full interactions list view.
 *
 * Layout matches WorkspacePage: GlobalHeader (via shell), NavRail (activeItem="interactions"),
 * main content offset by mt: '64px' + ml: '56px'.
 *
 * Sections:
 *   Page header bar (56px)
 *   Filter + search bar (56px, inside InteractionsListTable)
 *   Table + pagination (flex 1, overflow hidden)
 *   Detail Drawer (right anchor, 480px, inside InteractionsListTable)
 *
 * Source: CCM Wave 3 spec — Complete InteractionsPage
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { GlobalHeader } from '@/shared/components/GlobalHeader';
import { NavRail } from '@/shared/components/NavRail';
import { InteractionsListTable } from '@/features/interactions-list/InteractionsListTable';

export function InteractionsPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Fixed 64px dark header */}
      <GlobalHeader />

      {/* Permanent left nav rail — 56px on md+, hidden on xs/sm */}
      <NavRail activeItem="interactions" />

      {/* Main content — offset for fixed header + left nav rail */}
      <Box
        sx={{
          mt: '64px',
          ml: { xs: 0, md: '56px' },
          height: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'background.default',
        }}
      >
        {/* Page header bar (56px) */}
        <Box
          sx={{
            height: 56,
            px: 3,
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            flexShrink: 0,
          }}
        >
          <Typography variant="h2" component="h1">
            Interactions
          </Typography>
        </Box>

        {/* Table + filters (flex 1, relative for loading bar positioning) */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <InteractionsListTable />
        </Box>
      </Box>
    </Box>
  );
}

/**
 * ContextCards — used on xs/sm where the 3-column grid layout applies.
 *
 * On lg+ the LeftContextPanel handles card display inside the left 300px column.
 * This component is kept for xs/sm responsive use and is rendered in the
 * mobile fallback area inside InteractionPanel.
 *
 * Source: CCM_Phase1_Agent_Interaction_Documentation.md
 */

import React from 'react';
import { Box, Grid2 as Grid } from '@mui/material';
import { useInteractionStore } from '@/features/interaction/interactionStore';
import { CustomerCard } from './CustomerCard';
import { VehicleCard } from './VehicleCard';
import { DealerCard } from './DealerCard';

interface ContextCardsProps {
  onChangeSelection?: () => void;
}

export function ContextCards({ onChangeSelection }: ContextCardsProps) {
  const { customerContext, vehicleContext, dealerContext } = useInteractionStore();

  return (
    <Box
      component="section"
      aria-label="Context Confirmed"
      sx={{ p: 2 }}
    >
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <CustomerCard
            data={customerContext}
            loading={false}
            error={null}
            onChangeSelection={onChangeSelection}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <VehicleCard
            data={vehicleContext}
            loading={false}
            error={null}
            dealerName={dealerContext?.dealerName ?? null}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 12, lg: 4 }}>
          <DealerCard
            data={dealerContext}
            loading={false}
            error={null}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

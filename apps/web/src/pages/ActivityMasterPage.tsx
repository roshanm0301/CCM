/**
 * ActivityMasterPage — Activity Master management page.
 *
 * Layout:
 * - GlobalHeader (fixed 64px)
 * - NavRail (fixed left, 56px on md+)
 * - Main content: catalog grid always visible; drawer overlays on right
 *
 * Source: CCM_Phase5_ActivityFlowConfiguration.md § Features 1–2
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { GlobalHeader } from '@/shared/components/GlobalHeader';
import { NavRail } from '@/shared/components/NavRail';
import { ActivityMasterList } from '@/features/activity-master/ActivityMasterList';
import { ActivityMasterDrawer } from '@/features/activity-master/ActivityMasterDrawer';
import { fetchActivities, type ActivityMasterDto } from '@/features/activity-master/activityMasterApi';

export function ActivityMasterPage() {
  const [activities, setActivities] = useState<ActivityMasterDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await fetchActivities();
      setActivities(data);
    } catch {
      setListError('Failed to load activities. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  function handleNew() {
    setEditId(null);
    setDrawerOpen(true);
  }

  function handleEdit(id: string) {
    setEditId(id);
    setDrawerOpen(true);
  }

  function handleClose() {
    setDrawerOpen(false);
    setEditId(null);
  }

  function handleSaved() {
    // Drawer stays open (managed internally); refresh the grid
    void loadActivities();
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <GlobalHeader />
      <NavRail activeItem="activities" />

      <Box
        sx={{
          mt: '64px',
          ml: { xs: 0, md: '56px' },
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 3,
        }}
      >
        <ActivityMasterList
          activities={activities}
          loading={loading}
          error={listError}
          onNew={handleNew}
          onEdit={handleEdit}
        />
      </Box>

      <ActivityMasterDrawer
        open={drawerOpen}
        editId={editId}
        onClose={handleClose}
        onSaved={handleSaved}
      />
    </Box>
  );
}

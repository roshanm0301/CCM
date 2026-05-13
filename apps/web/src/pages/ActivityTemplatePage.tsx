/**
 * ActivityTemplatePage — main page for Activity Template master management.
 *
 * Layout follows WorkspacePage / CaseCategoryPage pattern:
 * - GlobalHeader (fixed, 64px)
 * - NavRail (fixed left, 56px on md+)
 * - Main content (mt: 64px, ml: 56px on md+)
 *
 * Views:
 * - List view — catalog table + "New Activity Template" button
 * - Form view — create / edit form that replaces list view
 *
 * Source: CCM_Phase5_ActivityFlowConfiguration.md § Features 3–7
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { GlobalHeader } from '@/shared/components/GlobalHeader';
import { NavRail } from '@/shared/components/NavRail';
import { ActivityTemplateList } from '@/features/activity-template/ActivityTemplateList';
import { ActivityTemplateForm } from '@/features/activity-template/ActivityTemplateForm';
import {
  fetchTemplates,
  type ActivityTemplateSummaryDto,
} from '@/features/activity-template/activityTemplateApi';

type View = 'list' | 'form';

export function ActivityTemplatePage() {
  const [view, setView] = useState<View>('list');
  const [editId, setEditId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<ActivityTemplateSummaryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch {
      setListError('Failed to load activity templates. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'list') {
      void loadTemplates();
    }
  }, [view, loadTemplates]);

  function handleNew() {
    setEditId(null);
    setView('form');
  }

  function handleEdit(id: string) {
    setEditId(id);
    setView('form');
  }

  function handleCancel() {
    setEditId(null);
    setView('list');
  }

  function handleSaved() {
    setEditId(null);
    setView('list');
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Fixed 64px dark header */}
      <GlobalHeader />

      {/* Permanent left nav rail */}
      <NavRail activeItem="activity-templates" />

      {/* Main content */}
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
        {view === 'list' && (
          <ActivityTemplateList
            templates={templates}
            loading={loading}
            error={listError}
            onNew={handleNew}
            onEdit={handleEdit}
          />
        )}

        {view === 'form' && (
          <ActivityTemplateForm
            editId={editId}
            onCancel={handleCancel}
            onSaved={handleSaved}
          />
        )}
      </Box>
    </Box>
  );
}

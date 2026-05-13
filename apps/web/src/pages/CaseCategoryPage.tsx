/**
 * CaseCategoryPage — main page for Case Category master management.
 *
 * Layout follows WorkspacePage pattern:
 * - GlobalHeader (fixed, 64px)
 * - NavRail (fixed left, 56px on md+)
 * - Main content (mt: 64px, ml: 56px on md+)
 *
 * Views:
 * - List view — catalog table + "New Case Category" button
 * - Form view — create / edit form that replaces list view
 *
 * Source: CCM_Phase3_CaseCategory_Master.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { GlobalHeader } from '@/shared/components/GlobalHeader';
import { NavRail } from '@/shared/components/NavRail';
import { CaseCategoryList } from '@/features/case-category/CaseCategoryList';
import { CaseCategoryForm } from '@/features/case-category/CaseCategoryForm';
import { fetchCategories, type CategoryDto } from '@/features/case-category/caseCategoryApi';

type View = 'list' | 'form';

export function CaseCategoryPage() {
  const [view, setView] = useState<View>('list');
  const [editId, setEditId] = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch {
      setListError('Failed to load case categories. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'list') {
      void loadCategories();
    }
  }, [view, loadCategories]);

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
      <NavRail activeItem="case-categories" />

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
          <CaseCategoryList
            categories={categories}
            loading={loading}
            error={listError}
            onNew={handleNew}
            onEdit={handleEdit}
          />
        )}

        {view === 'form' && (
          <CaseCategoryForm editId={editId} onCancel={handleCancel} onSaved={handleSaved} />
        )}
      </Box>
    </Box>
  );
}

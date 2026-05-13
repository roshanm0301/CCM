/**
 * App shell — providers + router setup.
 *
 * Route structure:
 *   /login          — LoginPage (public)
 *   /workspace      — WorkspacePage (protected)
 *   /               — redirect to /workspace
 *   *               — 404
 *
 * Source: coding-standards.md, task brief §App
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline, Box, Typography } from '@mui/material';
import theme from '../../../../design-system/theme/theme';
import { ProtectedRoute } from './ProtectedRoute';
import { DealerProtectedRoute } from './DealerProtectedRoute';
import { useAuthStore } from '@/features/auth/authStore';
import '../assets/scss/main.scss';

// Lazy-load pages to keep initial bundle small
const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const WorkspacePage = lazy(() =>
  import('@/pages/WorkspacePage').then((m) => ({ default: m.WorkspacePage })),
);
const CaseCategoryPage = lazy(() =>
  import('@/pages/CaseCategoryPage').then((m) => ({ default: m.CaseCategoryPage })),
);
const ActivityMasterPage = lazy(() =>
  import('@/pages/ActivityMasterPage').then((m) => ({ default: m.ActivityMasterPage })),
);
const ActivityTemplatePage = lazy(() =>
  import('@/pages/ActivityTemplatePage').then((m) => ({ default: m.ActivityTemplatePage })),
);
const DealerCatalogPage = lazy(() =>
  import('@/pages/DealerCatalogPage').then((m) => ({ default: m.DealerCatalogPage })),
);
const CaseDetailPage = lazy(() =>
  import('@/pages/CaseDetailPage').then((m) => ({ default: m.CaseDetailPage })),
);
const InteractionsPage = lazy(() =>
  import('@/pages/InteractionsPage').then((m) => ({ default: m.InteractionsPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

interface AnyAuthRouteProps {
  children: React.ReactNode;
}

function AnyAuthRoute({ children }: AnyAuthRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/**
 * SmartDefaultRedirect — used for the "/" root route.
 * Routes authenticated users by role: dealers → /dealer-catalog, everyone else → /workspace.
 * Unauthenticated users → /login.
 */
function SmartDefaultRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isDealer        = useAuthStore((s) => s.isDealer);
  if (!isAuthenticated)            return <Navigate to="/login" replace />;
  if (isDealer)                    return <Navigate to="/dealer-catalog" replace />;
  return <Navigate to="/workspace" replace />;
}

function PageLoader() {
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      aria-live="polite"
      aria-label="Loading page"
    >
      <Typography variant="body2" color="text.secondary">
        Loading…
      </Typography>
    </Box>
  );
}

function NotFoundPage() {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={2}
    >
      <Typography variant="h2" color="text.primary">
        404
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Page not found.
      </Typography>
    </Box>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected */}
              <Route
                path="/workspace"
                element={
                  <ProtectedRoute>
                    <WorkspacePage />
                  </ProtectedRoute>
                }
              />

              {/* Case Category master */}
              <Route
                path="/case-categories"
                element={
                  <ProtectedRoute>
                    <CaseCategoryPage />
                  </ProtectedRoute>
                }
              />

              {/* Activity Master */}
              <Route
                path="/activity-master"
                element={
                  <ProtectedRoute>
                    <ActivityMasterPage />
                  </ProtectedRoute>
                }
              />

              {/* Activity Flow Templates */}
              <Route
                path="/activity-templates"
                element={
                  <ProtectedRoute>
                    <ActivityTemplatePage />
                  </ProtectedRoute>
                }
              />

              {/* Dealer Catalog */}
              <Route
                path="/dealer-catalog"
                element={
                  <DealerProtectedRoute>
                    <DealerCatalogPage />
                  </DealerProtectedRoute>
                }
              />

              {/* Interactions list */}
              <Route
                path="/interactions"
                element={
                  <ProtectedRoute>
                    <InteractionsPage />
                  </ProtectedRoute>
                }
              />

              {/* Case Detail — accessible by agents and dealers */}
              <Route
                path="/cases/:caseId"
                element={
                  <AnyAuthRoute>
                    <CaseDetailPage />
                  </AnyAuthRoute>
                }
              />

              {/* Default redirect — role-aware */}
              <Route path="/" element={<SmartDefaultRedirect />} />

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

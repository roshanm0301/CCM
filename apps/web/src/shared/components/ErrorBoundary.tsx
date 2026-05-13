/**
 * Reusable React Error Boundary component.
 *
 * Catches uncaught errors in the component subtree and renders a fallback UI
 * instead of crashing the entire application. Used to scope error surfaces to
 * individual panels (e.g. ResolutionActivityForm, FollowUpTab, DealerCatalogView)
 * so that a failure in one section does not unmount unrelated UI.
 *
 * Source: CCM code quality remediation plan — Wave 4 W4-1
 */

import React from 'react';
import { Alert, Box, Button } from '@mui/material';

// ---------------------------------------------------------------------------
// Props & State
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback. If omitted, a default alert + Refresh button renders. */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Log to console in development only — production error monitoring
    // should be wired here (e.g. Sentry) when available.
    if (import.meta.env.DEV) {
      console.error('[CCM] ErrorBoundary caught an error', error, info.componentStack);
    }
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box sx={{ p: 2 }}>
          <Alert
            severity="error"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={this.handleReset}
                aria-label="Retry"
              >
                Retry
              </Button>
            }
          >
            Something went wrong. Please try again or refresh the page.
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

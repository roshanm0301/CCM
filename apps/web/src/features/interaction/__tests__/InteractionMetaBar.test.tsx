/**
 * InteractionMetaBar — component tests.
 *
 * Covered scenarios:
 * 1. Renders interaction ID (truncated).
 * 2. Renders the elapsed timer.
 * 3. Status chip renders with correct label for each Phase 1 status.
 * 4. Status chip has the correct aria-label for each status.
 *
 * Source: ux-specification-v2.md Screen 6 §Interaction Meta Bar
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InteractionStatus } from '@ccm/types';
import { InteractionMetaBar } from '../InteractionMetaBar';

// ---------------------------------------------------------------------------
// ElapsedTimer uses setInterval — mock it to avoid async timer noise
// ---------------------------------------------------------------------------

vi.mock('../ElapsedTimer', () => ({
  ElapsedTimer: () => <span data-testid="elapsed-timer">0:00</span>,
}));

// ---------------------------------------------------------------------------
// Shared fixture: minimal required props
// ---------------------------------------------------------------------------

const BASE_PROPS = {
  interactionId: 'ia-test-001',
  startedAt: '2026-03-23T09:05:10.000Z',
  status: InteractionStatus.IDENTIFYING,
};

// =============================================================================
// Basic rendering
// =============================================================================

describe('InteractionMetaBar — basic rendering', () => {
  it('renders the truncated interaction ID', () => {
    render(<InteractionMetaBar {...BASE_PROPS} />);

    // interactionId 'ia-test-001' is 10 chars — truncated to first 8 + ellipsis
    expect(screen.getByLabelText(/Interaction ID ia-test-001/)).toBeInTheDocument();
  });

  it('renders the elapsed timer', () => {
    render(<InteractionMetaBar {...BASE_PROPS} />);

    expect(screen.getByTestId('elapsed-timer')).toBeInTheDocument();
  });
});

// =============================================================================
// Status chip — label and aria-label for each Phase 1 status
// =============================================================================

describe('InteractionMetaBar — status chip', () => {
  const statusCases: [InteractionStatus, string][] = [
    [InteractionStatus.IDENTIFYING, 'Identifying'],
    [InteractionStatus.CONTEXT_CONFIRMED, 'Context Confirmed'],
    [InteractionStatus.WRAPUP, 'Wrap-up'],
    [InteractionStatus.CLOSED, 'Closed'],
    [InteractionStatus.INCOMPLETE, 'Incomplete'],
  ];

  it.each(statusCases)(
    'renders chip label "%s" for status %s',
    (status, expectedLabel) => {
      render(<InteractionMetaBar {...BASE_PROPS} status={status} />);

      expect(screen.getByLabelText(new RegExp(`Interaction status: ${expectedLabel}`, 'i'))).toBeInTheDocument();
    },
  );
});

/**
 * IdleWorkspace — component tests.
 *
 * All CTAs (Start Interaction, Make a Call) have moved to GlobalHeader.
 * IdleWorkspace is now a plain empty <Box component="main"> placeholder.
 *
 * Covered scenarios:
 * 1. Renders without crashing.
 * 2. Renders a <main> element (role="main").
 * 3. Accepts and ignores the onInteractionStarted prop without errors.
 *
 * Sources: IdleWorkspace.tsx
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IdleWorkspace } from '../IdleWorkspace';

// IdleWorkspace is now a plain empty <Box component="main"> placeholder.
// All CTAs (Start Interaction, Make a Call) have moved to GlobalHeader.

describe('IdleWorkspace', () => {
  it('renders without crashing', () => {
    const onInteractionStarted = vi.fn();
    expect(() =>
      render(<IdleWorkspace onInteractionStarted={onInteractionStarted} />),
    ).not.toThrow();
  });

  it('renders a main landmark element', () => {
    render(<IdleWorkspace onInteractionStarted={vi.fn()} />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('does not render any buttons', () => {
    render(<IdleWorkspace onInteractionStarted={vi.fn()} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
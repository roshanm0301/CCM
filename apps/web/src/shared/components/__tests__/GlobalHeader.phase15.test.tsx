/**
 * GlobalHeader — Phase 1.5 session-mode rendering tests.
 *
 * Covered scenarios:
 * N14 — Manual mode: shows "New Interaction" button, NOT AgentStatusWidget
 * N15 — CTI mode, on_call: shows read-only chip "On Call", NOT interactive dropdown
 * N16 — CTI mode, wrap_up: shows read-only chip "Wrap Up", NOT interactive dropdown
 * N16b — CTI mode, ready_for_calls: shows interactive AgentStatusWidget
 *
 * Source: GlobalHeader.tsx, CCM Phase 1.5 spec
 * Note: GlobalHeader uses useNavigate — wrap in MemoryRouter.
 *       AgentStatusWidget is mocked to avoid double-store hydration in header tests.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AgentStatus } from '@ccm/types';

// ---------------------------------------------------------------------------
// Mock apiClient (GlobalHeader calls apiClient.post for logout / new interaction)
// ---------------------------------------------------------------------------

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock AgentStatusWidget — isolate GlobalHeader rendering from widget internals
// The widget itself has its own test suite. Here we only verify whether it
// appears or not based on sessionMode / currentStatus.
// ---------------------------------------------------------------------------

vi.mock('@/features/agent-status/AgentStatusWidget', () => ({
  AgentStatusWidget: () => (
    <div data-testid="agent-status-widget" role="button" aria-label="Agent status widget">
      AgentStatusWidget
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Store mocks — controlled per describe block via mockReturnValue
// ---------------------------------------------------------------------------

const mockAuthStore = vi.fn();
const mockAgentStatusStore = vi.fn();
const mockInteractionStore = vi.fn();

vi.mock('@/features/auth/authStore', () => ({
  useAuthStore: (...args: unknown[]) => mockAuthStore(...args),
}));

vi.mock('@/features/agent-status/agentStatusStore', () => ({
  useAgentStatusStore: (...args: unknown[]) => mockAgentStatusStore(...args),
}));

vi.mock('@/features/interaction/interactionStore', () => ({
  useInteractionStore: (...args: unknown[]) => mockInteractionStore(...args),
}));

import { GlobalHeader } from '../GlobalHeader';

// ---------------------------------------------------------------------------
// Shared mock user
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: 'user-1',
  username: 'agent.one',
  displayName: 'Agent One',
  roles: ['agent'],
  dealerRef: null,
};

// ---------------------------------------------------------------------------
// Render helper — always wraps in MemoryRouter (GlobalHeader uses useNavigate)
// ---------------------------------------------------------------------------

function renderHeader() {
  return render(
    <MemoryRouter>
      <GlobalHeader />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Reset mocks before every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Safe defaults — override in each describe block as needed
  mockInteractionStore.mockReturnValue({
    interactionId: null,
    setInteraction: vi.fn(),
    resumeInteraction: vi.fn(),
  });
});

// ---------------------------------------------------------------------------
// N14 — Manual mode: "New Interaction" button rendered; AgentStatusWidget absent
// ---------------------------------------------------------------------------

describe('N14 — Manual mode renders "New Interaction" button', () => {
  beforeEach(() => {
    mockAuthStore.mockReturnValue({
      user: MOCK_USER,
      clearAuth: vi.fn(),
      sessionMode: 'manual',
    });
    mockAgentStatusStore.mockReturnValue({
      currentStatus: AgentStatus.OFFLINE,
    });
  });

  it('renders the "New Interaction" button', () => {
    renderHeader();

    expect(
      screen.getByRole('button', { name: /Start a new interaction/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render the AgentStatusWidget', () => {
    renderHeader();

    expect(screen.queryByTestId('agent-status-widget')).not.toBeInTheDocument();
  });

  it('does NOT render an On Call chip', () => {
    renderHeader();

    expect(screen.queryByText('On Call')).not.toBeInTheDocument();
  });

  it('"New Interaction" button is enabled regardless of agent status in manual mode', () => {
    // In manual mode, agent status gating is intentionally skipped — the
    // AgentStatusWidget is not shown in manual mode, so agents cannot change
    // their status, and manual interactions don't depend on call-routing readiness.
    // canStartInteraction = !hasActiveInteraction (no status check).
    renderHeader();

    const btn = screen.getByRole('button', { name: /Start a new interaction/i });
    expect(btn).toBeEnabled();
  });

  it('"New Interaction" button is enabled when agent is ready_for_calls and no active interaction', () => {
    mockAgentStatusStore.mockReturnValue({
      currentStatus: AgentStatus.READY_FOR_CALLS,
    });

    renderHeader();

    const btn = screen.getByRole('button', { name: /Start a new interaction/i });
    expect(btn).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// N15 — CTI mode, on_call: read-only "On Call" chip; no status dropdown
// ---------------------------------------------------------------------------

describe('N15 — CTI mode with on_call shows read-only "On Call" chip', () => {
  beforeEach(() => {
    mockAuthStore.mockReturnValue({
      user: MOCK_USER,
      clearAuth: vi.fn(),
      sessionMode: 'cti',
    });
    mockAgentStatusStore.mockReturnValue({
      currentStatus: AgentStatus.ON_CALL,
    });
  });

  it('renders a chip with text "On Call"', () => {
    renderHeader();

    expect(screen.getByText('On Call')).toBeInTheDocument();
  });

  it('does NOT render the AgentStatusWidget', () => {
    renderHeader();

    expect(screen.queryByTestId('agent-status-widget')).not.toBeInTheDocument();
  });

  it('does NOT render the "New Interaction" button', () => {
    renderHeader();

    expect(
      screen.queryByRole('button', { name: /Start a new interaction/i }),
    ).not.toBeInTheDocument();
  });

  it('"On Call" chip has the correct system status aria-label', () => {
    renderHeader();

    // The Chip has aria-label="System status: On Call — call in progress"
    expect(
      screen.getByLabelText(/System status: On Call/i),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// N16 — CTI mode, wrap_up: read-only "Wrap Up" chip; no status dropdown
// ---------------------------------------------------------------------------

describe('N16 — CTI mode with wrap_up shows read-only "Wrap Up" chip', () => {
  beforeEach(() => {
    mockAuthStore.mockReturnValue({
      user: MOCK_USER,
      clearAuth: vi.fn(),
      sessionMode: 'cti',
    });
    mockAgentStatusStore.mockReturnValue({
      currentStatus: AgentStatus.WRAP_UP,
    });
  });

  it('renders a chip with text "Wrap Up"', () => {
    renderHeader();

    expect(screen.getByText('Wrap Up')).toBeInTheDocument();
  });

  it('does NOT render the AgentStatusWidget', () => {
    renderHeader();

    expect(screen.queryByTestId('agent-status-widget')).not.toBeInTheDocument();
  });

  it('does NOT render the "New Interaction" button', () => {
    renderHeader();

    expect(
      screen.queryByRole('button', { name: /Start a new interaction/i }),
    ).not.toBeInTheDocument();
  });

  it('"Wrap Up" chip has the correct system status aria-label', () => {
    renderHeader();

    expect(
      screen.getByLabelText(/System status: Wrap Up/i),
    ).toBeInTheDocument();
  });

  it('does NOT render an "On Call" chip when status is wrap_up', () => {
    renderHeader();

    expect(screen.queryByText('On Call')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// N16b — CTI mode, ready_for_calls: AgentStatusWidget rendered (interactive)
// ---------------------------------------------------------------------------

describe('N16b — CTI mode with ready_for_calls renders AgentStatusWidget', () => {
  beforeEach(() => {
    mockAuthStore.mockReturnValue({
      user: MOCK_USER,
      clearAuth: vi.fn(),
      sessionMode: 'cti',
    });
    mockAgentStatusStore.mockReturnValue({
      currentStatus: AgentStatus.READY_FOR_CALLS,
    });
  });

  it('renders the AgentStatusWidget', () => {
    renderHeader();

    expect(screen.getByTestId('agent-status-widget')).toBeInTheDocument();
  });

  it('does NOT render the "New Interaction" button', () => {
    renderHeader();

    expect(
      screen.queryByRole('button', { name: /Start a new interaction/i }),
    ).not.toBeInTheDocument();
  });

  it('does NOT render an On Call or Wrap Up read-only chip', () => {
    renderHeader();

    expect(screen.queryByText('On Call')).not.toBeInTheDocument();
    expect(screen.queryByText('Wrap Up')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// N16b (bonus) — CTI mode, offline: AgentStatusWidget rendered (not read-only)
// ---------------------------------------------------------------------------

describe('N16b (offline variant) — CTI mode with offline renders AgentStatusWidget', () => {
  it('renders AgentStatusWidget when CTI + offline (not a system-managed status)', () => {
    mockAuthStore.mockReturnValue({
      user: MOCK_USER,
      clearAuth: vi.fn(),
      sessionMode: 'cti',
    });
    mockAgentStatusStore.mockReturnValue({
      currentStatus: AgentStatus.OFFLINE,
    });
    mockInteractionStore.mockReturnValue({
      interactionId: null,
      setInteraction: vi.fn(),
      resumeInteraction: vi.fn(),
    });

    renderHeader();

    expect(screen.getByTestId('agent-status-widget')).toBeInTheDocument();
    expect(screen.queryByText('On Call')).not.toBeInTheDocument();
    expect(screen.queryByText('Wrap Up')).not.toBeInTheDocument();
  });
});

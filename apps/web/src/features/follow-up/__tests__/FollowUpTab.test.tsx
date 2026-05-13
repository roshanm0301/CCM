/**
 * FollowUpTab — Vitest + React Testing Library unit tests.
 *
 * Covered scenarios:
 * 1. API unwrapping — fetchFollowUps correctly reads res.data.data (not res.data)
 * 2. Closed case — "Add Follow Up" button hidden; info alert shown
 * 3. Agent role + open case — "Add Follow Up" button shown
 * 4. Dealer role + open case — "Add Follow Up" button NOT shown
 * 5. Add follow-up happy path — fill form, save, post called with correct payload, snackbar shown
 * 6. Validation — save without filling remarks shows errors, post NOT called
 * 7. History sort — most recent entry shown first
 * 8. Empty history — "No follow-ups have been added yet." shown (OLD text — now stale; see test 10)
 * 9. API error — "Failed to load follow-up history." alert shown
 * 10. Empty state wording — "No follow-ups have been added yet." (NEW canonical text)
 * 11. callRecordingLink present — "View Recording" link rendered with correct href
 * 12. callRecordingLink null — "View Recording" link NOT rendered
 *
 * Source: CCM Phase 6 Resolution Activities spec.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Hoist mocks so vi.mock factory can reference them
// ---------------------------------------------------------------------------

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
}));

// ---------------------------------------------------------------------------
// Import component after mocks are established
// ---------------------------------------------------------------------------

import { FollowUpTab } from '../FollowUpTab';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

interface RenderOptions {
  caseId?: string;
  caseStatus?: string;
  userRoles?: string[];
}

function renderFollowUpTab(options: RenderOptions = {}) {
  const {
    caseId = 'CASE-001',
    caseStatus = 'Open',
    userRoles = ['agent'],
  } = options;

  const queryClient = makeQueryClient();

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <FollowUpTab caseId={caseId} caseStatus={caseStatus} userRoles={userRoles} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTRY_OLD = {
  id: 'fu-1',
  caseId: 'CASE-001',
  customerRemarks: 'Customer called about delay',
  agentRemarks: 'Acknowledged, escalated',
  agentName: 'Agent Alpha',
  callRecordingLink: null,
  createdAt: '2026-03-01T10:00:00.000Z',
};

const ENTRY_RECENT = {
  id: 'fu-2',
  caseId: 'CASE-001',
  customerRemarks: 'Follow-up after resolution',
  agentRemarks: 'Issue resolved, closing soon',
  agentName: 'Agent Beta',
  callRecordingLink: null,
  createdAt: '2026-03-10T14:00:00.000Z',
};

// Standard API envelope used by fetchFollowUps
function apiEnvelope(data: unknown) {
  return { data: { success: true, data } };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// 1. API unwrapping — res.data.data
// ---------------------------------------------------------------------------

describe('FollowUpTab — API unwrapping', () => {
  it('renders entry from res.data.data (not res.data)', async () => {
    mockGet.mockResolvedValueOnce(apiEnvelope([ENTRY_OLD]));

    renderFollowUpTab({ userRoles: ['agent'] });

    await waitFor(() => {
      expect(screen.getByText('Agent Alpha')).toBeInTheDocument();
    });

    expect(screen.getByText('Customer called about delay')).toBeInTheDocument();
    expect(screen.getByText('Acknowledged, escalated')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Closed case — no "Add Follow Up"; info alert shown
// ---------------------------------------------------------------------------

describe('FollowUpTab — closed case', () => {
  it('does NOT show "Add Follow Up" button when case is closed', async () => {
    mockGet.mockResolvedValueOnce(apiEnvelope([]));

    renderFollowUpTab({ caseStatus: 'Closed – Verified', userRoles: ['agent'] });

    // Wait for query to settle
    await waitFor(() =>
      expect(screen.queryByText('No follow-ups have been added yet.')).toBeInTheDocument(),
    );

    expect(screen.queryByRole('button', { name: /add follow up/i })).not.toBeInTheDocument();
  });

  it('shows info alert when case is closed', async () => {
    mockGet.mockResolvedValueOnce(apiEnvelope([]));

    renderFollowUpTab({ caseStatus: 'Closed – Verified', userRoles: ['agent'] });

    expect(
      screen.getByText(/follow-up creation is disabled for closed cases/i),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Agent role + open case — button shown
// ---------------------------------------------------------------------------

describe('FollowUpTab — agent role', () => {
  it('shows "Add Follow Up" button for agent on an open case', async () => {
    mockGet.mockResolvedValueOnce(apiEnvelope([]));

    renderFollowUpTab({ caseStatus: 'Open', userRoles: ['agent'] });

    expect(
      await screen.findByRole('button', { name: /add follow up/i }),
    ).toBeInTheDocument();
  });

  it('shows "Add Follow Up" button for ccm_agent on an open case', async () => {
    mockGet.mockResolvedValueOnce(apiEnvelope([]));

    renderFollowUpTab({ caseStatus: 'Open', userRoles: ['ccm_agent'] });

    expect(
      await screen.findByRole('button', { name: /add follow up/i }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. Dealer role + open case — button NOT shown
// ---------------------------------------------------------------------------

describe('FollowUpTab — dealer role', () => {
  it('does NOT show "Add Follow Up" button for dealer_sales on an open case', async () => {
    mockGet.mockResolvedValueOnce(apiEnvelope([]));

    renderFollowUpTab({ caseStatus: 'Open', userRoles: ['dealer_sales'] });

    // Let query settle
    await waitFor(() =>
      expect(screen.queryByText('No follow-ups have been added yet.')).toBeInTheDocument(),
    );

    expect(screen.queryByRole('button', { name: /add follow up/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. Add follow-up happy path
// ---------------------------------------------------------------------------

describe('FollowUpTab — add follow-up happy path', () => {
  it('calls apiClient.post with correct payload and shows success snackbar', async () => {
    const user = userEvent.setup();

    // Initial load returns empty history
    mockGet.mockResolvedValue(apiEnvelope([]));

    // Post returns the new entry
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: 'fu-new',
          caseId: 'CASE-001',
          customerRemarks: 'Test customer remark',
          agentRemarks: 'Test agent remark',
          agentName: 'Agent Test',
          callRecordingLink: null,
          createdAt: new Date().toISOString(),
        },
      },
    });

    renderFollowUpTab({ caseStatus: 'Open', userRoles: ['agent'] });

    // Open form
    const addButton = await screen.findByRole('button', { name: /add follow up/i });
    await user.click(addButton);

    // Fill customer remarks (fireEvent.change is instant; avoids char-by-char timeout)
    const customerInput = screen.getByRole('textbox', { name: /customer remarks/i });
    fireEvent.change(customerInput, { target: { value: 'Test customer remark' } });

    // Fill agent remarks
    const agentInput = screen.getByRole('textbox', { name: /agent remarks/i });
    fireEvent.change(agentInput, { target: { value: 'Test agent remark' } });

    // Click Save (button is now enabled because both fields are filled)
    const saveButton = screen.getByRole('button', { name: /save follow up/i });
    fireEvent.click(saveButton);

    // apiClient.post called with correct payload
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/v1/follow-ups', {
        caseId: 'CASE-001',
        customerRemarks: 'Test customer remark',
        agentRemarks: 'Test agent remark',
      });
    });

    // Success snackbar appears
    await waitFor(() => {
      expect(screen.getByText('Follow-up saved successfully.')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Validation — save without filling remarks
// ---------------------------------------------------------------------------

describe('FollowUpTab — form validation', () => {
  it('shows error messages and does NOT call post when Save clicked with empty fields', async () => {
    const user = userEvent.setup();

    mockGet.mockResolvedValueOnce(apiEnvelope([]));

    renderFollowUpTab({ caseStatus: 'Open', userRoles: ['agent'] });

    // Open form
    const addButton = await screen.findByRole('button', { name: /add follow up/i });
    await user.click(addButton);

    // Blur both inputs without entering text — triggers onBlur → setTouched → validation errors
    const customerInput = screen.getByRole('textbox', { name: /customer remarks/i });
    const agentInput = screen.getByRole('textbox', { name: /agent remarks/i });
    fireEvent.blur(customerInput);
    fireEvent.blur(agentInput);

    // Error messages should appear
    await waitFor(() => {
      expect(screen.getByText('Customer remarks are required.')).toBeInTheDocument();
      expect(screen.getByText('Agent remarks are required.')).toBeInTheDocument();
    });

    // post should NOT have been called
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('Save button is disabled when both fields are empty', async () => {
    const user = userEvent.setup();

    mockGet.mockResolvedValueOnce(apiEnvelope([]));

    renderFollowUpTab({ caseStatus: 'Open', userRoles: ['agent'] });

    // Open form
    const addButton = await screen.findByRole('button', { name: /add follow up/i });
    await user.click(addButton);

    // Before filling anything the Save button should be disabled
    const saveButton = screen.getByRole('button', { name: /save follow up/i });
    expect(saveButton).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// 7. History sort — most recent first
// ---------------------------------------------------------------------------

describe('FollowUpTab — history sort order', () => {
  it('renders the most recent entry before the older entry', async () => {
    // ENTRY_RECENT (2026-03-10) should appear before ENTRY_OLD (2026-03-01)
    mockGet.mockResolvedValueOnce(apiEnvelope([ENTRY_OLD, ENTRY_RECENT]));

    renderFollowUpTab({ userRoles: ['agent'] });

    await waitFor(() => {
      expect(screen.getByText('Agent Alpha')).toBeInTheDocument();
      expect(screen.getByText('Agent Beta')).toBeInTheDocument();
    });

    const agentNames = screen.getAllByText(/Agent (Alpha|Beta)/);
    // Agent Beta (recent) should appear first in DOM order
    expect(agentNames[0]).toHaveTextContent('Agent Beta');
    expect(agentNames[1]).toHaveTextContent('Agent Alpha');
  });
});

// ---------------------------------------------------------------------------
// 8. Empty history
// ---------------------------------------------------------------------------

describe('FollowUpTab — empty history', () => {
  it('shows "No follow-ups have been added yet." when API returns empty array', async () => {
    mockGet.mockResolvedValueOnce(apiEnvelope([]));

    renderFollowUpTab({ userRoles: ['agent'] });

    await waitFor(() => {
      expect(screen.getByText('No follow-ups have been added yet.')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 9. API error
// ---------------------------------------------------------------------------

describe('FollowUpTab — API error', () => {
  it('shows "Failed to load follow-up history." alert when fetch throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    renderFollowUpTab({ userRoles: ['agent'] });

    await waitFor(() => {
      expect(screen.getByText('Failed to load follow-up history.')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 10. Empty state wording — new canonical text
// ---------------------------------------------------------------------------

describe('FollowUpTab — empty state wording (test 10)', () => {
  it('shows "No follow-ups have been added yet." when API returns empty array', async () => {
    mockGet.mockResolvedValueOnce(apiEnvelope([]));

    renderFollowUpTab({ userRoles: ['agent'] });

    await waitFor(() => {
      expect(
        screen.getByText('No follow-ups have been added yet.'),
      ).toBeInTheDocument();
    });
  });

  it('does NOT show the old text "No follow-ups recorded yet."', async () => {
    mockGet.mockResolvedValueOnce(apiEnvelope([]));

    renderFollowUpTab({ userRoles: ['agent'] });

    await waitFor(() => {
      // New text must be present
      expect(
        screen.getByText('No follow-ups have been added yet.'),
      ).toBeInTheDocument();
    });

    // Old text must be absent
    expect(screen.queryByText('No follow-ups recorded yet.')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 11. callRecordingLink present — "View Recording" link rendered
//
// The link is rendered as MUI Link (which outputs an <a> element in the DOM).
// The section label is "Call Recording Link".
// An OpenInNewIcon svg is rendered alongside the link text.
// ---------------------------------------------------------------------------

describe('FollowUpTab — callRecordingLink present (test 11)', () => {
  it('renders a "View Recording" link (MUI Link as <a>) pointing to callRecordingLink URL', async () => {
    const entryWithLink = {
      ...ENTRY_OLD,
      callRecordingLink: 'https://example.com/rec.mp3',
    };

    mockGet.mockResolvedValueOnce(apiEnvelope([entryWithLink]));

    renderFollowUpTab({ userRoles: ['agent'] });

    // MUI Link renders as <a> — findByRole('link') correctly locates it
    const link = await screen.findByRole('link', { name: /view recording/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/rec.mp3');
  });

  it('opens the recording link in a new tab (target=_blank, rel=noopener noreferrer)', async () => {
    const entryWithLink = {
      ...ENTRY_OLD,
      callRecordingLink: 'https://example.com/rec.mp3',
    };

    mockGet.mockResolvedValueOnce(apiEnvelope([entryWithLink]));

    renderFollowUpTab({ userRoles: ['agent'] });

    const link = await screen.findByRole('link', { name: /view recording/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows the section label "Call Recording Link" (not "Call Recording")', async () => {
    const entryWithLink = {
      ...ENTRY_OLD,
      callRecordingLink: 'https://example.com/rec.mp3',
    };

    mockGet.mockResolvedValueOnce(apiEnvelope([entryWithLink]));

    renderFollowUpTab({ userRoles: ['agent'] });

    // Wait for the entry to render
    await screen.findByRole('link', { name: /view recording/i });

    expect(screen.getByText('Call Recording Link')).toBeInTheDocument();
    // Guard against the old label text
    expect(screen.queryByText('Call Recording')).not.toBeInTheDocument();
  });

  it('renders an OpenInNew svg icon alongside the "View Recording" link', async () => {
    const entryWithLink = {
      ...ENTRY_OLD,
      callRecordingLink: 'https://example.com/rec.mp3',
    };

    mockGet.mockResolvedValueOnce(apiEnvelope([entryWithLink]));

    renderFollowUpTab({ userRoles: ['agent'] });

    const link = await screen.findByRole('link', { name: /view recording/i });

    // OpenInNewIcon renders as an <svg> element inside the link
    const svgInsideLink = link.querySelector('svg');
    expect(svgInsideLink).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 12. callRecordingLink null — "View Recording" link NOT rendered
// ---------------------------------------------------------------------------

describe('FollowUpTab — callRecordingLink null (test 12)', () => {
  it('does NOT render a "View Recording" link when callRecordingLink is null', async () => {
    // ENTRY_OLD has callRecordingLink: null
    mockGet.mockResolvedValueOnce(apiEnvelope([ENTRY_OLD]));

    renderFollowUpTab({ userRoles: ['agent'] });

    // Wait for the entry to appear
    await waitFor(() => {
      expect(screen.getByText('Agent Alpha')).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: /view recording/i })).not.toBeInTheDocument();
  });

  it('does NOT render a "View Recording" link when callRecordingLink is absent from entry', async () => {
    const entryWithoutLink = {
      id: 'fu-3',
      caseId: 'CASE-001',
      customerRemarks: 'Test',
      agentRemarks: 'Test agent',
      agentName: 'Agent Gamma',
      // callRecordingLink field omitted entirely
      createdAt: '2026-03-15T09:00:00.000Z',
    };

    mockGet.mockResolvedValueOnce(apiEnvelope([entryWithoutLink]));

    renderFollowUpTab({ userRoles: ['agent'] });

    await waitFor(() => {
      expect(screen.getByText('Agent Gamma')).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: /view recording/i })).not.toBeInTheDocument();
  });
});

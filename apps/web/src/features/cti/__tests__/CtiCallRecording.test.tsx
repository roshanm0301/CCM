/**
 * CtiCallRecording — Vitest + React Testing Library unit tests.
 *
 * Covered scenarios:
 * 1.  Returns null (renders nothing) when channel = 'manual'
 * 2.  Returns null when channel = null
 * 3.  Shows LinearProgress while query is loading (channel = 'inbound_call')
 * 4.  Shows "No call recording available" when hasRecording: false
 * 5.  Shows warning Alert when isError is true
 * 6.  Renders <audio> element with correct src when hasRecording: true
 * 7.  useQuery is configured with staleTime: 0 (not the old 5-minute value)
 * 8.  useQuery is configured with a refetchInterval function (not a static number)
 * 9.  refetchInterval returns false immediately when hasRecording: true
 * 10. refetchInterval returns 20000 when hasRecording: false and within 3 min
 * 11. refetchIntervalInBackground: false is set
 *
 * Source: CtiCallRecording.tsx, CCM Phase 1.5 — call recording playback
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Hoist mock variables so vi.mock() factories can reference them
// ---------------------------------------------------------------------------

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock apiClient — used by the component's queryFn
// ---------------------------------------------------------------------------

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: mockGet,
  },
}));

// ---------------------------------------------------------------------------
// Import component after mocks
// ---------------------------------------------------------------------------

import { CtiCallRecording } from '../CtiCallRecording';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

interface WrapperProps {
  interactionId?: string;
  channel: 'inbound_call' | 'manual' | null;
}

function renderComponent({ interactionId = 'INT-001', channel }: WrapperProps) {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CtiCallRecording interactionId={interactionId} channel={channel} />
    </QueryClientProvider>,
  );
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

// ===========================================================================
// 1. channel = 'manual' → renders nothing
// ===========================================================================

describe('CtiCallRecording — channel manual (test 1)', () => {
  it('renders nothing when channel is "manual"', () => {
    // Query is disabled for non-inbound_call — we still need GET to not blow up
    mockGet.mockResolvedValue({ data: { success: true, data: { hasRecording: false } } });

    const { container } = renderComponent({ channel: 'manual' });

    // The component should return null — container should be empty
    expect(container.firstChild).toBeNull();
  });
});

// ===========================================================================
// 2. channel = null → renders nothing
// ===========================================================================

describe('CtiCallRecording — channel null (test 2)', () => {
  it('renders nothing when channel is null', () => {
    mockGet.mockResolvedValue({ data: { success: true, data: { hasRecording: false } } });

    const { container } = renderComponent({ channel: null });

    expect(container.firstChild).toBeNull();
  });
});

// ===========================================================================
// 3. Loading state — shows LinearProgress
// ===========================================================================

describe('CtiCallRecording — loading state (test 3)', () => {
  it('shows LinearProgress while the recording status query is loading', () => {
    // Never-resolving promise keeps component in loading state indefinitely
    mockGet.mockReturnValue(new Promise(() => {}));

    renderComponent({ channel: 'inbound_call' });

    // MUI LinearProgress renders with role="progressbar"
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    // Descriptive caption also rendered
    expect(screen.getByText('Checking for recording…')).toBeInTheDocument();
  });

  it('does NOT show the audio player while loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    renderComponent({ channel: 'inbound_call' });

    expect(document.querySelector('audio')).toBeNull();
  });
});

// ===========================================================================
// 4. hasRecording: false → "No call recording available."
// ===========================================================================

describe('CtiCallRecording — no recording available (test 4)', () => {
  it('shows "No call recording available." when hasRecording is false', async () => {
    mockGet.mockResolvedValue({
      data: { success: true, data: { hasRecording: false } },
    });

    renderComponent({ channel: 'inbound_call' });

    // Wait for the async query to settle and the component to re-render
    expect(
      await screen.findByText('No call recording available.'),
    ).toBeInTheDocument();
  });

  it('does NOT render an audio element when hasRecording is false', async () => {
    mockGet.mockResolvedValue({
      data: { success: true, data: { hasRecording: false } },
    });

    renderComponent({ channel: 'inbound_call' });

    await screen.findByText('No call recording available.');

    expect(document.querySelector('audio')).toBeNull();
  });
});

// ===========================================================================
// 5. isError → warning Alert
// ===========================================================================

describe('CtiCallRecording — query error (test 5)', () => {
  it('shows a warning Alert when the recording status query fails', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    renderComponent({ channel: 'inbound_call' });

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('Recording unavailable')).toBeInTheDocument();
  });

  it('does NOT render an audio element when the query has errored', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    renderComponent({ channel: 'inbound_call' });

    await screen.findByRole('alert');

    expect(document.querySelector('audio')).toBeNull();
  });
});

// ===========================================================================
// 6. hasRecording: true → <audio> element with correct src
// ===========================================================================

describe('CtiCallRecording — recording present (test 6)', () => {
  it('renders an <audio> element when hasRecording is true', async () => {
    mockGet.mockResolvedValue({
      data: { success: true, data: { hasRecording: true, filename: 'call.wav' } },
    });

    renderComponent({ channel: 'inbound_call', interactionId: 'INT-999' });

    // Wait for data to load
    await screen.findByLabelText('Call recording audio player');

    const audioEl = document.querySelector('audio');
    expect(audioEl).not.toBeNull();
  });

  it('audio element src points to the proxy endpoint with the correct interactionId', async () => {
    mockGet.mockResolvedValue({
      data: { success: true, data: { hasRecording: true, filename: 'call.wav' } },
    });

    renderComponent({ channel: 'inbound_call', interactionId: 'INT-999' });

    await screen.findByLabelText('Call recording audio player');

    const audioEl = document.querySelector('audio') as HTMLAudioElement;
    expect(audioEl.getAttribute('src')).toBe('/api/v1/cti/recording/INT-999');
  });

  it('audio element has controls attribute', async () => {
    mockGet.mockResolvedValue({
      data: { success: true, data: { hasRecording: true } },
    });

    renderComponent({ channel: 'inbound_call', interactionId: 'INT-001' });

    await screen.findByLabelText('Call recording audio player');

    const audioEl = document.querySelector('audio') as HTMLAudioElement;
    expect(audioEl).toHaveAttribute('controls');
  });
});

// ===========================================================================
// Tests 7–11 — useQuery option inspection
//
// Strategy: mock @tanstack/react-query so the useQuery call is intercepted and
// its options object is captured for assertion. We then verify specific option
// values without running the real query machinery.
// ===========================================================================

describe('CtiCallRecording — useQuery option inspection (tests 7–11)', { timeout: 60_000 }, () => {
  // Capture the options passed to useQuery during render
  let capturedOptions: Parameters<typeof import('@tanstack/react-query').useQuery>[0] | null = null;

  beforeEach(() => {
    capturedOptions = null;
    vi.resetModules();

    // Mock useQuery — capture options and return a stable loading state so
    // the component renders without hitting any real query logic.
    vi.doMock('@tanstack/react-query', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@tanstack/react-query')>();
      return {
        ...actual,
        useQuery: (options: Parameters<typeof actual.useQuery>[0]) => {
          capturedOptions = options;
          // Return loading state so the component doesn't attempt DOM-intensive rendering
          return {
            data: undefined,
            isLoading: true,
            isError: false,
          } as ReturnType<typeof actual.useQuery>;
        },
      };
    });
  });

  afterEach(() => {
    vi.doUnmock('@tanstack/react-query');
  });

  // -------------------------------------------------------------------------
  // 7. staleTime: 0
  // -------------------------------------------------------------------------

  it('(test 7) useQuery is configured with staleTime: 0', async () => {
    // Dynamically re-import the component so it picks up the mocked useQuery
    const { CtiCallRecording: FreshComponent } = await import('../CtiCallRecording');

    const queryClient = makeQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <FreshComponent interactionId="INT-100" channel="inbound_call" />
      </QueryClientProvider>,
    );

    expect(capturedOptions).not.toBeNull();
    expect(capturedOptions!.staleTime).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 8. refetchInterval is a function (not a static number)
  // -------------------------------------------------------------------------

  it('(test 8) refetchInterval is a function, not a static number', async () => {
    const { CtiCallRecording: FreshComponent } = await import('../CtiCallRecording');

    const queryClient = makeQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <FreshComponent interactionId="INT-100" channel="inbound_call" />
      </QueryClientProvider>,
    );

    expect(capturedOptions).not.toBeNull();
    expect(typeof capturedOptions!.refetchInterval).toBe('function');
  });

  // -------------------------------------------------------------------------
  // 9. refetchInterval returns false when hasRecording: true
  // -------------------------------------------------------------------------

  it('(test 9) refetchInterval returns false immediately when hasRecording is true', async () => {
    const { CtiCallRecording: FreshComponent } = await import('../CtiCallRecording');

    const queryClient = makeQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <FreshComponent interactionId="INT-100" channel="inbound_call" />
      </QueryClientProvider>,
    );

    expect(capturedOptions).not.toBeNull();

    const fn = capturedOptions!.refetchInterval as (query: { state: { data?: { hasRecording: boolean } } }) => number | false;

    // Simulate a query state where recording is already present
    const result = fn({ state: { data: { hasRecording: true } } });
    expect(result).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 10. refetchInterval returns 20000 when hasRecording: false within 3 min
  // -------------------------------------------------------------------------

  it('(test 10) refetchInterval returns 20000 when hasRecording is false and within 3 minutes', async () => {
    const { CtiCallRecording: FreshComponent } = await import('../CtiCallRecording');

    const queryClient = makeQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <FreshComponent interactionId="INT-100" channel="inbound_call" />
      </QueryClientProvider>,
    );

    expect(capturedOptions).not.toBeNull();

    const fn = capturedOptions!.refetchInterval as (query: { state: { data?: { hasRecording: boolean } | undefined } }) => number | false;

    // Simulate: no recording yet, mounted just now (well within 3-min window)
    const result = fn({ state: { data: { hasRecording: false } } });
    expect(result).toBe(20_000);
  });

  it('(test 10b) refetchInterval returns false when hasRecording is false but 3 minutes have elapsed', async () => {
    // We need to control Date.now() to simulate time elapsed.
    // The mountedAt ref is captured at render time, so we fake time before render.
    const realDateNow = Date.now;
    const fakeNow = realDateNow() - (3 * 60 * 1000 + 1); // 3 min + 1 ms ago

    // Temporarily override Date.now for the render call so mountedAt is set to a past value
    Date.now = vi.fn().mockReturnValueOnce(fakeNow).mockImplementation(realDateNow);

    const { CtiCallRecording: FreshComponent } = await import('../CtiCallRecording');

    const queryClient = makeQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <FreshComponent interactionId="INT-100" channel="inbound_call" />
      </QueryClientProvider>,
    );

    Date.now = realDateNow;

    expect(capturedOptions).not.toBeNull();

    const fn = capturedOptions!.refetchInterval as (query: { state: { data?: { hasRecording: boolean } | undefined } }) => number | false;

    const result = fn({ state: { data: { hasRecording: false } } });
    expect(result).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 11. refetchIntervalInBackground: false
  // -------------------------------------------------------------------------

  it('(test 11) refetchIntervalInBackground is false', async () => {
    const { CtiCallRecording: FreshComponent } = await import('../CtiCallRecording');

    const queryClient = makeQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <FreshComponent interactionId="INT-100" channel="inbound_call" />
      </QueryClientProvider>,
    );

    expect(capturedOptions).not.toBeNull();
    expect(capturedOptions!.refetchIntervalInBackground).toBe(false);
  });
});

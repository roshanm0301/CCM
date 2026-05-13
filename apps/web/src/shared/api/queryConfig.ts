/**
 * Shared TanStack Query defaults for all useQuery / useInfiniteQuery calls.
 *
 * Spread these into every `useQuery` options object to get consistent
 * retry behaviour and stale-time across the CCM frontend.
 *
 * Source: CCM code quality remediation plan — Wave 5 W5-5
 */

export const QUERY_DEFAULTS = {
  retry: 1,
  retryDelay: (attempt: number) => Math.min(200 * 2 ** attempt, 5000),
  staleTime: 30_000,
} as const;

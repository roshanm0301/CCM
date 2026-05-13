/**
 * Shared date formatting utility for CCM frontend.
 *
 * Formats an ISO datetime string into the CCM standard display format:
 * "DD Mon YYYY, HH:MM AM/PM" using en-IN locale.
 *
 * Source: CCM code quality remediation plan — Wave 5 W5-1
 */

/**
 * Format an ISO datetime string for display in the CCM UI.
 * Returns the original string unchanged if it is not a valid date.
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

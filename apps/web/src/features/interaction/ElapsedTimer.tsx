/**
 * ElapsedTimer — CCM-specific atom.
 *
 * Accepts startTimestamp (ISO 8601) and renders a live mm:ss counter.
 * Clears setInterval on unmount.
 * aria-live="off" — informational only, not critical for screen readers.
 *
 * Source: ux-specification.md Screen 3 §3.7
 */

import React, { useEffect, useRef, useState } from 'react';
import { Typography } from '@mui/material';

interface ElapsedTimerProps {
  startTimestamp: string;
  stopped?: boolean;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ElapsedTimer({ startTimestamp, stopped = false }: ElapsedTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = new Date(startTimestamp).getTime();

    function tick() {
      const nowMs = Date.now();
      const diffSeconds = Math.max(0, Math.floor((nowMs - start) / 1000));
      setElapsed(diffSeconds);
    }

    // Set immediately without waiting for first interval
    tick();

    if (!stopped) {
      intervalRef.current = setInterval(tick, 1000);
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startTimestamp, stopped]);

  return (
    <Typography
      variant="caption"
      color="text.secondary"
      aria-live="off"
      aria-atomic="true"
      component="span"
    >
      {formatElapsed(elapsed)}
    </Typography>
  );
}

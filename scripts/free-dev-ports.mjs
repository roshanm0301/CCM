#!/usr/bin/env node
/**
 * free-dev-ports.mjs
 *
 * Cross-platform (Windows + macOS + Linux) utility that kills any processes
 * holding development ports before Docker Compose starts.
 *
 * Usage (via npm scripts):
 *   node scripts/free-dev-ports.mjs          → frees ports 3000 and 5173
 *   node scripts/free-dev-ports.mjs 3000      → frees port 3000 only
 *
 * Why this exists:
 *   The hybrid dev workflow (local API on :3000, Vite on :5173) and the
 *   Docker stack (ccm-api on :3000, ccm-web on :5173/:8080) share port 3000.
 *   Running both at the same time causes "port already in use" errors when
 *   Docker tries to bind port 3000. This script kills the local processes
 *   before Docker starts, preventing that conflict permanently.
 */

import { execSync } from 'child_process';
import { createServer } from 'net';

const PORTS_TO_FREE = process.argv.slice(2).map(Number).filter(Boolean);
const DEFAULT_PORTS = [3000, 5173];
const ports = PORTS_TO_FREE.length > 0 ? PORTS_TO_FREE : DEFAULT_PORTS;

/**
 * Returns true if something is listening on the port.
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => { server.close(); resolve(false); });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Kill the process holding the given port, cross-platform.
 */
function killPort(port) {
  const isWindows = process.platform === 'win32';
  try {
    if (isWindows) {
      // Find PID via netstat, then taskkill
      const result = execSync(
        `netstat -ano | findstr ":${port} " | findstr LISTENING`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const match = result.match(/\s+(\d+)\s*$/m);
      if (match) {
        const pid = match[1].trim();
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
        console.log(`  ✓ Freed port ${port} (killed PID ${pid})`);
      }
    } else {
      // macOS / Linux: lsof + kill
      const result = execSync(
        `lsof -ti tcp:${port}`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const pids = result.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
      }
      console.log(`  ✓ Freed port ${port} (killed ${pids.join(', ')})`);
    }
  } catch {
    // Nothing was holding the port — that's fine
    console.log(`  ✓ Port ${port} already free`);
  }
}

async function main() {
  console.log('Checking development ports before Docker start...');
  for (const port of ports) {
    const inUse = await isPortInUse(port);
    if (inUse) {
      console.log(`  ! Port ${port} is in use — releasing...`);
      killPort(port);
      // Brief wait to ensure socket closes
      await new Promise(r => setTimeout(r, 400));
    } else {
      console.log(`  ✓ Port ${port} already free`);
    }
  }
  console.log('Done. Starting Docker Compose...\n');
}

main().catch((err) => {
  console.error('free-dev-ports error:', err.message);
  // Do not exit with failure — Docker will surface its own errors
});

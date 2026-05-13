// =============================================================================
// CCM API — Unit Test Setup
//
// Runs in every unit test worker. Closes the Winston logger stream after all
// tests in each worker complete. Without this, the winston.Logger Transform
// stream holds an open event-loop reference that prevents vitest workers from
// exiting cleanly (causes infinite hang after tests pass).
// =============================================================================

import { afterAll } from 'vitest';
import { logger } from '../shared/logging/logger';

afterAll(() => {
  // Close the Winston Transform stream so the Node.js event loop can drain.
  // This is safe because unit tests do not persist the logger across workers.
  logger.end();
});

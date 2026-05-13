// =============================================================================
// CCM API — Context Routes
//
// All routes require authenticate (applied in app.ts).
// Context endpoints are read-only — no CSRF required.
// Source: phase1-technical-blueprint.md §5.13–5.15
// =============================================================================

import { Router } from 'express';
import {
  getCustomerContextController,
  getVehicleContextController,
  getDealerContextController,
} from './context.controller';
import { validateNonEmptyParam } from '../../shared/validation/uuidParam';

export const contextRouter = Router();

// GET /api/v1/context/customer/:ref
// :ref is an external CRM reference code, not a UUID — use non-empty validation.
contextRouter.get('/customer/:ref', validateNonEmptyParam('ref'), getCustomerContextController);

// GET /api/v1/context/vehicle/:ref
contextRouter.get('/vehicle/:ref', validateNonEmptyParam('ref'), getVehicleContextController);

// GET /api/v1/context/dealer/:ref
contextRouter.get('/dealer/:ref', validateNonEmptyParam('ref'), getDealerContextController);

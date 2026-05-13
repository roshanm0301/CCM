// =============================================================================
// CCM API — Cases Routes
//
// All routes require authenticate (applied in app.ts when mounting).
// IMPORTANT: specific paths (/history, /duplicate-check, /interaction/:id)
// are registered before the generic /:id route to avoid conflicts.
// =============================================================================

import { Router } from 'express';
import { validateObjectIdParam, validateUuidParam } from '../../shared/validation/uuidParam';
import {
  getCaseHistoryController,
  duplicateCheckController,
  createCaseController,
  getCaseController,
  getCaseByInteractionController,
  getCaseDetailController,
  getDealerCatalogController,
} from './cases.controller';

export const casesRouter = Router();

// IMPORTANT: all specific paths must be registered before /:id to avoid route conflicts
casesRouter.get('/history', getCaseHistoryController);
casesRouter.get('/duplicate-check', duplicateCheckController);
casesRouter.get('/detail', getCaseDetailController);
casesRouter.get('/dealer-catalog', getDealerCatalogController);
casesRouter.get('/interaction/:interactionId', validateUuidParam('interactionId'), getCaseByInteractionController);
casesRouter.get('/:id', validateObjectIdParam('id'), getCaseController);
casesRouter.post('/', createCaseController);

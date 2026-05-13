// =============================================================================
// CCM API — Interaction Routes
//
// All routes require authenticate (applied in app.ts when mounting).
// CSRF is enforced globally for mutating methods.
// Source: phase1-technical-blueprint.md §5.6–5.11
// =============================================================================

import { Router } from 'express';
import {
  createInteractionController,
  getInteractionController,
  updateContextController,
  saveWrapupController,
  closeInteractionController,
  markIncompleteController,
  listInteractionsController,
  deleteInteractionController,
} from './interaction.controller';
import { validateUuidParam } from '../../shared/validation/uuidParam';

export const interactionRouter = Router();

// GET /api/v1/interactions — list with optional status filter and pagination (Phase 1.5)
// Note: authenticate and authorize('agent') are applied at the mount point in app.ts.
interactionRouter.get('/', listInteractionsController);

// POST /api/v1/interactions
interactionRouter.post('/', createInteractionController);

// GET /api/v1/interactions/:id
interactionRouter.get('/:id', validateUuidParam('id'), getInteractionController);

// PATCH /api/v1/interactions/:id/context
interactionRouter.patch('/:id/context', validateUuidParam('id'), updateContextController);

// PATCH /api/v1/interactions/:id/wrapup
interactionRouter.patch('/:id/wrapup', validateUuidParam('id'), saveWrapupController);

// POST /api/v1/interactions/:id/close
interactionRouter.post('/:id/close', validateUuidParam('id'), closeInteractionController);

// POST /api/v1/interactions/:id/incomplete
interactionRouter.post('/:id/incomplete', validateUuidParam('id'), markIncompleteController);

// DELETE /api/v1/interactions/:id
interactionRouter.delete('/:id', validateUuidParam('id'), deleteInteractionController);

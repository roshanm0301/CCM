// =============================================================================
// CCM API — Follow-Up Routes
//
// All routes require authenticate (applied in app.ts when mounting).
// =============================================================================

import { Router } from 'express';
import { addFollowUpController, getFollowUpHistoryController } from './follow-up.controller';

export const followUpRouter = Router();

// GET  /api/v1/follow-ups?caseId=...  — retrieve follow-up history for a case
followUpRouter.get('/', getFollowUpHistoryController);

// POST /api/v1/follow-ups  — add an immutable follow-up entry (agents only)
followUpRouter.post('/', addFollowUpController);

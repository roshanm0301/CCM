// =============================================================================
// CCM API — Resolution Activity Routes
//
// All routes are mounted under /api/v1/resolution-activity (see app.ts).
// Authentication middleware is applied at the mounting point.
//
//   GET  /history   → getResolutionHistoryController  (query: caseId)
//   GET  /          → loadResolutionTabController      (query: caseId, caseNature, department, productType)
//   POST /          → saveResolutionActivityController
//
// IMPORTANT: /history is registered before / to avoid Express matching
// "history" as the start of a query string on the root route.
// =============================================================================

import { Router } from 'express';
import {
  loadResolutionTabController,
  saveResolutionActivityController,
  getResolutionHistoryController,
} from './resolution-activity.controller';

export const resolutionActivityRouter = Router();

// Specific sub-path before generic root GET.
resolutionActivityRouter.get('/history', getResolutionHistoryController);

resolutionActivityRouter.get('/', loadResolutionTabController);

resolutionActivityRouter.post('/', saveResolutionActivityController);

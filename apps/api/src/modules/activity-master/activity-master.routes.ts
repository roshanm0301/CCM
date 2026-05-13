// =============================================================================
// CCM API — Activity Master Routes
//
// All routes require authenticate + authorize (applied in app.ts).
// CSRF enforced globally for mutating methods.
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Feature 1
// =============================================================================

import { Router } from 'express';
import { validateObjectIdParam } from '../../shared/validation/uuidParam';
import {
  listActivitiesController,
  listActiveActivitiesController,
  createActivityController,
  updateActivityController,
} from './activity-master.controller';

export const activityMasterRouter = Router();

// Must be declared before /:id to avoid route shadowing
activityMasterRouter.get('/active', listActiveActivitiesController);

activityMasterRouter.get('/',    listActivitiesController);
activityMasterRouter.post('/',   createActivityController);
activityMasterRouter.patch('/:id', validateObjectIdParam('id'), updateActivityController);

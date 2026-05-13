// =============================================================================
// CCM API — Activity Template Routes
//
// All routes require authenticate + authorize (applied in app.ts).
// Lookup routes MUST appear before /:id to prevent route shadowing.
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Features 3–7
// =============================================================================

import { Router } from 'express';
import { validateObjectIdParam } from '../../shared/validation/uuidParam';
import {
  listTemplatesController,
  getTemplateController,
  createTemplateController,
  updateTemplateController,
  listDepartmentsController,
  listProductTypesController,
  listAppliesToController,
  listRolesController,
  getApplicableTemplateController,
} from './activity-template.controller';

export const activityTemplateRouter = Router();

// ---------------------------------------------------------------------------
// Lookup endpoints — declared BEFORE /:id
// ---------------------------------------------------------------------------
activityTemplateRouter.get('/lookups/departments',   listDepartmentsController);
activityTemplateRouter.get('/lookups/product-types', listProductTypesController);
activityTemplateRouter.get('/lookups/applies-to',    listAppliesToController);
activityTemplateRouter.get('/lookups/roles',         listRolesController);

// ---------------------------------------------------------------------------
// Applicability lookup — declared BEFORE /:id to prevent route shadowing
// ---------------------------------------------------------------------------
activityTemplateRouter.get('/applicable', getApplicableTemplateController);

// ---------------------------------------------------------------------------
// Template CRUD
// ---------------------------------------------------------------------------
activityTemplateRouter.get('/',    listTemplatesController);
activityTemplateRouter.post('/',   createTemplateController);
activityTemplateRouter.get('/:id',   validateObjectIdParam('id'), getTemplateController);
activityTemplateRouter.patch('/:id', validateObjectIdParam('id'), updateTemplateController);

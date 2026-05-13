// =============================================================================
// CCM API — Case Category Routes
//
// All routes require authenticate (applied in app.ts when mounting).
// CSRF is enforced globally for mutating methods.
// Source: CCM_Phase3_CaseCategory_Master.md
// =============================================================================

import { Router } from 'express';
import { validateObjectIdParam } from '../../shared/validation/uuidParam';
import {
  listCategoriesController,
  getCategoryController,
  createCategoryController,
  updateCategoryController,
  createSubcategoryController,
  updateSubcategoryController,
  listDepartmentsController,
  listCaseNaturesController,
  listPrioritiesController,
  listProductTypesController,
} from './case-category.controller';

export const caseCategoryRouter = Router();

// ---------------------------------------------------------------------------
// Lookup endpoints
// ---------------------------------------------------------------------------

caseCategoryRouter.get('/lookups/departments',   listDepartmentsController);
caseCategoryRouter.get('/lookups/case-natures',  listCaseNaturesController);
caseCategoryRouter.get('/lookups/priorities',    listPrioritiesController);
caseCategoryRouter.get('/lookups/product-types', listProductTypesController);

// ---------------------------------------------------------------------------
// Case Category CRUD
// ---------------------------------------------------------------------------

// GET /api/v1/case-categories
caseCategoryRouter.get('/', listCategoriesController);

// POST /api/v1/case-categories
caseCategoryRouter.post('/', createCategoryController);

// GET /api/v1/case-categories/:id
caseCategoryRouter.get('/:id', validateObjectIdParam('id'), getCategoryController);

// PATCH /api/v1/case-categories/:id
caseCategoryRouter.patch('/:id', validateObjectIdParam('id'), updateCategoryController);

// POST /api/v1/case-categories/:id/subcategories
caseCategoryRouter.post('/:id/subcategories', validateObjectIdParam('id'), createSubcategoryController);

// PATCH /api/v1/case-categories/:categoryId/subcategories/:id
caseCategoryRouter.patch(
  '/:categoryId/subcategories/:id',
  validateObjectIdParam('categoryId'),
  validateObjectIdParam('id'),
  updateSubcategoryController,
);

// =============================================================================
// CCM API — Case Category Controller
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import {
  createCategorySchema,
  updateCategorySchema,
  createSubcategorySchema,
  updateSubcategorySchema,
} from './case-category.validator';
import {
  listCategoriesService,
  getCategoryService,
  createCategoryService,
  updateCategoryService,
  createSubcategoryService,
  updateSubcategoryService,
  listDepartmentsService,
  listCaseNaturesService,
  listPrioritiesService,
  listProductTypesService,
} from './case-category.service';

function requireUser(req: Request): NonNullable<typeof req.user> {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  return req.user;
}

// GET /api/v1/case-categories
export async function listCategoriesController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listCategoriesService();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/case-categories/:id
export async function getCategoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const data = await getCategoryService(id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/case-categories
export async function createCategoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }
    const data = await createCategoryService(parsed.data, user.userId);
    res.status(201).json({ success: true, data, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/case-categories/:id
export async function updateCategoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }
    const data = await updateCategoryService(id, parsed.data, user.userId);
    res.status(200).json({ success: true, data, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/case-categories/:id/subcategories
export async function createSubcategoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const parsed = createSubcategorySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }
    const data = await createSubcategoryService(id, parsed.data, user.userId);
    res.status(201).json({ success: true, data, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/case-categories/:categoryId/subcategories/:id
export async function updateSubcategoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const { categoryId, id } = req.params as { categoryId: string; id: string };
    const parsed = updateSubcategorySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }
    const data = await updateSubcategoryService(categoryId, id, parsed.data, user.userId);
    res.status(200).json({ success: true, data, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/case-categories/lookups/departments
export async function listDepartmentsController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listDepartmentsService();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/case-categories/lookups/case-natures
export async function listCaseNaturesController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listCaseNaturesService();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/case-categories/lookups/priorities
export async function listPrioritiesController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listPrioritiesService();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/case-categories/lookups/product-types
// Fix 12: now async — data comes from PostgreSQL reference_values
export async function listProductTypesController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listProductTypesService();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

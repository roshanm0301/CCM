// =============================================================================
// CCM API — Activity Template Controller
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Features 3–7
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { createTemplateSchema, updateTemplateSchema } from './activity-template.validator';
import {
  listTemplatesService,
  getTemplateService,
  createTemplateService,
  updateTemplateService,
  listDepartmentsForTemplateService,
  listProductTypesForTemplateService,
  listAppliesToService,
  listRolesService,
  getApplicableTemplateService,
} from './activity-template.service';

function requireUser(req: Request): NonNullable<typeof req.user> {
  if (!req.user) throw AppError.unauthorized('Authentication required');
  return req.user;
}

// GET /api/v1/activity-templates
export async function listTemplatesController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listTemplatesService();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/activity-templates/:id
export async function getTemplateController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const data = await getTemplateService(id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/activity-templates
export async function createTemplateController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }
    const data = await createTemplateService(parsed.data, user.userId);
    res.status(201).json({ success: true, data, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/activity-templates/:id
export async function updateTemplateController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const { id } = req.params as { id: string };
    const parsed = updateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }
    const data = await updateTemplateService(id, parsed.data, user.userId);
    res.status(200).json({ success: true, data, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/activity-templates/lookups/departments
export async function listDepartmentsController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listDepartmentsForTemplateService();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/activity-templates/lookups/product-types
// Fix 12: now async — data comes from PostgreSQL reference_values
export async function listProductTypesController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listProductTypesForTemplateService();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/activity-templates/lookups/applies-to
export async function listAppliesToController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listAppliesToService();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/activity-templates/lookups/roles
export async function listRolesController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listRolesService();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/activity-templates/applicable?appliesTo=&department=&productType=
export async function getApplicableTemplateController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { appliesTo, department, productType } = req.query as {
      appliesTo?: string;
      department?: string;
      productType?: string;
    };
    if (!appliesTo || !department || !productType) {
      return next(new AppError('INVALID_INPUT', 'appliesTo, department, and productType query parameters are required.', 400));
    }
    const data = await getApplicableTemplateService(appliesTo, department, productType);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

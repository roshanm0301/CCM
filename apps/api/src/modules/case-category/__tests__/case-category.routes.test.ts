// =============================================================================
// CCM API — Case Category Routes Unit Tests
//
// Tests HTTP routing, auth enforcement, ObjectId param validation, and
// request body validation using a minimal Express app. The service layer
// is fully mocked so no database connection is required.
// Source: CCM_Phase3_CaseCategory_Master.md
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Mock config first — errorHandler transitively imports config at module-load
// time, so env vars must be provided before any import resolves.
// ---------------------------------------------------------------------------

vi.mock('../../../shared/logging/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    debug: vi.fn(), http: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  createContextLogger: vi.fn().mockReturnValue({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    debug: vi.fn(), http: vi.fn(),
  }),
}));

vi.mock('../../../config/index', () => ({
  config: {
    nodeEnv: 'test',
    port: 3000,
    logLevel: 'error',
    postgresHost: 'localhost',
    postgresPort: 5432,
    postgresDb: 'ccm_test',
    postgresUser: 'ccm',
    postgresPassword: 'ccm',
    postgresPoolMin: 2,
    postgresPoolMax: 10,
    mongoHost: 'localhost',
    mongoPort: 27017,
    mongoDb: 'ccm_test',
    mongoUser: 'ccm',
    mongoPassword: 'ccm',
    jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
    jwtExpiry: '8h',
    corsAllowedOrigins: 'http://localhost:5173',
  },
}));

// ---------------------------------------------------------------------------
// Mock the service before importing anything that transitively loads it
// ---------------------------------------------------------------------------

vi.mock('../case-category.service', () => ({
  listCategoriesService: vi.fn().mockResolvedValue([]),
  getCategoryService: vi.fn(),
  createCategoryService: vi.fn(),
  updateCategoryService: vi.fn(),
  createSubcategoryService: vi.fn(),
  updateSubcategoryService: vi.fn(),
  listDepartmentsService: vi.fn().mockResolvedValue([{ code: 'SALES', label: 'Sales' }]),
  listCaseNaturesService: vi.fn().mockResolvedValue([]),
  listPrioritiesService: vi.fn().mockResolvedValue([{ code: 'HIGH', label: 'High' }]),
  listProductTypesService: vi.fn().mockResolvedValue([]),   // Fix 12: now async
}));

import * as svc from '../case-category.service';
import type { MockedFunction } from 'vitest';
import { caseCategoryRouter } from '../case-category.routes';
import { errorHandler } from '../../../shared/middleware/errorHandler';
import { csrfProtection } from '../../../shared/middleware/csrf';
import { AppError } from '../../../shared/errors/AppError';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetCategoryService = svc.getCategoryService as MockedFunction<typeof svc.getCategoryService>;
const mockCreateCategoryService = svc.createCategoryService as MockedFunction<typeof svc.createCategoryService>;
const mockUpdateCategoryService = svc.updateCategoryService as MockedFunction<typeof svc.updateCategoryService>;

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
const TEST_CSRF_TOKEN = 'test-csrf-token-abc123';

// ---------------------------------------------------------------------------
// Helper: create a signed JWT for test requests
// ---------------------------------------------------------------------------

function makeJwt(overrides?: Partial<{ userId: string; username: string; roles: string[] }>) {
  return jwt.sign(
    {
      userId: overrides?.userId ?? 'user-001',
      username: overrides?.username ?? 'agent1',
      roles: overrides?.roles ?? ['agent'],
    },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ---------------------------------------------------------------------------
// Helper: build cookie string with auth + CSRF tokens
// ---------------------------------------------------------------------------

function authCookies(): string {
  return `ccm_session=${makeJwt()}; ccm-csrf=${TEST_CSRF_TOKEN}`;
}

// ---------------------------------------------------------------------------
// Minimal test Express application
//
// Replicates the mounting order from app.ts:
//   1. JSON body parser + cookie parser
//   2. Correlation ID injection (needed by errorHandler)
//   3. CSRF protection (global, same as app.ts)
//   4. Stub authenticate — verifies JWT from cookie, attaches req.user
//   5. caseCategoryRouter
//   6. errorHandler
//
// The CSRF middleware reads from req.cookies['ccm-csrf'] and compares with
// the X-CSRF-Token header (double-submit cookie pattern).
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Correlation ID — required by errorHandler
  app.use((req, _res, next) => {
    req.correlationId = 'test-correlation-id';
    next();
  });

  // CSRF protection (mirrors app.ts — global, before protected routes)
  app.use(csrfProtection);

  // Stub authenticate — validates JWT cookie and attaches req.user
  app.use((req, _res, next) => {
    const token = req.cookies?.['ccm_session'] as string | undefined;
    if (!token) {
      return next(AppError.unauthorized('No session cookie present'));
    }
    try {
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as {
        userId: string;
        username: string;
        roles: string[];
      };
      req.user = { userId: decoded.userId, username: decoded.username, roles: decoded.roles };
      next();
    } catch {
      return next(AppError.unauthorized('Invalid session'));
    }
  });

  app.use('/api/v1/case-categories', caseCategoryRouter);
  app.use(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Fixture: a valid CategoryDto returned by the service mock
// ---------------------------------------------------------------------------

const MOCK_CATEGORY_DTO = {
  id: '507f1f77bcf86cd799439011',
  code: 'COMPLAINT',
  displayName: 'Complaint Handling',
  definition: 'Cases related to customer complaints',
  departments: ['SALES'],
  caseNatures: ['COMPLAINT'],
  productTypes: ['Motorcycle'],
  isActive: true,
  subcategoryCount: 0,
  createdBy: null,
  createdAt: '2026-03-25T00:00:00.000Z',
  updatedAt: '2026-03-25T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  vi.resetAllMocks();
  // Re-apply default mock return values after resetAllMocks
  (svc.listCategoriesService as MockedFunction<typeof svc.listCategoriesService>).mockResolvedValue([]);
  (svc.listDepartmentsService as MockedFunction<typeof svc.listDepartmentsService>).mockResolvedValue([{ code: 'SALES', label: 'Sales' }]);
  (svc.listCaseNaturesService as MockedFunction<typeof svc.listCaseNaturesService>).mockResolvedValue([]);
  (svc.listPrioritiesService as MockedFunction<typeof svc.listPrioritiesService>).mockResolvedValue([{ code: 'HIGH', label: 'High' }]);
  (svc.listProductTypesService as MockedFunction<typeof svc.listProductTypesService>).mockResolvedValue([]);   // Fix 12: now async
  app = buildApp();
});

// ---------------------------------------------------------------------------
// Authentication guard
// ---------------------------------------------------------------------------

describe('Authentication guard', () => {
  it('GET /api/v1/case-categories without auth cookie → 401', async () => {
    const res = await request(app).get('/api/v1/case-categories');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/case-categories/lookups/departments without auth → 401', async () => {
    const res = await request(app).get('/api/v1/case-categories/lookups/departments');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// CSRF guard
// ---------------------------------------------------------------------------

describe('CSRF guard', () => {
  it('POST /api/v1/case-categories without CSRF header (but with auth) → 403', async () => {
    // Cookie has the session but no ccm-csrf, and no X-CSRF-Token header
    const res = await request(app)
      .post('/api/v1/case-categories')
      .set('Cookie', `ccm_session=${makeJwt()}`)
      .set('Content-Type', 'application/json')
      .send({
        code: 'COMPLAINT',
        displayName: 'Complaint Handling',
        definition: 'Cases related to customer complaints',
        departments: ['SALES'],
        caseNatures: ['COMPLAINT'],
        productTypes: ['Motorcycle'],
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toMatch(/CSRF/);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/case-categories — happy path
// ---------------------------------------------------------------------------

describe('POST /api/v1/case-categories', () => {
  it('with valid auth + CSRF → 201 (mock service returns category)', async () => {
    mockCreateCategoryService.mockResolvedValue(MOCK_CATEGORY_DTO);

    const res = await request(app)
      .post('/api/v1/case-categories')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .set('Content-Type', 'application/json')
      .send({
        code: 'COMPLAINT',
        displayName: 'Complaint Handling',
        definition: 'Cases related to customer complaints',
        departments: ['SALES'],
        caseNatures: ['COMPLAINT'],
        productTypes: ['Motorcycle'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe('COMPLAINT');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/case-categories/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/case-categories/:id', () => {
  it('with valid MongoDB ObjectId → calls getCategoryService and returns 200', async () => {
    mockGetCategoryService.mockResolvedValue({
      ...MOCK_CATEGORY_DTO,
      subcategories: [],
    });

    const res = await request(app)
      .get('/api/v1/case-categories/507f1f77bcf86cd799439011')
      .set('Cookie', authCookies());

    expect(res.status).toBe(200);
    expect(mockGetCategoryService).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(res.body.data.id).toBe('507f1f77bcf86cd799439011');
  });

  it('with invalid ObjectId (e.g., not-an-objectid) → 400', async () => {
    const res = await request(app)
      .get('/api/v1/case-categories/not-an-objectid')
      .set('Cookie', authCookies());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Lookup endpoints
// ---------------------------------------------------------------------------

describe('Lookup endpoints', () => {
  it('GET /api/v1/case-categories/lookups/departments with auth → 200, returns array', async () => {
    const res = await request(app)
      .get('/api/v1/case-categories/lookups/departments')
      .set('Cookie', authCookies());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].code).toBe('SALES');
  });

  it('GET /api/v1/case-categories/lookups/priorities with auth → 200, returns array', async () => {
    const res = await request(app)
      .get('/api/v1/case-categories/lookups/priorities')
      .set('Cookie', authCookies());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].code).toBe('HIGH');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/case-categories/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/case-categories/:id', () => {
  it('with valid body + auth → 200', async () => {
    mockUpdateCategoryService.mockResolvedValue(MOCK_CATEGORY_DTO);

    const res = await request(app)
      .patch('/api/v1/case-categories/507f1f77bcf86cd799439011')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Updated Complaint Handling' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('with invalid body (displayName empty string) → 422', async () => {
    const res = await request(app)
      .patch('/api/v1/case-categories/507f1f77bcf86cd799439011')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .set('Content-Type', 'application/json')
      .send({ displayName: '' }); // empty string — min(1) fails

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
